import React from 'react';
import { Sliders, Eye, AlertTriangle, RotateCcw, Play, Square, Database } from 'lucide-react';

export default function Controls({
  sensitivity,
  setSensitivity,
  opacity,
  setOpacity,
  status,
  onOverride,
  onResetOverride,
  isScanning,
  setIsScanning,
  onStartCalibration,
  isCalibrating,
  calibrationProgress
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
      
      {/* Offline Calibration Trigger */}
      <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-200">Baseline Enrollment</span>
          </div>
          <span className="text-[10px] font-mono text-indigo-400">FEW-SHOT ML</span>
        </div>
        
        {isCalibrating ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex justify-between text-[11px] font-mono text-indigo-300">
              <span>Capturing clean frames...</span>
              <span>{calibrationProgress}/25</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-200" 
                style={{ width: `${(calibrationProgress / 25) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={onStartCalibration}
            className="w-full mt-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
          >
            Enroll Baseline (20-30 Good Photos)
          </button>
        )}
      </div>

      {/* Main Inspection Power Toggle */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Live Controls</h2>
        </div>
        <button
          onClick={() => setIsScanning(!isScanning)}
          className={`px-3 py-1 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition ${
            isScanning 
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30' 
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
          }`}
        >
          {isScanning ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          {isScanning ? 'STOP SCANNER' : 'START SCANNER'}
        </button>
      </div>

      {/* Threshold Slider with Strict/Lenient Labels */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs">
          <label className="text-gray-300 font-medium">Sensitivity Threshold</label>
          <span className="font-mono text-indigo-400 font-bold">{(sensitivity / 100).toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="110"
          max="150"
          value={sensitivity}
          onChange={(e) => setSensitivity(Number(e.target.value))}
          className="w-full accent-indigo-500 bg-gray-800 rounded-lg h-2 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-mono text-gray-500 px-0.5">
          <span>Strict (0.50)</span>
          <span>Default (1.0)</span>
          <span>Lenient (1.50)</span>
        </div>
      </div>

      {/* Heatmap Opacity Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300 font-medium">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <span>Heatmap Overlay Opacity</span>
          </div>
          <span className="font-mono text-indigo-400 font-bold">{opacity}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full accent-indigo-500 bg-gray-800 rounded-lg h-2 cursor-pointer"
        />
      </div>

      {/* Human-in-the-Loop Override */}
      <div className="pt-2 border-t border-gray-800 flex flex-col gap-2">
        <label className="text-xs text-gray-400 font-medium">Human-in-the-Loop Override</label>
        {status === 'OVERRIDE' ? (
          <button
            onClick={onResetOverride}
            className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 border border-gray-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset AI Automatic Mode
          </button>
        ) : (
          <button
            onClick={onOverride}
            className="w-full py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Force Pass (Override False Positive)
          </button>
        )}
      </div>
    </div>
  );
}