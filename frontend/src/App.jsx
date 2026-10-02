import React, {
  useState,
  useEffect,
  useRef,
  useCallback
} from 'react';
import {
  inspectFrame,
  trainBaseline,
  getStats,
  setThreshold
} from './api';
import CameraView from './components/CameraView';
import Controls from './components/Controls';
import ShiftMetrics from './components/ShiftMetrics';
import AuditLog from './components/AuditLog';
import InspectionModal from './components/InspectionModal';

export default function App() {

const handleThresholdChange = async (value) => {
  setSensitivity(value);

  const thresholdValue = value / 100;

  try {
    await setThreshold(thresholdValue);
  } catch (error) {
    console.error("Threshold update failed:", error);
    setBackendError(
      error.message || "Could not update threshold."
    );
  }
};

  const [sensitivity, setSensitivity] = useState(100);
  const [opacity, setOpacity] = useState(60);
  const [manualOverride, setManualOverride] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [currentScore, setCurrentScore] = useState(0.12);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [logs, setLogs] = useState([]);
  const [backendStatus, setBackendStatus] = useState('READY');
  const [backendStats, setBackendStats] = useState({
    total: 0,
    passed: 0,
    rejected: 0,
    rejection_rate: 0,
  });
  const [devMode, setDevMode] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null); // Selected log for Modal
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [baselineReference, setBaselineReference] = useState(
  () => localStorage.getItem('visionqc_baseline_reference') || null
);

  const capturedFrames = useRef([]);
  const inspectionBusy = useRef(false);
  const handleFrameCapture = useCallback(async (base64Image) => {
  // Baseline enrollment
  if (isCalibrating) {
    capturedFrames.current.push(base64Image);

    const count = capturedFrames.current.length;

    if (count === 5) {
  setBaselineReference(base64Image);
  localStorage.setItem('visionqc_baseline_reference', base64Image);
}

    setCalibrationProgress(
      Math.min(count, 25)
    );

    if (count >= 25) {
      try {
        await trainBaseline(
          capturedFrames.current
        );

        setIsCalibrating(false);
        capturedFrames.current = [];
        setBackendError(null);

      } catch (error) {
        console.error(error);

        setBackendError(
          error.message || "Baseline training failed."
        );

        setIsCalibrating(false);
        capturedFrames.current = [];
      }
    }

    return;
  }
  if (devMode) {
  return;
    }
  if (!isScanning || inspectionBusy.current) {
    return;
  }

  inspectionBusy.current = true;

  try {
    const result = await inspectFrame(base64Image);

    const score = Number(result.score);

    setCurrentScore(score);
    setCurrentConfidence(Number(result.confidence));
    setBackendStatus(result.result);
    setHeatmapUrl(result.heatmap_b64);
    setBackendError(null);

    const newLog = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      score,
      status: result.result,
      confidence: result.confidence,
      image: base64Image,
      heatmap: result.heatmap_b64,
    };

    setLogs(prev => [
      newLog,
      ...prev.slice(0, 9)
    ]);

  } catch (error) {
    console.error(error);
    setBackendError(
      error.message || "Backend inspection failed."
    );
  } finally {
    inspectionBusy.current = false;
  }
}, [
  isCalibrating,
  isScanning,
  devMode
]);
  // Hidden hotkey: Press Ctrl + Shift + D to toggle Dev Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDevMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  useEffect(() => {
  let mounted = true;

  const refreshStats = async () => {
    try {
      const data = await getStats();

      if (mounted) {
        setBackendStats({
          total: data.total ?? 0,
          passed: data.passed ?? 0,
          rejected: data.rejected ?? 0,
          rejection_rate: data.rejection_rate ?? 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch backend stats:", error);
    }
  };

  refreshStats();

  const interval = setInterval(refreshStats, 1000);

  return () => {
    mounted = false;
    clearInterval(interval);
  };
}, []);

  const threshold = sensitivity / 100;
  let status = currentScore > threshold ? 'FAIL' : 'PASS';
  if (manualOverride) status = 'OVERRIDE';
  
  const handleStartCalibration = () => {
    capturedFrames.current = [];
    setIsCalibrating(true);
    setCalibrationProgress(0);
    setBackendError(null);
  };

  const triggerTestScan = (score, forcedStatus) => {
  setCurrentScore(score);

  const newLog = {
    id: Date.now(),
    timestamp: new Date().toLocaleTimeString(),
    score: score,
    status: forcedStatus,
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=60"
  };

  setLogs(prev => [newLog, ...prev.slice(0, 9)]);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col p-6 gap-6 max-w-7xl mx-auto relative">
      
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div>
          <h1 
            onClick={() => setDevMode(!devMode)}
            className="text-2xl font-black tracking-tight text-white cursor-pointer select-none"
            title="VisionQC Dashboard"
          >
            VisionQC
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Unsupervised Industrial Visual Inspection System</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SYSTEM READY</span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <CameraView
  onFrameCapture={handleFrameCapture}
  heatmapUrl={heatmapUrl}
  status={manualOverride ? 'OVERRIDE' : backendStatus}
  opacity={opacity}
  anomalyScore={currentScore}
  confidence={currentConfidence}
  isScanning={isScanning}
  isCalibrating={isCalibrating}
/>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ShiftMetrics
  logs={logs}
  stats={backendStats}
/>
            
            {devMode ? (
              <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-amber-300">Demo Testing Controls</span>
                  <span className="text-[10px] font-mono text-amber-400/80">DEV ONLY</span>
                </div>
                <p className="text-[11px] text-gray-400">Simulate backend inspection payloads:</p>
                <div className="flex flex-col gap-2 font-mono text-xs mt-auto">
                  <button
                    onClick={() => triggerTestScan(0.12, 'PASS')}
                    className="w-full py-2 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 rounded-lg border border-emerald-800/50 transition"
                  >
                    Force PASS Scan (12%)
                  </button>
                  <button
                    onClick={() => triggerTestScan(0.78, 'FAIL')}
                    className="w-full py-2 bg-red-950/40 hover:bg-red-900/50 text-red-300 rounded-lg border border-red-800/50 transition"
                  >
                    Force FAIL Scan (78%)
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-gray-300">System Telemetry</h3>
                  <p className="text-xs text-gray-500 mt-2">
                    Live frames captured every 500ms and routed to FastAPI engine. PatchCore anomaly score determines pass/fail thresholds in real time.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 pt-3 border-t border-gray-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>PIPELINE ONLINE</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <Controls
            sensitivity={sensitivity}
            setSensitivity={handleThresholdChange}
            opacity={opacity}
            setOpacity={setOpacity}
            status={status}
            onOverride={() => setManualOverride(true)}
            onResetOverride={() => setManualOverride(false)}
            isScanning={isScanning}
            setIsScanning={setIsScanning}
            onStartCalibration={handleStartCalibration}
            isCalibrating={isCalibrating}
            calibrationProgress={calibrationProgress}
          />
        </div>
      </div>

      {/* Audit Log */}
      <AuditLog logs={logs} onSelectSnapshot={(log) => setSelectedLog(log)} />

      {/* Diagnostic Modal */}
      <InspectionModal
        log={selectedLog}
        baselineReference={baselineReference}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}