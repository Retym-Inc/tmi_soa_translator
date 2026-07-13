import { useState } from 'react';
import { Zap, RefreshCcw, ShieldAlert, Activity } from 'lucide-react';
import UploadZone from './components/UploadZone';
import SOADashboard from './components/SOADashboard';
import TMIDashboard from './components/TMIDashboard';
import { detectReportType } from './parsers/detector';
import { parseSOA } from './parsers/soaParser';
import { parseTMI } from './parsers/tmiParser';

export default function App() {
  const [reportType, setReportType] = useState(null); // 'SOA' | 'TMI' | 'UNKNOWN'
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);

  function handleData(text) {
    setError(null);
    const type = detectReportType(text);
    if (!type) {
      setReportType('UNKNOWN');
      setParsedData(null);
      return;
    }
    try {
      if (type === 'SOA') {
        const data = parseSOA(text);
        setReportType('SOA');
        setParsedData(data);
      } else {
        const data = parseTMI(text);
        setReportType('TMI');
        setParsedData(data);
      }
    } catch (e) {
      setError(`Parse error: ${e.message}`);
    }
  }

  function reset() {
    setReportType(null);
    setParsedData(null);
    setError(null);
  }

  const badgeClass =
    reportType === 'SOA'
      ? 'bg-rose-900/60 text-rose-300 border-rose-700'
      : reportType === 'TMI'
      ? 'bg-cyan-900/60 text-cyan-300 border-cyan-700'
      : 'bg-slate-700 text-slate-300 border-slate-600';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="text-cyan-400" size={24} />
            <div>
              <h1 className="font-bold text-white text-lg leading-tight">
                SOA / TMI Report Analyzer
              </h1>
              <p className="text-slate-400 text-xs">Cadence Virtuoso reliability report dashboard</p>
            </div>
          </div>
          {reportType && (
            <div className="flex items-center gap-3">
              <span className={`border text-xs font-bold px-3 py-1 rounded-full ${badgeClass}`}>
                {reportType === 'SOA' ? (
                  <span className="flex items-center gap-1"><ShieldAlert size={12} /> SOA Report</span>
                ) : reportType === 'TMI' ? (
                  <span className="flex items-center gap-1"><Activity size={12} /> TMI Report</span>
                ) : 'Unknown'}
              </span>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300 transition-colors"
              >
                <RefreshCcw size={14} />
                New Report
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!reportType && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-white mb-3">Upload Your Report</h2>
              <p className="text-slate-400">
                Drag-and-drop or paste an SOA (Safe Operation Area) or TMI (Degradation &amp; Lifetime)
                report. The report type is auto-detected.
              </p>
            </div>
            <UploadZone onData={handleData} />
            {error && (
              <div className="mt-4 bg-rose-950/40 border border-rose-700 rounded-lg p-4 text-rose-300 text-sm">
                {error}
              </div>
            )}
            {reportType === 'UNKNOWN' && (
              <div className="mt-4 bg-amber-950/40 border border-amber-700 rounded-lg p-4 text-amber-300 text-sm">
                Could not detect report type. Please ensure the file is a valid SOA or TMI report.
              </div>
            )}
          </div>
        )}

        {reportType === 'SOA' && parsedData && (
          <SOADashboard data={parsedData} />
        )}

        {reportType === 'TMI' && parsedData && (
          <TMIDashboard data={parsedData} />
        )}
      </main>
    </div>
  );
}
