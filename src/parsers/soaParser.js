/**
 * SOA (Safe Operating Area) report parser.
 *
 * Parses Cadence Virtuoso SOA violation reports.
 * Each data row has the form:
 *   <Rank>  <Instance>  (<param> as <cond>, <range>, <duration>, <duty%>)...  <Model>
 *
 * Multiple violation tuples appear between Instance and Model, separated by tabs.
 */

const VIOLATION_RE =
  /\(([^,)]+)\s+as\s+([^,)]+),\s*([^,)]+),\s*([^,)]+s),\s*([^)]+%)\)/g;

/**
 * Parse a single violation token string such as:
 *   "(Vgs as Vgs > 0.96V, 0.96V~1.7768V, 8.58e-11s, 0.29%)"
 * Returns { param, condition, range, duration, duty }.
 */
function parseViolation(token) {
  const m = /\(([^,)]+)\s+as\s+([^,)]+),\s*([^,)]+),\s*([^,)]+s),\s*([^)]+%)\)/.exec(
    token
  );
  if (!m) return null;
  return {
    param: m[1].trim(),
    condition: m[2].trim(),
    range: m[3].trim(),
    duration: m[4].trim(),
    duty: m[5].trim(),
  };
}

/**
 * Split a table row into fields, respecting parenthesised groups.
 * Fields are separated by tabs (the format uses \t between columns).
 */
function splitRow(line) {
  return line.split('\t').map((f) => f.trim()).filter(Boolean);
}

/**
 * Parse an SOA report text and return structured data.
 * @param {string} text - raw report text
 * @returns {{ metadata: string[], rows: Array }}
 */
export function parseSOA(text) {
  const lines = text.split('\n');
  const metadata = [];
  const rows = [];
  let tableStarted = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Detect header row
    if (/^Rank\s+Instance\s+Voltage_in_SOA/i.test(line)) {
      tableStarted = true;
      continue;
    }

    if (!tableStarted) {
      metadata.push(line);
      continue;
    }

    // Data rows – split by tab
    const fields = splitRow(raw);
    if (fields.length < 3) continue;

    const rank = fields[0];
    // Instance is always second field (no spaces in instance path)
    const instance = fields[1];
    // Last field is the Model (no parentheses)
    const model = fields[fields.length - 1];
    // Middle fields are violation tuples
    const violationTokens = fields.slice(2, -1);
    const violations = violationTokens
      .map((t) => parseViolation(t))
      .filter(Boolean);

    rows.push({ rank: Number(rank) || rank, instance, violations, model });
  }

  return { metadata, rows };
}

/**
 * Compute SOA summary KPIs from parsed rows.
 */
export function soaKPIs(rows) {
  const totalInstances = rows.length;

  // Most common model
  const modelCount = {};
  for (const r of rows) {
    modelCount[r.model] = (modelCount[r.model] || 0) + 1;
  }
  const mostViolatedModel =
    Object.entries(modelCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–';

  // Worst stress duration (largest numeric value from duration strings)
  let worstDuration = null;
  let worstDurationStr = '–';
  for (const r of rows) {
    for (const v of r.violations) {
      const num = parseFloat(v.duration);
      if (!isNaN(num) && (worstDuration === null || num > worstDuration)) {
        worstDuration = num;
        worstDurationStr = v.duration;
      }
    }
  }

  // Param distribution
  const paramCount = {};
  for (const r of rows) {
    for (const v of r.violations) {
      paramCount[v.param] = (paramCount[v.param] || 0) + 1;
    }
  }

  return { totalInstances, mostViolatedModel, worstDurationStr, paramCount, modelCount };
}
