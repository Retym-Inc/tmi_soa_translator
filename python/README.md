# TMI/SOA Offline Python CLI

Pure-Python (standard library only), fully offline, cross-platform CLI for parsing Cadence Virtuoso SOA and TMI reports.

## Prerequisites

- Python 3.8+
- No `pip install` required
- No internet/network access required

## Quick start

### Linux/macOS

```bash
cd /home/runner/work/tmi_soa_translator/tmi_soa_translator
python3 python/tmi_soa_translator.py <input_report.txt>
```

### Windows (PowerShell)

```powershell
cd C:\path\to\tmi_soa_translator
python .\python\tmi_soa_translator.py .\input_report.txt
```

## Examples

```bash
# Auto detect report type(s), JSON output (default)
python3 python/tmi_soa_translator.py report.rpt

# Force SOA parse
python3 python/tmi_soa_translator.py report.rpt --type soa

# CSV output to stdout
python3 python/tmi_soa_translator.py report.rpt --format csv

# Table output to file
python3 python/tmi_soa_translator.py report.rpt --format table -o out.txt

# Read from stdin
cat report.rpt | python3 python/tmi_soa_translator.py -
```

## Offline behavior

This tool performs no web requests, telemetry, or third-party network calls. It uses Python standard library modules only.
