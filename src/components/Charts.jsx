import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
  PieChart, Pie,
} from 'recharts'
import { formatLifetimeYears } from '../parsers/tmiParser.js'

/* ─── Shared tooltip style ─────────────────────────────────────────────────── */
const tooltipStyle = {
  contentStyle: { background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#e5e7eb' },
}

/* ─── Colour helpers ────────────────────────────────────────────────────────── */
const COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#38bdf8', '#fb923c', '#c084fc']

function lifetimeBarColor(years) {
  if (!isFinite(years)) return '#374151'
  if (years < 1) return '#f87171'
  if (years < 10) return '#fb923c'
  return '#34d399'
}

/* ─── TMI Charts ────────────────────────────────────────────────────────────── */

function TMICharts({ records }) {
  // Top-10 worst instances (lowest finite lifetime first)
  const top10 = useMemo(() => {
    const finite = records.filter((r) => r.lifetimeHCIBTI !== null && isFinite(r.lifetimeHCIBTI))
    return finite
      .sort((a, b) => a.lifetimeHCIBTI - b.lifetimeHCIBTI)
      .slice(0, 10)
      .map((r) => ({
        name: r.instance.split('.').slice(-2).join('.'),
        fullName: r.instance,
        lifetime: parseFloat(r.lifetimeHCIBTI.toFixed(4)),
        model: r.model,
        color: lifetimeBarColor(r.lifetimeHCIBTI),
      }))
  }, [records])

  // Mechanism breakdown: HCI-only vs BTI-only worst
  const mechanismData = useMemo(() => {
    let hciCrit = 0, btiCrit = 0, bothCrit = 0
    for (const r of records) {
      const h = isFinite(r.lifetimeHCI) ? r.lifetimeHCI : Infinity
      const b = isFinite(r.lifetimeBTI) ? r.lifetimeBTI : Infinity
      const c = isFinite(r.lifetimeHCIBTI) ? r.lifetimeHCIBTI : Infinity
      if (!isFinite(c)) continue
      if (h < b * 0.5) hciCrit++
      else if (b < h * 0.5) btiCrit++
      else bothCrit++
    }
    return [
      { name: 'HCI dominant', value: hciCrit, fill: '#60a5fa' },
      { name: 'BTI dominant', value: btiCrit, fill: '#a78bfa' },
      { name: 'Mixed / Equal', value: bothCrit, fill: '#34d399' },
    ].filter((d) => d.value > 0)
  }, [records])

  const customTooltipTop10 = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs space-y-1">
        <div className="text-gray-300 font-mono text-[11px] break-all max-w-64">{d.fullName}</div>
        <div className="text-white font-semibold">{formatLifetimeYears(d.lifetime)}</div>
        <div className="text-gray-500">{d.model}</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Top 10 worst lifetime bar chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Top 10 Worst Lifetime Instances</h3>
        <p className="text-xs text-gray-500 mb-5">Shortest lifetime(HCI+BTI) — red &lt;1 yr · orange &lt;10 yr · green ≥10 yr</p>
        {top10.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-12">All instances have lifetime &gt;100 yr</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top10} layout="vertical" margin={{ left: 16, right: 32, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => `${v} yr`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }} width={140} />
              <Tooltip content={customTooltipTop10} />
              <ReferenceLine x={10} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: '10 yr target', fill: '#fbbf24', fontSize: 10 }} />
              <Bar dataKey="lifetime" radius={[0, 4, 4, 0]}>
                {top10.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Mechanism pie */}
      {mechanismData.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Degradation Mechanism Breakdown</h3>
          <p className="text-xs text-gray-500 mb-5">For instances with finite lifetime — which mechanism limits reliability most</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={mechanismData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={{ stroke: '#4b5563' }}
              >
                {mechanismData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/* ─── SOA Charts ────────────────────────────────────────────────────────────── */

function SOACharts({ records }) {
  // Parameter frequency distribution
  const paramDist = useMemo(() => {
    const counts = {}
    for (const r of records) {
      for (const v of r.voltageEntries) {
        counts[v.param] = (counts[v.param] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [records])

  // Model frequency
  const modelDist = useMemo(() => {
    const counts = {}
    for (const r of records) {
      counts[r.model] = (counts[r.model] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))
  }, [records])

  // Duty cycle distribution buckets
  const dutyCycleBuckets = useMemo(() => {
    const buckets = { '0%': 0, '0-1%': 0, '1-10%': 0, '10-50%': 0, '>50%': 0 }
    for (const r of records) {
      for (const v of r.voltageEntries) {
        const p = v.percentValue
        if (p === 0) buckets['0%']++
        else if (p < 1) buckets['0-1%']++
        else if (p < 10) buckets['1-10%']++
        else if (p < 50) buckets['10-50%']++
        else buckets['>50%']++
      }
    }
    return Object.entries(buckets).map(([name, count]) => ({ name, count }))
  }, [records])

  const customLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return value > 0 ? (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11}>
        {value}
      </text>
    ) : null
  }

  return (
    <div className="space-y-8">
      {/* Parameter distribution bar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Voltage Parameter Violation Frequency</h3>
        <p className="text-xs text-gray-500 mb-5">Total count of each violation type across all instances</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={paramDist} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {paramDist.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Duty cycle buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Duty Cycle Distribution</h3>
          <p className="text-xs text-gray-500 mb-4">% of simulation time spent in violation</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dutyCycleBuckets} cx="50%" cy="50%" outerRadius={85} dataKey="count" labelLine={false} label={customLabel}>
                {dutyCycleBuckets.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Top Violated Model Types</h3>
          <p className="text-xs text-gray-500 mb-4">Instance count per transistor model</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={modelDist} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }} width={120} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {modelDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/* ─── Export ────────────────────────────────────────────────────────────────── */

export default function Charts({ reportData }) {
  if (reportData.type === 'TMI') return <TMICharts records={reportData.records} />
  if (reportData.type === 'SOA') return <SOACharts records={reportData.records} />
  return null
}
