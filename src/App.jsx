import { useState, useCallback } from 'react'
import { Cpu, RefreshCw, Table2, BarChart2, GitBranch, Database, Shield } from 'lucide-react'
import UploadZone from './components/UploadZone.jsx'
import KpiCards from './components/KpiCards.jsx'
import DataTable from './components/DataTable.jsx'
import Charts from './components/Charts.jsx'
import HierarchyTree from './components/HierarchyTree.jsx'

const TABS = [
  { id: 'table',     label: 'Data Table',  Icon: Table2 },
  { id: 'charts',    label: 'Charts',      Icon: BarChart2 },
  { id: 'hierarchy', label: 'Hierarchy',   Icon: GitBranch },
]

function MetaChip({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <span className="inline-flex items-center gap-1 bg-gray-800 rounded-md px-2 py-1 text-xs text-gray-300">
      <span className="text-gray-500">{label}:</span>
      <span className="font-mono">{value}</span>
    </span>
  )
}

function ReportBadge({ type }) {
  return type === 'SOA'
    ? <span className="inline-flex items-center gap-1.5 bg-orange-900/50 border border-orange-700 text-orange-300 rounded-full px-3 py-0.5 text-xs font-semibold"><Shield className="w-3 h-3" />SOA Report</span>
    : <span className="inline-flex items-center gap-1.5 bg-blue-900/50 border border-blue-700 text-blue-300 rounded-full px-3 py-0.5 text-xs font-semibold"><Database className="w-3 h-3" />TMI Report</span>
}

function Dashboard({ reportData, onReset }) {
  const [tab, setTab] = useState('table')

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800 px-6 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white text-sm">TMI / SOA Analyzer</span>
          </div>
          <ReportBadge type={reportData.type} />
          <div className="flex items-center gap-2 flex-wrap ml-2">
            {reportData.type === 'TMI' && (
              <>
                <MetaChip label="Core devices" value={reportData.metadata?.coreDeviceCount} />
                <MetaChip label="IO devices"   value={reportData.metadata?.ioDeviceCount} />
                <MetaChip label="Area"         value={reportData.metadata?.effectiveCoreArea} />
                <MetaChip label="dageTime"     value={reportData.metadata?.sumDageTime} />
              </>
            )}
            {reportData.type === 'SOA' && reportData.metadata?.sortingNum && (
              <MetaChip label="soa_sorting_num" value={reportData.metadata.sortingNum} />
            )}
            <MetaChip label="Rows" value={reportData.records.length} />
          </div>
          <button
            onClick={onReset}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New Report
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <KpiCards reportData={reportData} />

        {/* Tab navigation */}
        <div className="border-b border-gray-800 flex gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="pb-12">
          {tab === 'table'     && <DataTable reportData={reportData} />}
          {tab === 'charts'    && <Charts reportData={reportData} />}
          {tab === 'hierarchy' && <HierarchyTree reportData={reportData} />}
        </div>
      </main>
    </div>
  )
}

/* ─── Dual-report view ──────────────────────────────────────────────────────── */

function DualDashboard({ reports, onReset }) {
  const [active, setActive] = useState(0)
  return (
    <div>
      {/* Report selector */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex items-center gap-3">
        <span className="text-xs text-gray-500">Both report types detected:</span>
        {reports.map((r, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
              active === i ? 'border-blue-500 text-blue-300 bg-blue-950/40' : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {r.type}
          </button>
        ))}
      </div>
      <Dashboard reportData={reports[active]} onReset={onReset} />
    </div>
  )
}

/* ─── Root ──────────────────────────────────────────────────────────────────── */

export default function App() {
  const [reportData, setReportData] = useState(null)

  const handleLoad = useCallback((data) => {
    setReportData(data)
  }, [])

  const handleReset = useCallback(() => {
    setReportData(null)
  }, [])

  if (!reportData) {
    return <UploadZone onLoad={handleLoad} />
  }

  if (Array.isArray(reportData)) {
    return <DualDashboard reports={reportData} onReset={handleReset} />
  }

  return <Dashboard reportData={reportData} onReset={handleReset} />
}
