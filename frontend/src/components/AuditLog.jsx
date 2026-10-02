import React from 'react';
import { History, Download } from 'lucide-react';

export default function AuditLog({ logs, onSelectSnapshot }) {
  
  // CSV Export Handler
  const handleExportCSV = () => {
    if (!logs || logs.length === 0) return;

    const headers = ["Scan ID", "Timestamp", "Status", "Anomaly Score (%)"];
    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      l.status,
      (l.score * 100).toFixed(1)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `visionqc_shift_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Shift Defect Audit Log</h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-gray-500">{logs.length} Scans Logged</span>
          
          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 text-gray-300 rounded-lg text-xs font-mono font-medium border border-gray-700 flex items-center gap-1.5 transition"
            title="Download shift records as CSV"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Gallery Strip */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 font-mono">No inspection events recorded yet...</p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              onClick={() => onSelectSnapshot && onSelectSnapshot(log)}
              className="flex-shrink-0 w-36 bg-gray-950 border border-gray-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition cursor-pointer group"
            >
              <div className="relative aspect-video bg-black">
                <img src={log.image} alt="Scan snapshot" className="w-full h-full object-cover group-hover:scale-105 transition" />
                <span className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                  log.status === 'FAIL' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  {log.status}
                </span>
              </div>
              <div className="p-2 flex flex-col gap-0.5 font-mono text-[10px]">
                <span className="text-gray-400">{log.timestamp}</span>
                <span className="text-gray-200 font-bold">Score: {(log.score * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}