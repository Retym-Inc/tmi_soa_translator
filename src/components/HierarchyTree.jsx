import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, FolderOpen, Folder, Cpu } from 'lucide-react'
import { formatLifetimeYears } from '../parsers/tmiParser.js'

/* ─── Build tree from dotted instance paths ─────────────────────────────────── */

function buildTree(records, type) {
  const root = { children: {}, records: [] }

  for (const rec of records) {
    const parts = rec.instance.split('.')
    let node = root
    for (const part of parts) {
      if (!node.children[part]) {
        node.children[part] = { name: part, children: {}, records: [], path: '' }
      }
      node = node.children[part]
    }
    node.records.push(rec)
  }

  // Assign full paths
  function annotate(node, path) {
    node.path = path
    for (const [key, child] of Object.entries(node.children)) {
      annotate(child, path ? `${path}.${key}` : key)
    }
  }
  for (const [key, child] of Object.entries(root.children)) {
    annotate(child, key)
  }

  return root
}

/* ─── Summary badge for a subtree ────────────────────────────────────────────── */

function subtreeSummary(node, type) {
  let directCount = node.records.length
  let childCount = 0
  for (const child of Object.values(node.children)) {
    childCount += countAll(child)
  }
  const total = directCount + childCount
  return total
}

function countAll(node) {
  return node.records.length + Object.values(node.children).reduce((s, c) => s + countAll(c), 0)
}

function worstLifetime(node) {
  let worst = Infinity
  for (const r of node.records) {
    if (r.lifetimeHCIBTI !== null && r.lifetimeHCIBTI < worst) worst = r.lifetimeHCIBTI
  }
  for (const child of Object.values(node.children)) {
    const w = worstLifetime(child)
    if (w < worst) worst = w
  }
  return worst
}

function worstPercent(node) {
  let worst = 0
  for (const r of node.records) {
    if (r.worstPercent > worst) worst = r.worstPercent
  }
  for (const child of Object.values(node.children)) {
    const w = worstPercent(child)
    if (w > worst) worst = w
  }
  return worst
}

/* ─── Tree node component ────────────────────────────────────────────────────── */

function TreeNode({ node, depth, type, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 2)
  const hasChildren = Object.keys(node.children).length > 0
  const total = subtreeSummary(node, type)

  const isLeaf = !hasChildren && node.records.length > 0

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-gray-800/60 transition-colors group`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Icon */}
        {isLeaf
          ? <Cpu className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          : expanded
            ? <FolderOpen className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
            : <Folder className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
        }

        {/* Name */}
        <span className="font-mono text-xs text-gray-200 truncate">{node.name}</span>

        {/* Count badge */}
        <span className="ml-auto text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded group-hover:bg-gray-700">
          {total}
        </span>

        {/* Type-specific quick-stat */}
        {type === 'TMI' && (() => {
          const w = worstLifetime(node)
          if (!isFinite(w)) return null
          const cls = w < 1 ? 'text-red-400' : w < 10 ? 'text-orange-400' : 'text-green-400'
          return <span className={`text-xs font-mono ${cls}`}>{formatLifetimeYears(w)}</span>
        })()}

        {type === 'SOA' && (() => {
          const p = worstPercent(node)
          if (!p) return null
          const cls = p > 50 ? 'text-red-400' : p > 10 ? 'text-orange-400' : 'text-yellow-400'
          return <span className={`text-xs font-mono ${cls}`}>{p.toFixed(2)}%</span>
        })()}
      </div>

      {/* Direct records */}
      {expanded && node.records.map((r) => (
        <RecordRow key={r.id} rec={r} depth={depth + 1} type={type} />
      ))}

      {/* Children */}
      {expanded && Object.values(node.children).map((child) => (
        <TreeNode key={child.name} node={child} depth={depth + 1} type={type} />
      ))}
    </div>
  )
}

function RecordRow({ rec, depth, type }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-800/40 cursor-pointer transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="w-3 h-3 text-gray-600 shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />}
        <span className="w-3 shrink-0" />
        <span className="font-mono text-[11px] text-blue-400 truncate">{rec.instance.split('.').pop()}</span>
        <span className="font-mono text-[11px] text-gray-600 ml-1">{rec.model}</span>

        {type === 'TMI' && (() => {
          const cls = isFinite(rec.lifetimeHCIBTI)
            ? rec.lifetimeHCIBTI < 1 ? 'text-red-400' : rec.lifetimeHCIBTI < 10 ? 'text-orange-400' : 'text-green-400'
            : 'text-gray-500'
          return (
            <span className={`ml-auto text-[11px] font-mono ${cls}`}>
              {formatLifetimeYears(rec.lifetimeHCIBTI)}
            </span>
          )
        })()}

        {type === 'SOA' && (
          <span className="ml-auto text-[11px] font-mono text-orange-400">
            {rec.voltageEntries.length} violations
          </span>
        )}
      </div>

      {open && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 mx-4 mb-2 p-3" style={{ marginLeft: `${depth * 16 + 24}px` }}>
          {type === 'TMI' ? (
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              {[
                ['HCI+BTI', rec.lifetime_hci_bti_raw, rec.lifetimeHCIBTI],
                ['HCI',     rec.lifetime_hci_raw,     rec.lifetimeHCI],
                ['BTI',     rec.lifetime_bti_raw,     rec.lifetimeBTI],
              ].map(([label, raw, val]) => {
                const cls = isFinite(val) ? val < 1 ? 'text-red-400' : val < 10 ? 'text-orange-400' : 'text-green-400' : 'text-gray-500'
                return (
                  <div key={label} className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-500 text-[10px] mb-1">{label}</div>
                    <div className={cls}>{formatLifetimeYears(val)}</div>
                    <div className="text-gray-600 text-[10px]">{raw}</div>
                  </div>
                )
              })}
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-gray-500 text-[10px] mb-1">Item</div>
                <div className="text-gray-300">{rec.lifetime_item}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-gray-500 text-[10px] mb-1">EOL Spec</div>
                <div className="text-gray-300">{rec.eol_spec}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {rec.voltageEntries.map((v, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  <span className="text-blue-400">{v.param}</span>
                  <span className="text-gray-600">as</span>
                  <span className="text-gray-300">{v.condition}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-teal-400">{v.range}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-yellow-400">{v.duration}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-orange-400">{v.percent}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function HierarchyTree({ reportData }) {
  const tree = useMemo(() => buildTree(reportData.records, reportData.type), [reportData])

  const topNodes = Object.values(tree.children)

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
      <div className="text-xs text-gray-500 mb-4">
        Hierarchical view grouped by schematic path.
        <span className="ml-2 text-gray-600">Click nodes to expand · click instances for details.</span>
      </div>
      {topNodes.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-8">No hierarchy data</p>
      ) : (
        <div className="space-y-0.5">
          {topNodes.map((node) => (
            <TreeNode key={node.name} node={node} depth={0} type={reportData.type} defaultExpanded />
          ))}
        </div>
      )}
    </div>
  )
}
