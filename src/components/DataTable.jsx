import { useState, useMemo, useCallback } from 'react'
import { ChevronUp, ChevronDown, Search, Download, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { formatLifetimeYears } from '../parsers/tmiParser.js'

const PAGE_SIZE = 20

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function fmtDuration(s) {
  if (!s && s !== 0) return '-'
  if (s >= 1) return `${s.toFixed(3)} s`
  if (s >= 1e-3) return `${(s * 1e3).toFixed(3)} ms`
  if (s >= 1e-6) return `${(s * 1e6).toFixed(3)} µs`
  if (s >= 1e-9) return `${(s * 1e9).toFixed(3)} ns`
  if (s >= 1e-12) return `${(s * 1e12).toFixed(3)} ps`
  return `${s.toExponential(3)} s`
}

function SortIcon({ col, sortConfig }) {
  if (sortConfig.key !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
  return sortConfig.dir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-blue-400" />
    : <ChevronDown className="w-3 h-3 text-blue-400" />
}

function Th({ label, col, sortConfig, onSort }) {
  return (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors"
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon col={col} sortConfig={sortConfig} />
      </span>
    </th>
  )
}

const PARAM_COLORS = {
  Vgs:  'bg-blue-900/60 text-blue-300',
  Vgd:  'bg-purple-900/60 text-purple-300',
  '|Vds|': 'bg-orange-900/60 text-orange-300',
  Vgsr: 'bg-teal-900/60 text-teal-300',
  Vgdr: 'bg-cyan-900/60 text-cyan-300',
  Vbsr: 'bg-pink-900/60 text-pink-300',
  Vbdr: 'bg-rose-900/60 text-rose-300',
  Vsg:  'bg-indigo-900/60 text-indigo-300',
  Vdg:  'bg-violet-900/60 text-violet-300',
  Vgb:  'bg-amber-900/60 text-amber-300',
  Vsb:  'bg-lime-900/60 text-lime-300',
  Vdb:  'bg-emerald-900/60 text-emerald-300',
}
function paramBadge(param) {
  const cls = PARAM_COLORS[param] || 'bg-gray-800 text-gray-300'
  return (
    <span key={param} className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono ${cls}`}>
      {param}
    </span>
  )
}

/* ─── SOA table ────────────────────────────────────────────────────────────── */

function SOATable({ records, query, sortConfig, onSort }) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return records.filter(
      (r) => r.instance.toLowerCase().includes(q) || r.model.toLowerCase().includes(q),
    )
  }, [records, query])

  const sorted = useMemo(() => {
    const { key, dir } = sortConfig
    if (!key) return filtered
    return [...filtered].sort((a, b) => {
      let av = a[key], bv = b[key]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortConfig])

  return { sorted, filtered }
}

function SOARows({ row }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{row.rank}</td>
        <td className="px-3 py-2.5 font-mono text-xs text-gray-200 max-w-xs truncate" title={row.instance}>{row.instance}</td>
        <td className="px-3 py-2.5 text-center text-xs">
          <span className="bg-red-900/60 text-red-300 px-2 py-0.5 rounded font-medium">
            {row.voltageEntries.length}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            {[...new Set(row.voltageEntries.map((v) => v.param))].map(paramBadge)}
          </div>
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-yellow-300">{fmtDuration(row.worstDuration)}</td>
        <td className="px-3 py-2.5 font-mono text-xs text-orange-300">{row.worstPercent.toFixed(2)}%</td>
        <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{row.model}</td>
      </tr>
      {open && (
        <tr className="bg-gray-900/60">
          <td colSpan={7} className="px-6 pb-4 pt-2">
            <div className="text-xs text-gray-400 mb-2 font-semibold">Violation details</div>
            <div className="space-y-1">
              {row.voltageEntries.map((v, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  {paramBadge(v.param)}
                  <span className="text-gray-500">as</span>
                  <span className="text-gray-300">{v.condition}</span>
                  <span className="text-gray-500">range</span>
                  <span className="text-blue-300">{v.range}</span>
                  <span className="text-gray-500">dur</span>
                  <span className="text-yellow-300">{v.duration}</span>
                  <span className="text-gray-500">duty</span>
                  <span className="text-orange-300">{v.percent}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ─── TMI table ────────────────────────────────────────────────────────────── */

function lifetimeCell(raw, years) {
  const cls = isFinite(years) && years !== null
    ? years < 1 ? 'text-red-400 font-semibold'
    : years < 10 ? 'text-orange-400 font-semibold'
    : 'text-green-400'
    : 'text-gray-500'
  return (
    <span className={`font-mono text-xs ${cls}`} title={raw}>
      {formatLifetimeYears(years)}
    </span>
  )
}

/* ─── Main DataTable ───────────────────────────────────────────────────────── */

export default function DataTable({ reportData }) {
  const [query, setQuery] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'rank', dir: 'asc' })
  const [page, setPage] = useState(1)

  const toggleSort = useCallback((key) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
    setPage(1)
  }, [])

  const handleQuery = useCallback((e) => { setQuery(e.target.value); setPage(1) }, [])

  // Build filtered + sorted dataset
  const displayRows = useMemo(() => {
    const q = query.toLowerCase()
    const filtered = reportData.records.filter(
      (r) => r.instance.toLowerCase().includes(q) || r.model.toLowerCase().includes(q),
    )
    const { key, dir } = sortConfig
    const sorted = [...filtered].sort((a, b) => {
      let av = a[key], bv = b[key]
      // Treat null/undefined as worst
      if (av == null) av = dir === 'asc' ? Infinity : -Infinity
      if (bv == null) bv = dir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [reportData.records, query, sortConfig])

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE))
  const pageRows = displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const downloadCSV = useCallback(() => {
    const isTMI = reportData.type === 'TMI'
    let headers, rows
    if (isTMI) {
      headers = ['Rank', 'Instance', 'Lifetime(HCI+BTI,yr)', 'Lifetime(HCI,yr)', 'Lifetime(BTI,yr)', 'Lifetime Item', 'EOL Spec', 'Model']
      rows = displayRows.map((r) => [
        r.rank, r.instance,
        r.lifetime_hci_bti_raw, r.lifetime_hci_raw, r.lifetime_bti_raw,
        r.lifetime_item, r.eol_spec, r.model,
      ])
    } else {
      headers = ['Rank', 'Instance', '#Violations', 'Parameters', 'WorstDuration(s)', 'WorstDutyCycle(%)', 'Model']
      rows = displayRows.map((r) => [
        r.rank, r.instance,
        r.voltageEntries.length,
        [...new Set(r.voltageEntries.map((v) => v.param))].join('+'),
        r.worstDuration, r.worstPercent, r.model,
      ])
    }
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${reportData.type.toLowerCase()}_report.csv`
    a.click()
  }, [reportData, displayRows])

  const isTMI = reportData.type === 'TMI'

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={handleQuery}
            placeholder="Filter by instance or model…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <span className="text-xs text-gray-500">{displayRows.length} of {reportData.records.length} rows</span>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 sticky top-0 z-10">
            <tr>
              <Th label="Rank"     col="rank"     sortConfig={sortConfig} onSort={toggleSort} />
              <Th label="Instance" col="instance" sortConfig={sortConfig} onSort={toggleSort} />
              {isTMI ? (
                <>
                  <Th label="Lifetime HCI+BTI" col="lifetimeHCIBTI" sortConfig={sortConfig} onSort={toggleSort} />
                  <Th label="Lifetime HCI"     col="lifetimeHCI"    sortConfig={sortConfig} onSort={toggleSort} />
                  <Th label="Lifetime BTI"     col="lifetimeBTI"    sortConfig={sortConfig} onSort={toggleSort} />
                  <Th label="Item"             col="lifetime_item"  sortConfig={sortConfig} onSort={toggleSort} />
                  <Th label="EOL Spec"         col="eol_spec"       sortConfig={sortConfig} onSort={toggleSort} />
                </>
              ) : (
                <>
                  <Th label="# Params"    col="voltageEntries.length" sortConfig={sortConfig} onSort={toggleSort} />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Parameters</th>
                  <Th label="Worst Duration" col="worstDuration" sortConfig={sortConfig} onSort={toggleSort} />
                  <Th label="Duty Cycle %" col="worstPercent" sortConfig={sortConfig} onSort={toggleSort} />
                </>
              )}
              <Th label="Model" col="model" sortConfig={sortConfig} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={isTMI ? 8 : 8} className="text-center py-12 text-gray-600">
                  No matching records
                </td>
              </tr>
            ) : isTMI ? (
              pageRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                  <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{r.rank}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-200 max-w-xs" title={r.instance}>
                    <span className="block truncate">{r.instance}</span>
                  </td>
                  <td className="px-3 py-2.5">{lifetimeCell(r.lifetime_hci_bti_raw, r.lifetimeHCIBTI)}</td>
                  <td className="px-3 py-2.5">{lifetimeCell(r.lifetime_hci_raw,     r.lifetimeHCI)}</td>
                  <td className="px-3 py-2.5">{lifetimeCell(r.lifetime_bti_raw,     r.lifetimeBTI)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{r.lifetime_item}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{r.eol_spec}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{r.model}</td>
                </tr>
              ))
            ) : (
              pageRows.map((r) => <SOARows key={r.id} row={r} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button onClick={() => setPage(1)} disabled={page === 1} className="p-1 rounded hover:bg-gray-800 disabled:opacity-30">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-gray-800 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-gray-400 text-xs px-2">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-800 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1 rounded hover:bg-gray-800 disabled:opacity-30">
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
