import React, { useRef, useEffect, useState } from 'react';
import { Camera, ShieldAlert, CheckCircle2, Crosshair } from 'lucide-react';

export default function CameraView({ onFrameCapture, heatmapUrl, status = 'PASS', opacity = 50, anomalyScore = 0.12 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
        }
      } catch (err) {
        setError("Camera access denied or unavailable.");
      }
    }
    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Frame Capture Loop
  useEffect(() => {
    if (!isCameraActive) return;
    const interval = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        if (onFrameCapture) onFrameCapture(base64Image);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isCameraActive, onFrameCapture]);

  // Border glow styles based on AI status
  const borderStyles = status === 'FAIL'
    ? 'border-red-500 shadow-2xl shadow-red-950/50 ring-2 ring-red-500/50'
    : status === 'OVERRIDE'
    ? 'border-amber-500 shadow-2xl shadow-amber-950/50'
    : 'border-emerald-500/80 shadow-2xl shadow-emerald-950/30';

  return (
    <div className={`relative w-full bg-gray-900 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${borderStyles}`}>
      
      {/* Top HUD Status Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-950/90 backdrop-blur border-b border-gray-800 text-white z-10 relative">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-indigo-400" />
          <span className="font-mono text-xs font-semibold tracking-wider text-gray-200">
            CAM_01 // INSP_ZONE_A
          </span>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-gray-500">SCORE:</span>
            <span className={`font-bold ${anomalyScore > 0.4 ? 'text-red-400' : 'text-emerald-400'}`}>
              {(anomalyScore * 100).toFixed(1)}%
            </span>
          </div>

          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold ${
            status === 'FAIL' ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' :
            status === 'OVERRIDE' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          }`}>
            {status === 'FAIL' ? <ShieldAlert className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {status}
          </div>
        </div>
      </div>

      {/* Camera Viewport with Overlays */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        {error ? (
          <p className="text-sm font-medium text-red-400">{error}</p>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {/* AI Heatmap Overlay Layer */}
            {heatmapUrl && (
              <img
                src={heatmapUrl}
                alt="Defect Heatmap"
                style={{ opacity: opacity / 100 }}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-150 mix-blend-screen"
              />
            )}

            {/* Target ROI Box */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-72 h-72 border-2 border-dashed border-indigo-400/40 rounded-xl relative flex items-center justify-center">
                <Crosshair className="w-6 h-6 text-indigo-400/30" />
                <span className="absolute top-2 left-2 font-mono text-[10px] text-indigo-300/60 uppercase">
                  ROI Alignment Area
                </span>
              </div>
            </div>

            {/* Telemetry Overlay Text */}
            <div className="absolute bottom-2 left-3 font-mono text-[10px] text-gray-400/80 bg-black/60 px-2 py-1 rounded backdrop-blur pointer-events-none flex gap-3">
              <span>FPS: 30</span>
              <span>LATENCY: 14ms</span>
              <span>MODEL: RESNET18_PATCHCORE</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}