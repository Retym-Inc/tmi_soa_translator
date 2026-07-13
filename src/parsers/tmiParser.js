/**
 * TMI (Thermal / Mechanical Integrity) degradation & lifetime report parser.
 *
 * Parses Cadence Virtuoso TMI reliability simulation reports.
 * Lifetime values may be numeric (scientific notation) or bounded (">100").
 */

/**
 * Convert a raw lifetime string to a comparable number.
 *   ">100"  → Infinity
 *   "4.667e-04" → 0.0004667
 *   anything else → null
 */
export function parseLifetimeValue(str) {
  if (!str) return null
  const s = str.trim()
  if (s.startsWith('>')) return Infinity
  const val = parseFloat(s)
  return isNaN(val) ? null : val
}

/**
 * Format a lifetime in years to a human-readable string.
 */
export function formatLifetimeYears(years) {
  if (years === null || years === undefined) return '-'
  if (!isFinite(years) || years > 100) return '>100 yr'
  if (years >= 1) return `${years.toFixed(3)} yr`
  const days = years * 365.25
  if (days >= 1) return `${days.toFixed(1)} days`
  const hours = days * 24
  if (hours >= 1) return `${hours.toFixed(2)} hr`
  const minutes = hours * 60
  return `${minutes.toFixed(2)} min`
}

/**
 * Parse a full TMI report text.
 * Returns null if the text does not look like a TMI report.
 *
 * Expected columns (17 total, whitespace-separated):
 *   Rank Instance
 *   didsat(HCI+BTI,%) didlin(HCI+BTI,%) dvtlin(HCI+BTI,V)
 *   didsat(HCI,%)     didlin(HCI,%)     dvtlin(HCI,V)
 *   didsat(BTI,%)     didlin(BTI,%)     dvtlin(BTI,V)
 *   lifetime(HCI+BTI,yr) lifetime(HCI,yr) lifetime(BTI,yr)
 *   lifetime_item EOL_spec Model
 */
export function parseTMI(text) {
  const lines = text.split('\n')

  // Locate the column-header line (contains "didsat(HCI")
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/\bRank\b.*\bInstance\b.*didsat\(HCI/.test(lines[i])) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return null

  // Extract metadata from pre-header section
  const metadata = {}
  for (let i = 0; i < headerIdx; i++) {
    const l = lines[i]
    const coreM = l.match(/Area sum of (\d+) Core devices/)
    if (coreM) metadata.coreDeviceCount = parseInt(coreM[1], 10)

    const ioM = l.match(/Area sum of (\d+) IO devices/)
    if (ioM) metadata.ioDeviceCount = parseInt(ioM[1], 10)

    const coreAreaM = l.match(/Effective_Core_gate_area_by_TMI\s*=\s*([\d.eE+\-]+)\s*um/)
    if (coreAreaM) metadata.effectiveCoreArea = `${coreAreaM[1]} µm²`

    const sumDageM = l.match(/^Sum dageTime\s*=\s*([\d.]+\s*yr)/)
    if (sumDageM) metadata.sumDageTime = sumDageM[1].trim()

    const dageM = l.match(/^dageTime\s*=\s*([\d.]+\s*yr)/)
    if (dageM && !metadata.dageTime) metadata.dageTime = dageM[1].trim()
  }

  const records = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('*') || line.startsWith('[') || line.startsWith(']')) continue

    // Skip the "VV" marker line that sometimes precedes the header
    if (line === 'VV') continue

    const tokens = line.split(/\s+/)
    // Expect exactly 17 tokens: rank + instance + 9 degradation + 3 lifetime + lifetime_item + eol + model
    if (tokens.length < 17) continue

    const rank = parseInt(tokens[0], 10)
    if (isNaN(rank)) continue

    const instance            = tokens[1]
    const didsat_hci_bti      = tokens[2]
    const didlin_hci_bti      = tokens[3]
    const dvtlin_hci_bti      = tokens[4]
    const didsat_hci          = tokens[5]
    const didlin_hci          = tokens[6]
    const dvtlin_hci          = tokens[7]
    const didsat_bti          = tokens[8]
    const didlin_bti          = tokens[9]
    const dvtlin_bti          = tokens[10]
    const lifetime_hci_bti_raw = tokens[11]
    const lifetime_hci_raw    = tokens[12]
    const lifetime_bti_raw    = tokens[13]
    const lifetime_item       = tokens[14]
    const eol_spec            = tokens[15]
    // Model may itself contain dots but no spaces — take the rest joined back
    const model               = tokens.slice(16).join(' ')

    const lifetimeHCIBTI = parseLifetimeValue(lifetime_hci_bti_raw)
    const lifetimeHCI    = parseLifetimeValue(lifetime_hci_raw)
    const lifetimeBTI    = parseLifetimeValue(lifetime_bti_raw)

    records.push({
      id: `${rank}-${instance}-${i}`,
      rank,
      instance,
      didsat_hci_bti, didlin_hci_bti, dvtlin_hci_bti,
      didsat_hci,     didlin_hci,     dvtlin_hci,
      didsat_bti,     didlin_bti,     dvtlin_bti,
      lifetime_hci_bti_raw, lifetime_hci_raw, lifetime_bti_raw,
      lifetimeHCIBTI, lifetimeHCI, lifetimeBTI,
      lifetime_item,
      eol_spec,
      model,
    })
  }

  return { type: 'TMI', records, metadata }
}
