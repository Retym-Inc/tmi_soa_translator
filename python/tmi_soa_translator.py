#!/usr/bin/env python3
import argparse
import csv
import datetime
import json
import os
import sys
from io import StringIO
from pathlib import Path
from typing import Dict, List, Union

from parsers.detect import detect_and_parse
from parsers.tmi import format_lifetime_years

TOOL_VERSION = "1.0.0"


def _read_text(path: str) -> str:
    if path == "-":
        return sys.stdin.read()
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read()


def _normalize_results(parsed: Union[dict, List[dict]]) -> List[dict]:
    if isinstance(parsed, list):
        return parsed
    return [parsed]


def _build_json_payload(results: List[dict], source: str) -> Dict[str, object]:
    return {
        "run": {
            "toolVersion": TOOL_VERSION,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source": source,
        },
        "reports": [
            {
                "type": report["type"],
                "metadata": report.get("metadata", {}),
                "records": report.get("records", []),
            }
            for report in results
        ],
    }


def _soa_csv_rows(record: Dict[str, object]) -> List[Dict[str, object]]:
    rows = []
    entries = record.get("voltageEntries", [])
    for entry in entries:
        rows.append(
            {
                "rank": record.get("rank"),
                "instance": record.get("instance"),
                "model": record.get("model"),
                "worstDuration": record.get("worstDuration"),
                "worstPercent": record.get("worstPercent"),
                "param": entry.get("param"),
                "condition": entry.get("condition"),
                "range": entry.get("range"),
                "duration": entry.get("duration"),
                "percent": entry.get("percent"),
                "durationValue": entry.get("durationValue"),
                "percentValue": entry.get("percentValue"),
            }
        )
    return rows


def _report_to_csv_string(report: dict) -> str:
    output = StringIO()
    if report["type"] == "SOA":
        fieldnames = [
            "rank",
            "instance",
            "model",
            "worstDuration",
            "worstPercent",
            "param",
            "condition",
            "range",
            "duration",
            "percent",
            "durationValue",
            "percentValue",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for record in report["records"]:
            for row in _soa_csv_rows(record):
                writer.writerow(row)
    else:
        fieldnames = [
            "rank",
            "instance",
            "didsat_hci_bti",
            "didlin_hci_bti",
            "dvtlin_hci_bti",
            "didsat_hci",
            "didlin_hci",
            "dvtlin_hci",
            "didsat_bti",
            "didlin_bti",
            "dvtlin_bti",
            "lifetime_hci_bti_raw",
            "lifetime_hci_raw",
            "lifetime_bti_raw",
            "lifetimeHCIBTI",
            "lifetimeHCI",
            "lifetimeBTI",
            "lifetime_item",
            "eol_spec",
            "model",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for record in report["records"]:
            writer.writerow(record)
    return output.getvalue()


def _table_for_report(report: dict) -> str:
    if report["type"] == "SOA":
        headers = ["rank", "instance", "model", "entries", "worstDuration", "worstPercent"]
        rows = [
            [
                str(rec["rank"]),
                str(rec["instance"]),
                str(rec["model"]),
                str(len(rec["voltageEntries"])),
                str(rec["worstDuration"]),
                str(rec["worstPercent"]),
            ]
            for rec in report["records"]
        ]
    else:
        headers = ["rank", "instance", "lifetimeHCIBTI", "lifetimeHCI", "lifetimeBTI", "model"]
        rows = [
            [
                str(rec["rank"]),
                str(rec["instance"]),
                format_lifetime_years(rec.get("lifetimeHCIBTI")),
                format_lifetime_years(rec.get("lifetimeHCI")),
                format_lifetime_years(rec.get("lifetimeBTI")),
                str(rec["model"]),
            ]
            for rec in report["records"]
        ]

    widths = [len(header) for header in headers]
    for row in rows:
        for i, value in enumerate(row):
            widths[i] = max(widths[i], len(value))

    lines = [report["type"]]
    lines.append("  ".join(header.ljust(widths[i]) for i, header in enumerate(headers)))
    lines.append("  ".join("-" * widths[i] for i in range(len(headers))))
    for row in rows:
        lines.append("  ".join(row[i].ljust(widths[i]) for i in range(len(headers))))
    return "\n".join(lines)


def _write_text(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(content)


def _emit_csv(results: List[dict], output: str = None) -> int:
    if output is None:
        if len(results) == 1:
            sys.stdout.write(_report_to_csv_string(results[0]))
            return 0

        for idx, report in enumerate(results):
            if idx:
                sys.stdout.write("\n")
            sys.stdout.write("# {}\n".format(report["type"]))
            sys.stdout.write(_report_to_csv_string(report))
        return 0

    if len(results) == 1:
        _write_text(output, _report_to_csv_string(results[0]))
        return 0

    out_path = Path(output)
    if out_path.exists() and out_path.is_dir():
        base = out_path
        stem = "report"
        suffix = ".csv"
    else:
        base = out_path.parent if str(out_path.parent) else Path(".")
        stem = out_path.stem if out_path.suffix else out_path.name
        suffix = out_path.suffix if out_path.suffix else ".csv"

    for report in results:
        filename = "{}_{}{}".format(stem, report["type"].lower(), suffix)
        _write_text(str(base / filename), _report_to_csv_string(report))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Offline TMI/SOA report translator")
    parser.add_argument("input", nargs="?", help="Input file path or - for stdin")
    parser.add_argument("-o", "--output", help="Output file path")
    parser.add_argument("--format", choices=["json", "csv", "table"], default="json")
    parser.add_argument("--type", choices=["auto", "soa", "tmi"], default="auto")
    parser.add_argument("--version", action="store_true", help="Show tool version and exit")

    args = parser.parse_args(argv)

    if args.version:
        sys.stdout.write("{}\n".format(TOOL_VERSION))
        return 0
    if not args.input:
        parser.error("the following arguments are required: input")

    try:
        text = _read_text(args.input)
    except OSError as exc:
        sys.stderr.write("I/O error: {}\n".format(exc))
        return 2

    parsed = detect_and_parse(text, report_type=args.type)
    if not parsed:
        sys.stderr.write("Could not detect a valid SOA or TMI report in the supplied text.\n")
        return 1

    results = _normalize_results(parsed)

    if args.format == "json":
        payload = _build_json_payload(results, args.input)
        rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            try:
                _write_text(args.output, rendered)
            except OSError as exc:
                sys.stderr.write("I/O error: {}\n".format(exc))
                return 2
        else:
            sys.stdout.write(rendered)
        return 0

    if args.format == "csv":
        try:
            return _emit_csv(results, args.output)
        except OSError as exc:
            sys.stderr.write("I/O error: {}\n".format(exc))
            return 2

    rendered = "\n\n".join(_table_for_report(report) for report in results) + "\n"
    if args.output:
        try:
            _write_text(args.output, rendered)
        except OSError as exc:
            sys.stderr.write("I/O error: {}\n".format(exc))
            return 2
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
