import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { AlertTriangle, Clock, Cpu, BarChart2 } from 'lucide-react';
import { soaKPIs } from '../parsers/soaParser';
import KPICard from './KPICard';
import DataTable from './DataTable';
import HierarchyTree from './HierarchyTree';

const TAB_IDS = ['table', 'chart', 'hierarchy'];
const TAB_LABELS = { table: 'Data Table', chart: 'Charts', hierarchy: 'Hierarchy' };

const PARAM_COLORS = {
  Vgs: '#22d3ee',
  Vgd: '#818cf8',
  '|Vds|': '#fb7185',
  Vgsr: '#34d399',
  Vgdr: '#fbbf24',
  Vbsr: '#f472b6',
  Vbdr: '#a78bfa',
};
function paramColor(p) {
  return PARAM_COLORS[p] ?? '#94a3b8';
}

// Flatten violations for table display
function flattenRows(rows) {
  return rows.flatMap((r) =>
    r.violations.map((v) => ({
      rank: r.rank,
      instance: r.instance,
      model: r.model,
      param: v.param,
      condition: v.condition,
      range: v.range,
      duration: v.duration,
      duty: v.duty,
    }))
  );
}

const COLUMNS = [
  { key: 'rank', label: 'Rank', className: 'font-mono w-14' },
  { key: 'instance', label: 'Instance', className: 'font-mono text-xs max-w-xs truncate' },
  {
    key: 'param',
    label: 'Parameter',
    render: (v) => (
      <span
        className="px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ background: paramColor(v) + '33', color: paramColor(v) }}
      >
        {v}
      </span>
    ),
  },
  { key: 'condition', label: 'Condition', className: 'text-xs' },
  { key: 'range', label: 'Voltage Range', className: 'font-mono text-xs' },
  { key: 'duration', label: 'Stress Duration', className: 'font-mono text-xs' },
  { key: 'duty', label: 'Duty Cycle' },
  { key: 'model', label: 'Model', className: 'text-xs text-slate-400' },
];

export default function SOADashboard({ data }) {
  const { rows } = data;
  const kpis = useMemo(() => soaKPIs(rows), [rows]);
  const flatRows = useMemo(() => flattenRows(rows), [rows]);
  const [tab, setTab] = useState('table');

  // Chart data: param distribution
  const chartData = useMemo(
    () =>
      Object.entries(kpis.paramCount)
        .map(([param, count]) => ({ param, count }))
        .sort((a, b) => b.count - a.count),
    [kpis]
  );

  // Model distribution chart
  const modelData = useMemo(
    () =>
      Object.entries(kpis.modelCount)
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    [kpis]
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          icon={AlertTriangle}
          label="Total Violated Instances"
          value={kpis.totalInstances}
          color="rose"
        />
        <KPICard
          icon={Cpu}
          label="Most Violated Model"
          value={kpis.mostViolatedModel}
          sub={`${kpis.modelCount[kpis.mostViolatedModel] ?? 0} instances`}
          color="amber"
        />
        <KPICard
          icon={Clock}
          label="Worst Stress Duration"
          value={kpis.worstDurationStr}
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
          rows={flatRows}
          searchKeys={['instance', 'model', 'param', 'condition']}
        />
      )}

      {tab === 'chart' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Param distribution */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700">
            <h3 className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
              <BarChart2 size={18} className="text-cyan-400" />
              Voltage Parameter Distribution
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="param"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  angle={-35}
                  textAnchor="end"
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.param} fill={paramColor(entry.param)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 models */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700">
            <h3 className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
              <BarChart2 size={18} className="text-amber-400" />
              Top 10 Violated Models
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={modelData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  dataKey="model"
                  type="category"
                  width={120}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'hierarchy' && (
        <HierarchyTree
          rows={rows}
          renderRow={(r) => (
            <span>
              {r.violations.map((v, i) => (
                <span key={i} className="mr-3">
                  <span style={{ color: paramColor(v.param) }} className="font-semibold">{v.param}</span>
                  {' '}<span className="text-slate-500">{v.range}</span>
                  {' '}<span className="text-amber-400">{v.duty}</span>
                </span>
              ))}
              <span className="text-slate-500 ml-1">{r.model}</span>
            </span>
          )}
        />
      )}
    </div>
  );
}
