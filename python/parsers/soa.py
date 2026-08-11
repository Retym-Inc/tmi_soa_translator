import re
import math
from typing import Dict, List, Optional

_HEADER_RE = re.compile(r"\bRank\b.*\bInstance\b.*\bVoltage_in_SOA\b")
_SORTING_RE = re.compile(r"soa_sorting_num is set to (\d+)")


def parse_voltage_entry(entry: str) -> Optional[Dict[str, object]]:
    inner = entry.strip()
    if not (inner.startswith("(") and inner.endswith(")")):
        return None
    content = inner[1:-1]

    as_idx = content.find(" as ")
    if as_idx == -1:
        return None

    param = content[:as_idx].strip()
    rest = content[as_idx + 4 :]
    parts = rest.split(", ")
    if len(parts) < 4:
        return None

    n = len(parts)
    percent_str = parts[n - 1]
    duration_str = parts[n - 2]
    range_str = parts[n - 3]
    condition = ", ".join(parts[: n - 3])

    duration_value = _to_float(duration_str[:-1] if duration_str.lower().endswith("s") else duration_str)
    percent_value = _to_float(percent_str[:-1] if percent_str.endswith("%") else percent_str)

    return {
        "param": param,
        "condition": condition,
        "range": range_str,
        "duration": duration_str,
        "percent": percent_str,
        "durationValue": duration_value,
        "percentValue": percent_value,
    }


def _to_float(value: str) -> float:
    try:
        parsed = float(value)
        return 0.0 if math.isnan(parsed) else parsed
    except (TypeError, ValueError):
        return 0.0


def parse_soa(text: str) -> Optional[Dict[str, object]]:
    lines = text.splitlines()

    header_idx = -1
    for i, line in enumerate(lines):
        if _HEADER_RE.search(line):
            header_idx = i
            break
    if header_idx == -1:
        return None

    metadata: Dict[str, object] = {}
    for i in range(header_idx):
        match = _SORTING_RE.search(lines[i])
        if match:
            metadata["sortingNum"] = int(match.group(1))

    records: List[Dict[str, object]] = []
    for i in range(header_idx + 1, len(lines)):
        line = lines[i]
        if not line.strip():
            continue

        parts = line.split("\t")
        if len(parts) < 3:
            continue

        try:
            rank = int(parts[0].strip())
        except ValueError:
            continue

        instance = parts[1].strip()

        model_idx = len(parts) - 1
        while model_idx > 2 and parts[model_idx].strip().startswith("("):
            model_idx -= 1
        model = parts[model_idx].strip()

        voltage_entries = []
        for j in range(2, len(parts)):
            if j == model_idx:
                continue
            entry = parts[j].strip()
            if entry.startswith("("):
                parsed = parse_voltage_entry(entry)
                if parsed:
                    voltage_entries.append(parsed)

        if not instance or not voltage_entries:
            continue

        worst_duration = max(entry["durationValue"] for entry in voltage_entries)
        worst_percent = max(entry["percentValue"] for entry in voltage_entries)

        records.append(
            {
                "rank": rank,
                "instance": instance,
                "voltageEntries": voltage_entries,
                "model": model,
                "worstDuration": worst_duration,
                "worstPercent": worst_percent,
            }
        )

    return {"type": "SOA", "records": records, "metadata": metadata}
