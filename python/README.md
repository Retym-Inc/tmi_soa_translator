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

## Desktop GUI (app.py)

`app.py` is a modern, offline desktop application (built with `customtkinter` and
`pandas`) that reuses the same parsing engine as the CLI. It provides a **Load
File** button, a **Summary Dashboard** (total core/IO gate area, SOA violation
count, degradation instance count, and the top 3 worst degradation instances and
SOA violations), and a **Data View** with sortable tables for the parsed
degradation and SOA violation records.

### Install GUI dependencies

Unlike the CLI, the GUI requires third-party packages (pinned):

```bash
pip install -r python/requirements-gui.txt
# or, explicitly:
pip install customtkinter==5.2.2 pandas==2.2.2
```

On Linux, the standard-library `tkinter` bindings may need to be installed via
your system package manager (e.g. `sudo apt-get install python3-tk`).

### Run

```bash
# Linux/macOS
python3 python/app.py

# Windows (PowerShell)
python .\python\app.py
```

The GUI runs completely locally with no web dependencies.
