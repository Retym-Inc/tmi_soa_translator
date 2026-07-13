import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Cpu } from 'lucide-react';

/**
 * Build a hierarchical tree from a flat list of instances.
 * Instance paths use "." as separator.
 */
function buildTree(rows, getKey) {
  const root = {};

  for (const row of rows) {
    const parts = row.instance.split('.');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node[part]) {
        node[part] = { __children: {}, __rows: [] };
      }
      if (i === parts.length - 1) {
        node[part].__rows.push(row);
      }
      node = node[part].__children;
    }
  }

  return root;
}

function TreeNode({ name, node, depth, renderRow }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = Object.keys(node.__children).length > 0;
  const rowData = node.__rows ?? [];
  const indent = depth * 16;

  return (
    <div>
      {/* Branch header */}
      <div
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 py-1.5 px-2 hover:bg-slate-800/50 cursor-pointer
                   rounded transition-colors text-slate-300"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {hasChildren ? (
          open ? <ChevronDown size={14} className="text-cyan-400 shrink-0" />
               : <ChevronRight size={14} className="text-slate-400 shrink-0" />
        ) : (
          <Cpu size={14} className="text-slate-500 shrink-0" />
        )}
        <span className="font-mono text-sm">{name}</span>
        {rowData.length > 0 && (
          <span className="ml-1 text-xs text-amber-400 font-semibold">
            ({rowData.length} violation{rowData.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* Leaf row details */}
      {open && rowData.map((r, i) => (
        <div
          key={i}
          style={{ paddingLeft: `${24 + indent}px` }}
          className="py-1 text-xs text-slate-400 border-l border-slate-700 ml-4"
        >
          {renderRow(r)}
        </div>
      ))}

      {/* Children */}
      {open && Object.entries(node.__children).map(([childName, childNode]) => (
        <TreeNode
          key={childName}
          name={childName}
          node={childNode}
          depth={depth + 1}
          renderRow={renderRow}
        />
      ))}
    </div>
  );
}

export default function HierarchyTree({ rows, renderRow }) {
  const tree = useMemo(() => buildTree(rows, (r) => r.instance), [rows]);

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-auto max-h-[60vh] p-2">
      {Object.entries(tree).map(([name, node]) => (
        <TreeNode
          key={name}
          name={name}
          node={node}
          depth={0}
          renderRow={renderRow}
        />
      ))}
    </div>
  );
}
