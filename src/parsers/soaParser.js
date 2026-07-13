/**
 * SOA (Safe Operation Area) report parser.
 *
 * Parses Cadence Virtuoso SOA violation reports.
 * Data format: tab-separated rows where the Voltage_in_SOA column
 * contains multiple parenthesised sub-entries.
 */

/**
 * Parse a single voltage violation entry, e.g.
 *   "(Vgs as Vgs > 0.96V, 0.96V~1.7768V, 8.58e-11s, 0.29%)"
 */
export function parseVoltageEntry(entry) {
  const inner = entry.trim()
  if (!inner.startsWith('(') || !inner.endsWith(')')) return null
  const content = inner.slice(1, -1)

  const asIdx = content.indexOf(' as ')
  if (asIdx === -1) return null

  const param = content.slice(0, asIdx).trim()
  const rest = content.slice(asIdx + 4)

  // Split on ", " — last 3 parts are always: range, duration, percent%
  const parts = rest.split(', ')
  if (parts.length < 4) return null

  const n = parts.length
  const percentStr = parts[n - 1]
  const durationStr = parts[n - 2]
  const rangeStr = parts[n - 3]
  const condition = parts.slice(0, n - 3).join(', ')

  const durationValue = parseFloat(durationStr) // seconds, may be e.g. 8.58e-11
  const percentValue = parseFloat(percentStr)

  return {
    param,        // e.g. "Vgs", "|Vds|", "Vgsr"
    condition,    // e.g. "Vgs > 0.96V"
    range: rangeStr,       // e.g. "0.96V~1.7768V"
    duration: durationStr, // e.g. "8.58e-11s"
    percent: percentStr,   // e.g. "0.29%"
    durationValue: isNaN(durationValue) ? 0 : durationValue,
    percentValue: isNaN(percentValue) ? 0 : percentValue,
  }
}

/**
 * Parse a full SOA report text.
 * Returns null if the text does not look like an SOA report.
 */
export function parseSOA(text) {
  const lines = text.split('\n')

  // Locate the column-header line
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/\bRank\b.*\bInstance\b.*\bVoltage_in_SOA\b/.test(lines[i])) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return null

  // Extract metadata from pre-header lines
  const metadata = {}
  for (let i = 0; i < headerIdx; i++) {
    const l = lines[i]
    const m = l.match(/soa_sorting_num is set to (\d+)/)
    if (m) metadata.sortingNum = parseInt(m[1], 10)
  }

  const records = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Rows are tab-separated
    const parts = line.split('\t')
    if (parts.length < 3) continue

    const rank = parseInt(parts[0].trim(), 10)
    if (isNaN(rank)) continue

    const instance = parts[1].trim()

    // Last part that doesn't start with '(' is the model
    let modelIdx = parts.length - 1
    while (modelIdx > 2 && parts[modelIdx].trim().startsWith('(')) modelIdx--
    const model = parts[modelIdx].trim()

    const voltageEntries = []
    for (let j = 2; j < parts.length; j++) {
      if (j === modelIdx) continue
      const e = parts[j].trim()
      if (e.startsWith('(')) {
        const parsed = parseVoltageEntry(e)
        if (parsed) voltageEntries.push(parsed)
      }
    }

    if (!instance || voltageEntries.length === 0) continue

    const worstDuration = Math.max(...voltageEntries.map((v) => v.durationValue))
    const worstPercent = Math.max(...voltageEntries.map((v) => v.percentValue))

    records.push({
      id: `${rank}-${instance}-${i}`,
      rank,
      instance,
      voltageEntries,
      model,
      worstDuration,
      worstPercent,
    })
  }

  return { type: 'SOA', records, metadata }
}
