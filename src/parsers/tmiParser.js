/**
 * TMI (Transistor-level Macro-model Integrity) degradation & lifetime report parser.
 *
 * Parses Cadence Virtuoso TMI reports.
 * Header row is identified by "Rank" + "didsat" columns.
 * Lifetime values can be scientific notation floats or ">100" style bounds.
 */

const TMI_COLS = [
  'rank',
  'instance',
  'didsat_hci_bti',
  'didlin_hci_bti',
  'dvtlin_hci_bti',
  'didsat_hci',
  'didlin_hci',
  'dvtlin_hci',
  'didsat_bti',
  'didlin_bti',
  'dvtlin_bti',
  'lifetime_hci_bti',
  'lifetime_hci',
  'lifetime_bti',
  'lifetime_item',
  'eol_spec',
  'model',
];

/**
 * Parse a lifetime value.
 * Returns { raw, numeric, isBound } where numeric is Infinity for ">N" values.
 */
export function parseLifetime(val) {
  const s = String(val).trim();
  if (s.startsWith('>')) {
    return { raw: s, numeric: Infinity, isBound: true };
  }
  const num = parseFloat(s);
  return { raw: s, numeric: isNaN(num) ? null : num, isBound: false };
}

/**
 * Format a lifetime numeric value to a human-readable string.
 * @param {number} yr  - years
 */
export function formatLifetime(yr) {
  if (!isFinite(yr)) return '>100 yr';
  if (yr >= 1) return `${yr.toFixed(2)} yr`;
  if (yr >= 1 / 12) return `${(yr * 12).toFixed(2)} mo`;
  if (yr >= 1 / 365) return `${(yr * 365).toFixed(1)} d`;
  return `${(yr * 8760).toFixed(1)} hr`;
}

/**
 * Split a TMI table row by whitespace, being careful about the Instance column
 * which uses dots (no spaces) but may be very long.
 * The report uses multiple spaces as delimiters.
 */
function splitTMIRow(line) {
  // Split on 2+ spaces to handle wide columns
  return line.trim().split(/\s{2,}/).map((f) => f.trim()).filter(Boolean);
}

/**
 * Parse a TMI report text and return structured data.
 * @param {string} text - raw report text
 * @returns {{ metadata: string[], rows: Array }}
 */
export function parseTMI(text) {
  const lines = text.split('\n');
  const metadata = [];
  const rows = [];
  let headerFound = false;
  let colCount = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Detect header row: contains "Rank" and "didsat"
    if (!headerFound && /Rank\s+Instance/i.test(line) && /didsat/i.test(line)) {
      headerFound = true;
      colCount = TMI_COLS.length;
      continue;
    }

    // Skip the "VV" marker line that some reports include
    if (/^\s*VV\s*$/.test(line)) continue;

    if (!headerFound) {
      metadata.push(line);
      continue;
    }

    const fields = splitTMIRow(raw);
    // Need at least rank + instance + a few numeric cols
    if (fields.length < 4) continue;
    // Skip lines that look like sub-headers
    if (/^Rank\s/i.test(fields[0])) continue;

    // Map fields to column names
    const obj = {};
    TMI_COLS.forEach((col, i) => {
      obj[col] = fields[i] ?? '';
    });

    obj.rank = Number(obj.rank) || obj.rank;

    // Parse lifetime fields
    ['lifetime_hci_bti', 'lifetime_hci', 'lifetime_bti'].forEach((k) => {
      obj[k + '_parsed'] = parseLifetime(obj[k]);
    });

    rows.push(obj);
  }

  return { metadata, rows };
}

/**
 * Compute TMI summary KPIs from parsed rows.
 */
export function tmiKPIs(rows) {
  // Shortest (worst) lifetime
  let worstLifetime = Infinity;
  let worstInstance = '–';
  let totalCore = 0;
  let hciCount = 0;
  let btiCount = 0;

  for (const r of rows) {
    totalCore++;
    const lt = r['lifetime_hci_bti_parsed']?.numeric;
    if (lt !== null && lt < worstLifetime) {
      worstLifetime = lt;
      worstInstance = r.instance;
    }

    // Dominant mechanism: compare HCI vs BTI lifetime (lower = worse = dominant)
    const hci = r['lifetime_hci_parsed']?.numeric ?? Infinity;
    const bti = r['lifetime_bti_parsed']?.numeric ?? Infinity;
    if (hci < bti) hciCount++;
    else btiCount++;
  }

  const worstLifetimeStr =
    worstLifetime === Infinity ? '>100 yr' : formatLifetime(worstLifetime);
  const dominantMechanism = hciCount >= btiCount ? 'HCI' : 'BTI';

  return {
    worstLifetimeStr,
    worstInstance,
    totalCore,
    dominantMechanism,
    hciCount,
    btiCount,
  };
}
