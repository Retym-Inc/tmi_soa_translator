import { useRef, useState } from 'react';
import { Upload, ClipboardPaste, FileText } from 'lucide-react';

export default function UploadZone({ onData }) {
  const [dragging, setDragging] = useState(false);
  const [pasting, setPasting] = useState(false);
  const textRef = useRef(null);

  function handleText(text) {
    if (text?.trim()) onData(text);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => handleText(ev.target.result);
      reader.readAsText(file);
    } else {
      handleText(e.dataTransfer.getData('text'));
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleText(ev.target.result);
    reader.readAsText(file);
  }

  function handlePasteSubmit() {
    handleText(textRef.current?.value);
  }

  return (
    <div className="space-y-4">
      {/* Drag-and-drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
          ${dragging
            ? 'border-cyan-400 bg-cyan-950/30'
            : 'border-slate-600 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/60'}
        `}
      >
        <input
          type="file"
          accept=".txt,.log,.rpt,*"
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <Upload className="mx-auto mb-3 text-cyan-400" size={40} />
        <p className="text-slate-200 font-semibold text-lg">Drop your report file here</p>
        <p className="text-slate-400 text-sm mt-1">or click to browse — supports .txt, .log, .rpt</p>
      </div>

      {/* Paste area toggle */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-700" />
        <button
          onClick={() => setPasting((p) => !p)}
          className="flex items-center gap-2 text-slate-400 hover:text-cyan-300 text-sm transition-colors"
        >
          <ClipboardPaste size={16} />
          {pasting ? 'Hide paste area' : 'Paste report text instead'}
        </button>
        <div className="flex-1 border-t border-slate-700" />
      </div>

      {pasting && (
        <div className="space-y-2">
          <textarea
            ref={textRef}
            rows={12}
            placeholder="Paste your SOA or TMI report text here…"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-200
                       font-mono text-xs resize-y focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
          <button
            onClick={handlePasteSubmit}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white
                       font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            <FileText size={16} />
            Analyze Report
          </button>
        </div>
      )}
    </div>
  );
}
