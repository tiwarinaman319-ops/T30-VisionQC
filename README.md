# vision-qc

VisionQC is a camera-based surface inspection demo using PatchCore anomaly detection.

## Run locally

Install the backend requirements in a Python environment supported by Anomalib 2.6.2, then start the API from the backend directory:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

In another terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Enable the camera and calibrate with at least 10 distinct, clean images of the same product, camera position, and lighting used for inspection. Training holds some clean images out of the PatchCore memory bank and uses them to calibrate a normal-score reference. A checkpoint without this calibration is not loaded for inspection. The inspection score is relative to that reference; scores above the selected threshold are flagged as anomalies.

This live calibration uses only normal images. It checks normal-score calibration, but it cannot measure defect recall or replace testing with representative, labeled defective parts. For a measurable labeled benchmark, run the cells in `backend/experiment.ipynb`, which trains, evaluates, exports, and inspects against held-out MVTec bottle examples.