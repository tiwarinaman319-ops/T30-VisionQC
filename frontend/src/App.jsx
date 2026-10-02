import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Sliders, 
  Play, 
  Square, 
  Aperture, 
  FlipHorizontal, 
  Activity, 
  Settings2, 
  Cpu, 
  Radio, 
  Crosshair, 
  Zap, 
  Download, 
  Clock, 
  Layers 
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";

export default function App() {
  const [activeTab, setActiveTab] = useState('scanner');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [threshold, setThreshold] = useState(1);
  const [isModelReady, setIsModelReady] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [stats, setStats] = useState({ total: 0, passed: 0, rejected: 0, rejection_rate: 0 });
  const [statusMessage, setStatusMessage] = useState("");
  const [isTraining, setIsTraining] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [latency, setLatency] = useState(0);

  // Inspection History Log (Saved Frames & Heatmaps)
  const [inspectionHistory, setInspectionHistory] = useState([]);

  // Hardware settings
  const [isMirrored, setIsMirrored] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  // Bind video element to camera stream
  useEffect(() => {
    if (isCameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [isCameraActive, stream]);

  // Request browser permission and trigger hardware camera
  const startCameraStream = async (deviceId = null) => {
    try {
      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraActive(true);

      const activeId = mediaStream.getVideoTracks()[0]?.getSettings()?.deviceId;
      if (activeId) setSelectedDeviceId(activeId);
    } catch (err) {
      console.error("Camera error:", err);
      setStatusMessage("Camera permission denied or camera not found.");
      setIsCameraActive(false);
    }
  };

  // Stop video stream and clear tracks
  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (isInspecting) {
      clearInterval(timerRef.current);
      setIsInspecting(false);
    }
    setIsCameraActive(false);
  };

  const toggleCameraPower = () => {
    if (isCameraActive) {
      stopCameraStream();
      setStatusMessage("Camera feed deactivated.");
    } else {
      startCameraStream(selectedDeviceId);
      setStatusMessage("Camera initialized.");
    }
  };

  const fetchThreshold = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/threshold`);
      const data = await res.json();
      if (data.threshold !== undefined) setThreshold(Number(data.threshold).toFixed(3));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchModelStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/model-status`);
      const data = await res.json();
      setIsModelReady(data.trained === true);
      if (!data.trained) {
        setStatusMessage("No calibrated model loaded. Calibrate a clean reference part before inspection.");
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("Backend server offline.");
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const initializationTimer = window.setTimeout(() => {
      fetchStats();
      fetchThreshold();
      fetchModelStatus();
    }, 0);
    return () => window.clearTimeout(initializationTimer);
  }, [fetchStats, fetchThreshold, fetchModelStatus]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    stream?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stream]);

  const updateThreshold = async (val) => {
    const floatVal = parseFloat(val);
    setThreshold(floatVal);
    try {
      await fetch(`${API_BASE}/threshold`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: floatVal })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const captureFrameBlob = () => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current || !isCameraActive) return resolve(null);
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      const ctx = c.getContext('2d');

      ctx.save();
      if (isMirrored) {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, 0, 0, c.width, c.height);
      ctx.restore();

      c.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
    });
  };

  const saveInspectionRecord = (resultData) => {
    if (!resultData || !resultData.heatmap_b64) return;
    const newRecord = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      score: resultData.score,
      result: resultData.result,
      confidence: resultData.confidence,
      heatmap: resultData.heatmap_b64
    };
    setInspectionHistory(prev => [newRecord, ...prev.slice(0, 9)]);
  };

  const captureAndInspect = async () => {
    const blob = await captureFrameBlob();
    if (!blob) return;

    const fd = new FormData();
    fd.append("file", blob, "frame.jpg");

    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/inspect`, { method: "POST", body: fd });
      const data = await res.json();
      const t1 = performance.now();
      setLatency(Math.round(t1 - t0));

      if (!res.ok) {
        setStatusMessage(data.detail || "Inspection failed.");
        return;
      }

      setScanResult(data);
      fetchStats();

      if (data.result === 'FAIL') {
        saveInspectionRecord(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleInspection = () => {
    if (!isCameraActive) {
      setStatusMessage("Activate camera first before starting scanner.");
      return;
    }
    if (!isModelReady) {
      setStatusMessage("Calibrate a clean reference part before starting inspection.");
      return;
    }
    if (isInspecting) {
      clearInterval(timerRef.current);
      setIsInspecting(false);
    } else {
      setIsInspecting(true);
      timerRef.current = setInterval(captureAndInspect, 600);
    }
  };

  const handleAutoTrain = async () => {
    if (!isCameraActive) {
      setStatusMessage("Turn camera ON first to calibrate golden part.");
      return;
    }
    if (isInspecting) toggleInspection();
    setIsTraining(true);
    setStatusMessage("Hold reference object steady in the crosshair...");

    const fd = new FormData();
    const FRAMES = 15;

    for (let i = 0; i < FRAMES; i++) {
      setCaptureProgress(Math.round(((i + 1) / FRAMES) * 100));
      const blob = await captureFrameBlob();
      if (blob) fd.append("files", blob, `golden_${i}.jpg`);
      await new Promise(r => setTimeout(r, 160));
    }

    setStatusMessage("Extracting features and generating PatchCore memory bank...");

    try {
      const res = await fetch(`${API_BASE}/train`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.detail || "Calibration failed.");
        return;
      }
      if (data.status === "trained") {
        setIsModelReady(true);
        setThreshold(Number(data.threshold).toFixed(3));
        setStatusMessage(`Calibration complete: ${data.training_images} training and ${data.calibration_images} held-out clean frames. Reference part registered as Normal.`);
      }
    } catch (err) {
      setStatusMessage(err.message || "Backend server offline.");
    } finally {
      setIsTraining(false);
      setCaptureProgress(0);
    }
  };return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#070a12',
      color: '#e2e8f0',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* Header Bar */}
      <header style={{
        padding: '14px 24px',
        backgroundColor: 'rgba(11, 17, 33, 0.95)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Cpu size={20} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px', color: '#f8fafc' }}>VISION</span>
              <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px', color: '#38bdf8' }}>QC</span>
              <span style={{ 
                backgroundColor: isCameraActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                color: isCameraActive ? '#10b981' : '#ef4444', 
                fontSize: '10px', 
                padding: '2px 8px', 
                borderRadius: '4px',
                border: isCameraActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                fontWeight: 700
              }}>
                {isCameraActive ? "SENSOR ONLINE" : "SENSOR STANDBY"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
              UNSUPERVISED SURFACE ANOMALY DETECTION
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={toggleCameraPower}
            style={{
              backgroundColor: isCameraActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: isCameraActive ? '#ef4444' : '#10b981',
              border: isCameraActive ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            {isCameraActive ? <><CameraOff size={15} /> POWER DOWN CAMERA</> : <><Camera size={15} /> ENABLE CAMERA</>}
          </button>

          <button
            onClick={handleAutoTrain}
            disabled={!isCameraActive || isTraining || !isModelReady}
            style={{
              backgroundColor: isTraining ? '#0369a1' : 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: (!isCameraActive || isTraining) ? 'not-allowed' : 'pointer',
              opacity: !isCameraActive ? 0.4 : 1
            }}
          >
            <Aperture size={15} />
            {isTraining ? `CALIBRATING ${captureProgress}%` : "CALIBRATE REFERENCE"}
          </button>
        </div>
      </header>

      {/* Notifications */}
      {statusMessage && (
        <div style={{
          backgroundColor: '#0b1329',
          borderLeft: '4px solid #38bdf8',
          borderBottom: '1px solid #1e293b',
          padding: '10px 24px',
          fontSize: '12px',
          color: '#38bdf8',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Zap size={14} />
          {statusMessage}
        </div>
      )}

      {/* Navigation Pills */}
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '12px 24px 0 24px',
        maxWidth: '1350px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        {[
          { id: 'scanner', label: 'INSPECTION HUD', icon: Camera },
          { id: 'history', label: `DEFECT RECORDINGS (${inspectionHistory.length})`, icon: Layers },
          { id: 'metrics', label: 'TELEMETRY & LOGS', icon: Activity },
          { id: 'tuning', label: 'OPTICS & SENSITIVITY', icon: Settings2 }
        ].map(tab => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px 8px 0 0',
                backgroundColor: isCurrent ? 'rgba(19, 29, 53, 0.9)' : 'transparent',
                border: isCurrent ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                borderBottom: isCurrent ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.05)',
                color: isCurrent ? '#f8fafc' : '#64748b',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Icon size={15} color={isCurrent ? '#38bdf8' : '#64748b'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Body */}
      <main style={{
        flex: 1,
        padding: '18px 24px 32px 24px',
        maxWidth: '1350px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>

        {/* TAB 1: SCANNER HUD */}
        {activeTab === 'scanner' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)',
            gap: '20px'
          }}>
            
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '12px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Radio size={16} color={isInspecting ? '#10b981' : '#64748b'} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>REAL-TIME OPTICAL VIEWPORT</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  INFERENCE LATENCY: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{latency} ms</span>
                </div>
              </div>

              {/* Viewport Frame */}
              <div style={{
                position: 'relative',
                width: '100%',
                backgroundColor: '#020617',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #1e293b',
                aspectRatio: '16 / 10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => videoRef.current && videoRef.current.play()}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: isCameraActive ? 'block' : 'none',
                    transform: isMirrored ? 'scaleX(-1)' : 'none'
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Heatmap Overlay */}
                {scanResult && scanResult.heatmap_b64 && isInspecting && isCameraActive && (
                  <img
                    src={scanResult.heatmap_b64}
                    alt="Defect Heatmap"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: scanResult.result === 'FAIL' ? 0.70 : 0.0,
                      transform: isMirrored ? 'scaleX(-1)' : 'none',
                      pointerEvents: 'none'
                    }}
                  />
                )}

                {/* Reticle */}
                {isCameraActive && (
                  <div style={{
                    position: 'absolute',
                    inset: '24px',
                    border: '1px dashed rgba(56, 189, 248, 0.25)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Crosshair size={28} color="rgba(56, 189, 248, 0.4)" />
                  </div>
                )}

                {/* Verdict Badge */}
                {scanResult && isInspecting && isCameraActive && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    fontWeight: 900,
                    fontSize: '18px',
                    letterSpacing: '1px',
                    backgroundColor: scanResult.result === 'PASS' ? 'rgba(16, 185, 129, 0.92)' : 'rgba(239, 68, 68, 0.92)',
                    color: '#fff',
                    boxShadow: scanResult.result === 'PASS' ? '0 0 25px rgba(16, 185, 129, 0.5)' : '0 0 25px rgba(239, 68, 68, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {scanResult.result === 'PASS' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    {scanResult.result}
                  </div>
                )}

                {!isCameraActive && (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    <CameraOff size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>CAMERA STREAM OFFLINE</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#475569' }}>
                      Click "ENABLE CAMERA" above to request permission and start the optical feed.
                    </p>
                  </div>
                )}
              </div>

              {/* Viewport Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setIsMirrored(!isMirrored)}
                    disabled={!isCameraActive}
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      color: '#94a3b8',
                      border: '1px solid #334155',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: isCameraActive ? 'pointer' : 'not-allowed',
                      opacity: !isCameraActive ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <FlipHorizontal size={14} />
                    {isMirrored ? "UNMIRROR" : "MIRROR"}
                  </button>

                  <button
                    onClick={() => saveInspectionRecord(scanResult)}
                    disabled={!scanResult}
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: scanResult ? 'pointer' : 'not-allowed',
                      opacity: !scanResult ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={14} />
                    RECORD HEATMAP
                  </button>
                </div>

                <button
                  onClick={toggleInspection}
                  disabled={!isCameraActive || isTraining}
                  style={{
                    backgroundColor: isInspecting ? '#ef4444' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    fontWeight: 900,
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    cursor: (!isCameraActive || isTraining || !isModelReady) ? 'not-allowed' : 'pointer',
                    opacity: (!isCameraActive || !isModelReady) ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: isInspecting ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 0 20px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  {isInspecting ? <><Square size={16} /> HALT SCANNER</> : <><Play size={16} /> ACTIVATE SCANNER</>}
                </button>
              </div>

            </div>

            {/* Sidebar Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '12px',
                padding: '18px'
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>
                  ANOMALY DISTANCE
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 900, color: scanResult?.result === 'FAIL' ? '#ef4444' : '#38bdf8' }}>
                    {scanResult ? scanResult.score : "0.000"}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    THRESHOLD: <strong style={{ color: '#f8fafc' }}>{threshold}</strong>
                  </span>
                </div>

                <div style={{ width: '100%', height: '8px', backgroundColor: '#020617', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, ((scanResult?.score || 0) / (threshold * 1.5)) * 100)}%`,
                    height: '100%',
                    backgroundColor: (scanResult?.score || 0) > threshold ? '#ef4444' : '#10b981',
                    transition: 'width 0.2s ease'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
                  <span>CONFIDENCE: <strong style={{ color: '#38bdf8' }}>{scanResult ? `${scanResult.confidence}%` : "—"}</strong></span>
                  <span>RESULT: <strong style={{ color: scanResult?.result === 'PASS' ? '#10b981' : scanResult ? '#ef4444' : '#64748b' }}>
                    {scanResult ? scanResult.result : "IDLE"}
                  </strong></span>
                </div>
              </div>

              {/* Shift Stats Card */}
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '12px',
                padding: '18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, letterSpacing: '0.5px' }}>
                    CURRENT BATCH YIELD
                  </span>
                  <button onClick={fetchStats} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <RefreshCw size={14} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#0b1120', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>TOTAL INSPECTED</span>
                    <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{stats.total}</div>
                  </div>
                  <div style={{ backgroundColor: '#0b1120', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>SCRAP / REJECT %</span>
                    <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: stats.rejection_rate > 10 ? '#ef4444' : '#10b981' }}>
                      {stats.rejection_rate}%
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: DEFECT HEATMAP RECORDINGS */}
        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>Recorded Anomaly Heatmaps</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  All flagged defects are captured with their JET thermal localization maps.
                </p>
              </div>
              <button 
                onClick={() => setInspectionHistory([])}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Clear Log
              </button>
            </div>

            {inspectionHistory.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                border: '1px dashed #334155',
                borderRadius: '8px',
                color: '#64748b',
                fontSize: '13px'
              }}>
                No defects or manual snapshots recorded yet. Activate scanner and test a defect.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {inspectionHistory.map(rec => (
                  <div key={rec.id} style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <img 
                      src={rec.heatmap} 
                      alt="Defect Heatmap Snapshot" 
                      style={{ width: '100%', height: '180px', objectFit: 'cover' }} 
                    />
                    <div style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{
                          backgroundColor: rec.result === 'FAIL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: rec.result === 'FAIL' ? '#ef4444' : '#10b981',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 800,
                          fontSize: '11px'
                        }}>
                          {rec.result}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {rec.timestamp}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Distance Score: <strong style={{ color: '#f8fafc' }}>{rec.score}</strong> | Conf: <strong>{rec.confidence}%</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TELEMETRY */}
        {activeTab === 'metrics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>PARTS PASSED (GOOD)</span>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#10b981', marginTop: '6px' }}>{stats.passed}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Yield: {stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 100}%</div>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>PARTS REJECTED (DEFECTS)</span>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#ef4444', marginTop: '6px' }}>{stats.rejected}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Scrap Rate: {stats.rejection_rate}%</div>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>AVG INFERENCE SPEED</span>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#38bdf8', marginTop: '6px' }}>{latency} <span style={{ fontSize: '16px' }}>ms</span></div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>PatchCore Tensor Forward Pass</div>
            </div>
          </div>
        )}

        {/* TAB 4: TUNING */}
        {activeTab === 'tuning' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={18} color="#38bdf8" /> Anomaly Threshold Cutoff
                </span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#38bdf8' }}>{threshold}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 20px 0' }}>
                Score relative to the held-out clean reference; scores above the cutoff are flagged.
              </p>
              
              <input
                type="range"
                min="0.50"
                max="1.50"
                step="0.005"
                value={threshold}
                onChange={(e) => updateThreshold(e.target.value)}
                style={{ width: '100%', accentColor: '#38bdf8', height: '6px', cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                <span>Strict (0.50)</span>
                <span>Reference (1.00)</span>
                <span>Permissive (1.50)</span>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}