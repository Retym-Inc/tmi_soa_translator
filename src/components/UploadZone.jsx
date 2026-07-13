import { useRef, useState, useCallback } from 'react'
import { Upload, ClipboardPaste, Cpu, AlertCircle } from 'lucide-react'
import { parseSOA } from '../parsers/soaParser.js'
import { parseTMI } from '../parsers/tmiParser.js'

function detectAndParse(text) {
  const isSOA = /Voltage_in_SOA|Safe Operation Area checked/.test(text)
  const isTMI = /TMI degradation|didsat\(HCI\+BTI/.test(text)

  // Try to extract sub-sections if both are present
  const results = []

  if (isSOA) {
    const soaResult = parseSOA(text)
    if (soaResult && soaResult.records.length > 0) results.push(soaResult)
  }
  if (isTMI) {
    const tmiResult = parseTMI(text)
    if (tmiResult && tmiResult.records.length > 0) results.push(tmiResult)
  }

  if (results.length === 0) return null
  // If only one type detected return it directly; otherwise return both
  return results.length === 1 ? results[0] : results
}

export default function UploadZone({ onLoad }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef(null)

  const process = useCallback(
    (text) => {
      setError(null)
      const result = detectAndParse(text)
      if (!result) {
        setError('Could not detect a valid SOA or TMI report in the supplied text. Please check the format.')
        return
      }
      onLoad(result)
    },
    [onLoad],
  )

  const handleFile = useCallback(
    (file) => {
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => process(e.target.result)
      reader.readAsText(file)
    },
    [process],
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const onPasteSubmit = () => {
    if (pasteText.trim()) process(pasteText)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <Cpu className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TMI / SOA Report Analyzer</h1>
          <p className="text-sm text-gray-400">Cadence Virtuoso reliability &amp; safe-operating-area analysis</p>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-4">
        {/* Drag-drop / file open zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${dragging
              ? 'border-blue-400 bg-blue-950/40'
              : 'border-gray-700 bg-gray-900/50 hover:border-blue-600 hover:bg-gray-900'}
          `}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.log,.rpt"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <Upload className={`w-10 h-10 mx-auto mb-4 ${dragging ? 'text-blue-400' : 'text-gray-500'}`} />
          <p className="text-gray-200 font-medium">Drag &amp; drop your report file here</p>
          <p className="text-gray-500 text-sm mt-1">or click to browse &mdash; <span className="text-blue-400">.txt / .log / .rpt</span></p>
          <p className="text-gray-600 text-xs mt-3">Supports SOA violation reports &amp; TMI degradation/lifetime reports</p>
        </div>

        {/* Paste zone toggle */}
        <button
          onClick={() => { setPasting((p) => !p); setError(null) }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 bg-gray-900/50 text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm"
        >
          <ClipboardPaste className="w-4 h-4" />
          {pasting ? 'Hide paste area' : 'Or paste report text directly'}
        </button>

        {pasting && (
          <div className="space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste the full SOA or TMI report text here…"
              rows={10}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y"
            />
            <button
              onClick={onPasteSubmit}
              disabled={!pasteText.trim()}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-medium transition-colors text-sm"
            >
              Analyze Report
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 bg-red-950/50 border border-red-800 rounded-xl p-4 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
