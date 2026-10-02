import React from 'react';
import { BarChart3, CheckCircle2, AlertOctagon, Percent } from 'lucide-react';

export default function ShiftMetrics({ logs }) {
  const totalScans = logs.length;
  const rejections = logs.filter(l => l.status === 'FAIL').length;
  const passed = logs.filter(l => l.status === 'PASS' || l.status === 'OVERRIDE').length;
  const rejectionRate = totalScans > 0 ? ((rejections / totalScans) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Today's Shift Metrics</h2>
        </div>
        <span className="text-[10px] font-mono text-gray-500 uppercase">Live Telemetry</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Total Scans */}
        <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] font-mono text-gray-400">Total Scans</span>
          <span className="text-xl font-bold font-mono text-white">{totalScans}</span>
        </div>

        {/* Rejection Rate */}
        <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] font-mono text-gray-400">Rejection Rate</span>
          <span className={`text-xl font-bold font-mono ${Number(rejectionRate) > 15 ? 'text-red-400' : 'text-emerald-400'}`}>
            {rejectionRate}%
          </span>
        </div>

        {/* Passed */}
        <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] font-mono text-emerald-500/80">Passed</span>
          <span className="text-xl font-bold font-mono text-emerald-400">{passed}</span>
        </div>

        {/* Flagged Defective */}
        <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] font-mono text-red-400/80">Flagged Defective</span>
          <span className="text-xl font-bold font-mono text-red-400">{rejections}</span>
        </div>
      </div>
    </div>
  );
}