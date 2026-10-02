import os

os.environ["TRUST_REMOTE_CODE"] = "1"

import base64
import hashlib
import json
import logging
import shutil
import sqlite3
import stat
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import List

import cv2
import numpy as np
import torch
from anomalib.data import Folder
from anomalib.deploy import ExportType, TorchInferencer
from anomalib.engine import Engine
from anomalib.models import Patchcore
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
EXPORT_DIR = BASE_DIR / "exported"
WEIGHT_PATH = EXPORT_DIR / "weights" / "torch" / "model.pt"
CALIBRATION_PATH = EXPORT_DIR / "calibration.json"
DB_PATH = BASE_DIR / "qc.db"
MIN_TRAIN_IMAGES = 10
MAX_TRAIN_IMAGES = 60

app = FastAPI(title="VisionQC API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

threshold = 1.0
inf: TorchInferencer | None = None
score_reference: float | None = None
model_metadata: dict | None = None
training_lock = threading.Lock()


def load_saved_model():
    global inf, score_reference, threshold, model_metadata
    if not WEIGHT_PATH.is_file() or not CALIBRATION_PATH.is_file():
        logger.warning("No calibrated model found; train the model before inspection.")
        return

    metadata = json.loads(CALIBRATION_PATH.read_text(encoding="utf-8"))
    reference = float(metadata["score_reference"])
    if not np.isfinite(reference) or reference <= 0:
        raise ValueError("Saved model calibration has an invalid score reference.")

    loaded_model = TorchInferencer(path=str(WEIGHT_PATH), device="cpu")
    inf = loaded_model
    score_reference = reference
    threshold = float(metadata.get("threshold", 1.0))
    model_metadata = metadata
    logger.info("Loaded calibrated model from %s", WEIGHT_PATH)


load_saved_model()

db = sqlite3.connect(DB_PATH, check_same_thread=False)
db.execute("CREATE TABLE IF NOT EXISTS log(ts REAL, score REAL, result TEXT)")
db.commit()


class ThresholdModel(BaseModel):
    value: float = Field(ge=1.1, le=1.5)


def compute_confidence(score: float, thresh: float) -> float:
    effective_threshold = thresh + 0.20

    if effective_threshold <= 0:
        return 0.0

    distance = abs(score - effective_threshold)
    return round(float(min(100.0, distance / effective_threshold * 100.0)), 1)


def _save_calibration(path: Path, metadata: dict) -> None:
    temporary_path = path.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    os.replace(temporary_path, path)


def _retry_readonly_delete(function, path, error) -> None:
    os.chmod(path, stat.S_IWRITE | stat.S_IREAD | stat.S_IEXEC)
    function(path)


def _raw_prediction(inferencer: TorchInferencer, image_bgr: np.ndarray) -> tuple[float, np.ndarray]:
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    with torch.inference_mode():
        prediction = inferencer.predict(image=image_rgb)

    raw_score = float(prediction.pred_score.detach().cpu().reshape(-1)[0])
    anomaly_map = prediction.anomaly_map.detach().cpu().numpy().squeeze()
    if not np.isfinite(raw_score) or not np.isfinite(anomaly_map).all():
        raise ValueError("Model returned a non-finite score or anomaly map.")
    return raw_score, anomaly_map


def _train_model(images: List[np.ndarray]) -> tuple[TorchInferencer, float, dict]:
    validation_count = max(3, int(round(len(images) * 0.4)))
    calibration_indices = set(
        np.linspace(0, len(images) - 1, num=validation_count).round().astype(int)
    )
    train_images = [image for index, image in enumerate(images) if index not in calibration_indices]
    calibration_images = [image for index, image in enumerate(images) if index in calibration_indices]
    if len(train_images) < 7 or len(calibration_images) < 3:
        raise ValueError("Training requires at least 7 training and 3 calibration images.")

    with tempfile.TemporaryDirectory(prefix="visionqc-training-", dir=BASE_DIR) as temporary_dir:
        temporary_root = Path(temporary_dir)
        data_root = temporary_root / "data"
        train_dir = data_root / "train" / "good"
        train_dir.mkdir(parents=True)
        calibration_dir = data_root / "test" / "good"
        calibration_dir.mkdir(parents=True)
        for index, image in enumerate(train_images):
            encoded, png = cv2.imencode(".png", image)
            if not encoded:
                raise RuntimeError("Could not prepare a training image.")
            (train_dir / f"{index:03d}.png").write_bytes(png.tobytes())
        for index, image in enumerate(calibration_images):
            encoded, png = cv2.imencode(".png", image)
            if not encoded:
                raise RuntimeError("Could not prepare a calibration image.")
            (calibration_dir / f"{index:03d}.png").write_bytes(png.tobytes())

        datamodule = Folder(
            name="product",
            root=data_root,
            normal_dir="train/good",
            normal_test_dir="test/good",
            num_workers=0,
            val_split_mode="same_as_test",
        )
        model = Patchcore()
        engine = Engine(
            enable_progress_bar=False,
            default_root_dir=temporary_root / "results",
        )
        engine.fit(model=model, datamodule=datamodule)

        # Normal-only training cannot learn defect-aware normalization or a defect threshold.
        model.post_processor.enable_normalization = False
        model.post_processor.enable_thresholding = False
        staged_export = temporary_root / "exported"
        engine.export(
            model=model,
            export_type=ExportType.TORCH,
            export_root=staged_export,
        )
        staged_weight = next(staged_export.rglob("model.pt"), None)
        if staged_weight is None:
            raise RuntimeError("PatchCore export did not produce a model.pt checkpoint.")

        candidate = TorchInferencer(path=str(staged_weight), device="cpu")
        calibration_scores = [
            _raw_prediction(candidate, image)[0] for image in calibration_images
        ]
        maximum_normal_score = max(calibration_scores)
        if maximum_normal_score <= 0:
            raise ValueError("Calibration scores must be positive to set a reliable cutoff.")

        reference = maximum_normal_score + max(abs(maximum_normal_score) * 0.05, 1e-6)
        metadata = {
            "images_used": len(images),
            "training_images": len(train_images),
            "calibration_images": len(calibration_images),
            "score_reference": reference,
            "threshold": 1.0,
            "score_type": "patchcore_raw_image_score_over_held_out_normal_reference",
        }
        _save_calibration(staged_export / "calibration.json", metadata)

        backup_export = BASE_DIR / f".exported-backup-{uuid.uuid4().hex}"
        had_previous_export = EXPORT_DIR.exists()
        if had_previous_export:
            os.replace(EXPORT_DIR, backup_export)
        try:
            os.replace(staged_export, EXPORT_DIR)
        except Exception:
            if had_previous_export and backup_export.exists():
                os.replace(backup_export, EXPORT_DIR)
            raise

        if backup_export.exists():
            try:
                shutil.rmtree(backup_export, onerror=_retry_readonly_delete)
            except OSError as error:
                logger.warning("Previous model backup remains at %s: %s", backup_export, error)

    return candidate, reference, metadata


@app.post("/train")
async def train(files: list[UploadFile] = File(...)):
    """Train on clean images and calibrate the anomaly score on held-out clean frames."""
    global inf, score_reference, threshold, model_metadata
    if not MIN_TRAIN_IMAGES <= len(files) <= MAX_TRAIN_IMAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Upload between {MIN_TRAIN_IMAGES} and {MAX_TRAIN_IMAGES} clean images.",
        )
    if not training_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A model training job is already in progress.")

    try:
        images = []
        seen_hashes = set()
        for file in files:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="An uploaded image is empty.")
            image = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                raise HTTPException(status_code=400, detail="An uploaded file is not a readable image.")

            digest = hashlib.sha256(content).digest()
            if digest in seen_hashes:
                continue
            seen_hashes.add(digest)
            images.append(image)

        if len(images) < MIN_TRAIN_IMAGES:
            raise HTTPException(
                status_code=422,
                detail=f"At least {MIN_TRAIN_IMAGES} distinct clean images are required.",
            )

        candidate, reference, metadata = await run_in_threadpool(_train_model, images)
        inf = candidate
        score_reference = reference
        threshold = 1.0
        model_metadata = metadata
        return {
            "status": "trained",
            "images_used": len(images),
            "training_images": metadata["training_images"],
            "calibration_images": metadata["calibration_images"],
            "score_reference": round(reference, 4),
            "threshold": threshold,
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Model training failed.")
        raise HTTPException(status_code=500, detail=f"Model training failed: {error}") from error
    finally:
        training_lock.release()


@app.post("/inspect")
async def inspect(file: UploadFile = File(...)):
    """Inspect an image and return its calibrated verdict and anomaly heatmap."""
    current_model = inf
    current_reference = score_reference
    current_threshold = threshold
    if current_model is None or current_reference is None:
        raise HTTPException(status_code=503, detail="No calibrated model is loaded. Train it first.")

    content = await file.read()
    image = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Uploaded file is not a readable image.")

    try:
        raw_score, anomaly_map = _raw_prediction(current_model, image)
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    score = raw_score / current_reference
    result = "FAIL" if score > (current_threshold + 0.20) else "PASS"
    resized_map = cv2.resize(anomaly_map, (image.shape[1], image.shape[0]))
    denominator = np.ptp(resized_map) + 1e-8
    normalized_map = (255 * (resized_map - resized_map.min()) / denominator).astype(np.uint8)
    heat = cv2.applyColorMap(normalized_map, cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(image, 0.5, heat, 0.5, 0)
    encoded, png = cv2.imencode(".png", overlay)
    if not encoded:
        raise RuntimeError("Could not encode the inspection heatmap.")

    db.execute("INSERT INTO log VALUES (?, ?, ?)", (time.time(), score, result))
    db.commit()
    return {
        "score": round(score, 3),
        "result": result,
        "confidence": compute_confidence(score, current_threshold),
        "threshold": current_threshold,
        "heatmap_b64": "data:image/png;base64," + base64.b64encode(png.tobytes()).decode("ascii"),
    }


@app.get("/model-status")
def get_model_status():
    return {
        "trained": inf is not None and score_reference is not None,
        "calibration_images": model_metadata.get("calibration_images", 0) if model_metadata else 0,
    }


@app.get("/threshold")
def get_threshold():
    return {"threshold": threshold}


@app.put("/threshold")
def set_threshold(update: ThresholdModel):
    global threshold, model_metadata
    if model_metadata is not None:
        updated_metadata = {**model_metadata, "threshold": update.value}
        _save_calibration(CALIBRATION_PATH, updated_metadata)
        model_metadata = updated_metadata
    threshold = update.value
    return {"threshold": threshold}


@app.get("/stats")
def stats():
    """Daily rejection metrics."""
    day_start = time.time() - (time.time() % 86400)
    cursor = db.execute(
        "SELECT COUNT(*), SUM(CASE WHEN result='FAIL' THEN 1 ELSE 0 END) FROM log WHERE ts >= ?",
        (day_start,),
    )
    total, fails = cursor.fetchone()
    total = total or 0
    fails = fails or 0
    rejection_rate = round(100.0 * fails / total, 1) if total > 0 else 0.0

    return {
        "total": total,
        "passed": total - fails,
        "rejected": fails,
        "rejection_rate": rejection_rate,
    }
