/**
 * Auto-detect whether the input text is a SOA or TMI report.
 * Returns 'SOA', 'TMI', or null if unknown.
 */
export function detectReportType(text) {
  if (!text || !text.trim()) return null;
  // TMI reports contain "TMI degradation" or "didsat" column header
  if (/TMI\s+degradation/i.test(text) || /didsat\(HCI/i.test(text)) {
    return 'TMI';
  }
  // SOA reports contain "Safe Operation Area" or "Voltage_in_SOA"
  if (/Safe\s+Operation\s+Area/i.test(text) || /Voltage_in_SOA/i.test(text)) {
    return 'SOA';
  }
  return null;
}
