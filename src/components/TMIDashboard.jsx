import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts';
import { AlertTriangle, Clock, Cpu, Activity, BarChart2 } from 'lucide-react';
import { tmiKPIs, formatLifetime } from '../parsers/tmiParser';
import KPICard from './KPICard';
import DataTable from './DataTable';
import HierarchyTree from './HierarchyTree';

const TAB_IDS = ['table', 'chart', 'hierarchy'];
const TAB_LABELS = { table: 'Data Table', chart: 'Lifetime Chart', hierarchy: 'Hierarchy' };

const TARGET_LIFETIME = 10; // years — highlight below this threshold

function ltBadge(val) {
  const num = parseFloat(val);
  if (val?.startsWith('>')) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-mono text-emerald-300 bg-emerald-950/50">
        {val}
      </span>
    );
  }
  if (!isNaN(num) && num < TARGET_LIFETIME) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-mono text-rose-300 bg-rose-950/50">
        {formatLifetime(num)}
      </span>
    );
  }
  return <span className="font-mono text-xs text-slate-300">{val}</span>;
}

const COLUMNS = [
  { key: 'rank', label: 'Rank', className: 'font-mono w-14' },
  { key: 'instance', label: 'Instance', className: 'font-mono text-xs max-w-xs truncate' },
  {
    key: 'lifetime_hci_bti',
    label: 'Lifetime (HCI+BTI)',
    render: (v) => ltBadge(v),
  },
  {
    key: 'lifetime_hci',
    label: 'Lifetime (HCI)',
    render: (v) => ltBadge(v),
  },
  {
    key: 'lifetime_bti',
    label: 'Lifetime (BTI)',
    render: (v) => ltBadge(v),
  },
  { key: 'lifetime_item', label: 'Item', className: 'text-xs text-slate-400' },
  { key: 'eol_spec', label: 'EOL Spec', className: 'text-xs text-slate-400' },
  { key: 'didsat_hci_bti', label: 'ΔIdsat HCI+BTI (%)', className: 'font-mono text-xs' },
  { key: 'dvtlin_hci_bti', label: 'ΔVtlin HCI+BTI (V)', className: 'font-mono text-xs' },
  { key: 'model', label: 'Model', className: 'text-xs text-slate-400' },
];

export default function TMIDashboard({ data }) {
  const { rows, metadata } = data;
  const kpis = useMemo(() => tmiKPIs(rows), [rows]);
  const [tab, setTab] = useState('table');

  // Top-10 worst lifetime (finite numeric only — ">100" excluded from chart)
  const chartData = useMemo(() => {
    return rows
      .filter((r) => {
        const lt = r['lifetime_hci_bti_parsed'];
        return lt && isFinite(lt.numeric) && lt.numeric !== null;
      })
      .sort((a, b) => a['lifetime_hci_bti_parsed'].numeric - b['lifetime_hci_bti_parsed'].numeric)
      .slice(0, 10)
      .map((r) => ({
        instance: r.instance.split('.').slice(-2).join('.'), // shorten label
        fullInstance: r.instance,
        lifetime: r['lifetime_hci_bti_parsed'].numeric,
        lifetimeStr: formatLifetime(r['lifetime_hci_bti_parsed'].numeric),
        belowTarget: r['lifetime_hci_bti_parsed'].numeric < TARGET_LIFETIME,
      }));
  }, [rows]);

  // Area metadata
  const areaLines = useMemo(
    () => metadata.filter((l) => /area|gate/i.test(l)).slice(0, 4),
    [metadata]
  );

  return (
    <div className="space-y-6">
      {/* Area metadata */}
      {areaLines.length > 0 && (
        <div className="bg-slate-800/30 border border-slate-700 rounded-lg px-4 py-3">
          {areaLines.map((l, i) => (
            <p key={i} className="text-slate-400 text-xs font-mono">{l}</p>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Clock}
          label="Worst Lifetime"
          value={kpis.worstLifetimeStr}
          sub={kpis.worstInstance}
          color="rose"
        />
        <KPICard
          icon={Cpu}
          label="Total Degraded Devices"
          value={kpis.totalCore}
          color="amber"
        />
        <KPICard
          icon={Activity}
          label="Dominant Mechanism"
          value={kpis.dominantMechanism}
          sub={`HCI: ${kpis.hciCount} / BTI: ${kpis.btiCount}`}
          color="cyan"
        />
        <KPICard
          icon={AlertTriangle}
          label="Below 10-yr Target"
          value={chartData.length}
          sub="instances with finite lifetime shown"
          color="violet"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        {TAB_IDS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors
              ${tab === t
                ? 'text-cyan-300 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'table' && (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          searchKeys={['instance', 'model', 'lifetime_item', 'eol_spec']}
        />
      )}

      {tab === 'chart' && (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700">
          <h3 className="text-slate-200 font-semibold mb-1 flex items-center gap-2">
            <BarChart2 size={18} className="text-cyan-400" />
            Top 10 Worst-Lifetime Instances
          </h3>
          <p className="text-slate-500 text-xs mb-4">
            Instances with &#34;&gt;100&#34; lifetime are not shown (pass). Red bars are below {TARGET_LIFETIME}-yr target.
          </p>
          {chartData.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">All instances have lifetime &gt;100 yr — no critical failures.</p>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 80, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="instance"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  label={{ value: 'Years', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(val, name, props) => [
                    props.payload.lifetimeStr,
                    'Lifetime (HCI+BTI)',
                  ]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullInstance ?? label}
                />
                <ReferenceLine
                  y={TARGET_LIFETIME}
                  stroke="#fb923c"
                  strokeDasharray="6 3"
                  label={{ value: `${TARGET_LIFETIME} yr target`, fill: '#fb923c', fontSize: 11, position: 'right' }}
                />
                <Bar dataKey="lifetime" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.belowTarget ? '#f87171' : '#22d3ee'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === 'hierarchy' && (
        <HierarchyTree
          rows={rows}
          renderRow={(r) => (
            <span>
              <span className={`font-semibold ${
                r['lifetime_hci_bti_parsed']?.numeric < TARGET_LIFETIME
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}>
                LT: {r.lifetime_hci_bti}
              </span>
              {' '}<span className="text-slate-500">{r.model}</span>
              {' '}<span className="text-slate-500">{r.lifetime_item}</span>
            </span>
          )}
        />
      )}
    </div>
  );
}
