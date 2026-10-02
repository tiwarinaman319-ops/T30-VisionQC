import React from 'react';
import { X, CheckCircle2, ShieldAlert, Sparkles, Layers } from 'lucide-react';

export default function InspectionModal({
  log,
  baselineReference,
  onClose
}) {
  if (!log) return null;

  // Placeholder clean reference image for comparison
  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-950 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Defect Diagnostic Comparison
                <span className="text-xs font-mono font-normal text-gray-400">
                  // SCAN_ID: #{log.id.toString().slice(-6)}
                </span>
              </h2>
              <p className="text-xs text-gray-400">Comparing live frame against PatchCore Golden Baseline</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 rounded-lg border border-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-Side Image Comparison */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-950/50">
          
          {/* Golden Baseline */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> GOLDEN REFERENCE (PASS)
              </span>
              <span className="text-gray-500">MEMORY_BANK_V1</span>
            </div>
            <div className="relative aspect-video rounded-xl overflow-hidden border border-emerald-500/30 bg-black">
              <img
  src={baselineReference}
  alt="Golden Reference"
  className="w-full h-full object-cover"
/>
              <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                0.0% ANOMALY SCORE
              </div>
            </div>
          </div>

          {/* Inspected Item + Heatmap Overlay */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className={`font-bold flex items-center gap-1.5 ${
                log.status === 'FAIL' ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {log.status === 'FAIL' ? <ShieldAlert className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                FLAGGED SCAN ({log.status})
              </span>
              <span className="text-gray-400">{log.timestamp}</span>
            </div>
            <div className={`relative aspect-video rounded-xl overflow-hidden border bg-black ${
              log.status === 'FAIL' ? 'border-red-500/40 shadow-lg shadow-red-950/30' : 'border-gray-800'
            }`}>
              <div className="relative w-full h-full">
  <img
    src={log.image}
    alt="Inspected Scan"
    className="w-full h-full object-cover"
  />

  {log.heatmap && (
    <img
      src={log.heatmap}
      alt="Anomaly Heatmap"
      className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-60"
    />
  )}
</div>
              <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white border border-gray-700">
                SCORE: {(log.score * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Telemetry */}
        <div className="px-6 py-4 bg-gray-900 border-t border-gray-800 flex flex-wrap justify-between items-center gap-4 text-xs font-mono text-gray-400">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-gray-500">Decision: </span>
              <span className={`font-bold ${log.status === 'FAIL' ? 'text-red-400' : 'text-emerald-400'}`}>
                {log.status}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Deviation Delta: </span>
              <span className="text-white font-bold">+{(log.score * 100).toFixed(1)}%</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-sans font-semibold text-xs transition"
          >
            Close Diagnostics
          </button>
        </div>

      </div>
    </div>
  );
}