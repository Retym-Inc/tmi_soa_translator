export default function KPICard({ icon: Icon, label, value, sub, color = 'cyan' }) {
  const colorMap = {
    cyan: 'border-cyan-700 bg-cyan-950/40 text-cyan-300',
    amber: 'border-amber-700 bg-amber-950/40 text-amber-300',
    rose: 'border-rose-700 bg-rose-950/40 text-rose-300',
    emerald: 'border-emerald-700 bg-emerald-950/40 text-emerald-300',
    violet: 'border-violet-700 bg-violet-950/40 text-violet-300',
  };
  const cls = colorMap[color] ?? colorMap.cyan;

  return (
    <div className={`border rounded-xl p-5 ${cls} flex items-start gap-4`}>
      {Icon && (
        <div className="mt-1 shrink-0">
          <Icon size={28} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-slate-400 text-xs uppercase tracking-widest font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-1 truncate" title={value}>{value}</p>
        {sub && <p className="text-slate-400 text-xs mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}
