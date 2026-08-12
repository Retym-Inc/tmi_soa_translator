# TMI/SOA Offline Python CLI

Pure-Python (standard library only), fully offline, cross-platform CLI for parsing Cadence Virtuoso SOA and TMI reports.

## Prerequisites

- Python 3.8+
- No `pip install` required
- No internet/network access required
- For the GUI: Tkinter (bundled with most Python installs; on Debian/Ubuntu install `python3-tk`)

## Offline desktop GUI

A Tkinter desktop app that reproduces the web dashboard fully offline: upload/paste
zone with a **file-path box** and a **Clear** button, KPI cards, a
sortable/filterable data table with CSV export, charts, and a hierarchy tree. It
reuses the same parsers as the CLI and supports SOA, TMI lifetime, and TMI
temperature/degradation (`dtemperature_avg`) reports.

```bash
# Open the file picker
python3 python/tmi_soa_gui.py

# Load a report on startup
python3 python/tmi_soa_gui.py report.rpt
```

On Debian/Ubuntu, if you see `ModuleNotFoundError: No module named 'tkinter'`,
install Tkinter first:

```bash
sudo apt-get install -y python3-tk
```

## Command-line interface

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

# Force TMI temperature/degradation parse (dtemperature_avg table)
python3 python/tmi_soa_translator.py report.rpt --type tmi-temp

# CSV output to stdout
python3 python/tmi_soa_translator.py report.rpt --format csv

# Table output to file
python3 python/tmi_soa_translator.py report.rpt --format table -o out.txt

# Read from stdin
cat report.rpt | python3 python/tmi_soa_translator.py -
```

## Offline behavior

This tool performs no web requests, telemetry, or third-party network calls. It uses Python standard library modules only.
