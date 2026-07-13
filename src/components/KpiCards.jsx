import { useMemo } from 'react'
import { AlertTriangle, Clock, Zap, Layers, Activity, TrendingDown, ShieldAlert, Timer } from 'lucide-react'
import { formatLifetimeYears } from '../parsers/tmiParser.js'

function Card({ icon: Icon, label, value, sub, accent = 'blue', danger = false }) {
  const accentMap = {
    blue:   'text-blue-400   border-blue-900  bg-blue-950/30',
    red:    'text-red-400    border-red-900   bg-red-950/30',
    yellow: 'text-yellow-400 border-yellow-900 bg-yellow-950/30',
    green:  'text-green-400  border-green-900 bg-green-950/30',
    purple: 'text-purple-400 border-purple-900 bg-purple-950/30',
    orange: 'text-orange-400 border-orange-900 bg-orange-950/30',
  }
  const cls = accentMap[accent] || accentMap.blue
  return (
    <div className={`rounded-xl border p-5 ${cls} flex flex-col gap-2`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-80">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`text-2xl font-bold ${danger ? 'text-red-300' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs opacity-60 truncate">{sub}</div>}
    </div>
  )
}

function SOAKpis({ records }) {
  const stats = useMemo(() => {
    const totalViolations = records.length
    const modelCounts = {}
    const paramCounts = {}
    let worstDuration = 0
    let worstPercent = 0
    let worstDurationInst = ''

    for (const r of records) {
      modelCounts[r.model] = (modelCounts[r.model] || 0) + 1
      for (const v of r.voltageEntries) {
        paramCounts[v.param] = (paramCounts[v.param] || 0) + 1
        if (v.durationValue > worstDuration) {
          worstDuration = v.durationValue
          worstDurationInst = r.instance
        }
        if (v.percentValue > worstPercent) worstPercent = v.percentValue
      }
    }

    const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]
    const topParam = Object.entries(paramCounts).sort((a, b) => b[1] - a[1])[0]

    // Format duration: e.g. 2.29e-8 → "22.9 ns"
    const fmtDuration = (s) => {
      if (s >= 1) return `${s.toFixed(3)} s`
      if (s >= 1e-3) return `${(s * 1e3).toFixed(3)} ms`
      if (s >= 1e-6) return `${(s * 1e6).toFixed(3)} µs`
      if (s >= 1e-9) return `${(s * 1e9).toFixed(3)} ns`
      if (s >= 1e-12) return `${(s * 1e12).toFixed(3)} ps`
      return `${s.toExponential(3)} s`
    }

    return { totalViolations, topModel, topParam, worstDuration, worstPercent, worstDurationInst, fmtDuration }
  }, [records])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card icon={AlertTriangle} label="Total Violations" value={stats.totalViolations} accent="red" />
      <Card
        icon={Layers}
        label="Top Violated Model"
        value={stats.topModel?.[0] ?? '-'}
        sub={`${stats.topModel?.[1] ?? 0} instances`}
        accent="orange"
      />
      <Card
        icon={Clock}
        label="Worst Stress Duration"
        value={stats.fmtDuration(stats.worstDuration)}
        sub={stats.worstDurationInst}
        accent="yellow"
      />
      <Card
        icon={Zap}
        label="Top Violated Parameter"
        value={stats.topParam?.[0] ?? '-'}
        sub={`${stats.topParam?.[1] ?? 0} occurrences`}
        accent="purple"
      />
    </div>
  )
}

function TMIKpis({ records }) {
  const stats = useMemo(() => {
    const finite = records.filter((r) => isFinite(r.lifetimeHCIBTI) && r.lifetimeHCIBTI !== null)
    const sorted = [...finite].sort((a, b) => a.lifetimeHCIBTI - b.lifetimeHCIBTI)
    const shortest = sorted[0]
    const belowTarget = finite.filter((r) => r.lifetimeHCIBTI < 10).length
    const totalAnalyzed = records.length

    // Dominant mechanism: compare how many instances where HCI < BTI (HCI dominant) vs BTI < HCI
    let hciDomCount = 0, btiDomCount = 0
    for (const r of records) {
      const h = isFinite(r.lifetimeHCI) ? r.lifetimeHCI : 1e9
      const b = isFinite(r.lifetimeBTI) ? r.lifetimeBTI : 1e9
      if (h < b) hciDomCount++
      else if (b < h) btiDomCount++
    }
    const dominant = hciDomCount > btiDomCount ? 'HCI' : hciDomCount < btiDomCount ? 'BTI' : 'Mixed'

    return { shortest, belowTarget, totalAnalyzed, dominant, hciDomCount, btiDomCount }
  }, [records])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        icon={TrendingDown}
        label="Shortest Lifetime"
        value={formatLifetimeYears(stats.shortest?.lifetimeHCIBTI ?? null)}
        sub={stats.shortest?.instance ?? 'N/A'}
        accent="red"
        danger
      />
      <Card
        icon={ShieldAlert}
        label="Devices Below 10 yr"
        value={stats.belowTarget}
        sub="lifetime(HCI+BTI) < 10 yr"
        accent="orange"
      />
      <Card
        icon={Activity}
        label="Dominant Mechanism"
        value={stats.dominant}
        sub={`HCI: ${stats.hciDomCount} · BTI: ${stats.btiDomCount}`}
        accent="yellow"
      />
      <Card
        icon={Timer}
        label="Total Analyzed"
        value={stats.totalAnalyzed}
        sub="device instances"
        accent="blue"
      />
    </div>
  )
}

export default function KpiCards({ reportData }) {
  if (reportData.type === 'SOA') return <SOAKpis records={reportData.records} />
  if (reportData.type === 'TMI') return <TMIKpis records={reportData.records} />
  return null
}
