import math
import re
from typing import Dict, Optional

# Matches the column header of a "TMI degradation and lifetime" temperature
# report, e.g. "Rank      Instance      dtemperature_avg  Model".
_HEADER_RE = re.compile(r"\bRank\b.*\bInstance\b.*\bdtemperature_avg\b")


def parse_temperature_value(raw: str):
    """Return the numeric temperature for a ``dtemperature_avg`` token.

    The raw token may carry a trailing annotation (``*`` or ``**``). ``None`` is
    returned when the value cannot be parsed as a number.
    """
    if not raw:
        return None
    value = raw.strip().rstrip("*")
    try:
        return float(value)
    except ValueError:
        return None


def temperature_annotation(raw: str) -> str:
    """Return the trailing annotation (``*`` or ``**``) of a value token."""
    if not raw:
        return ""
    match = re.search(r"\*+$", raw.strip())
    return match.group(0) if match else ""


def parse_tmi_temp(text: str) -> Optional[Dict[str, object]]:
    lines = text.splitlines()

    header_idx = -1
    for i, line in enumerate(lines):
        if _HEADER_RE.search(line):
            header_idx = i
            break
    if header_idx == -1:
        return None

    records = []
    for i in range(header_idx + 1, len(lines)):
        line = lines[i].strip()
        if not line or line.startswith("*") or line.startswith("["):
            continue

        tokens = re.split(r"\s+", line)
        if len(tokens) < 4:
            continue

        try:
            rank = int(tokens[0])
        except ValueError:
            continue

        instance = tokens[1]
        temperature_raw = tokens[2]
        model = " ".join(tokens[3:])

        value = parse_temperature_value(temperature_raw)

        records.append(
            {
                "rank": rank,
                "instance": instance,
                "dtemperature_avg_raw": temperature_raw,
                "dtemperature_avg": value,
                "annotation": temperature_annotation(temperature_raw),
                "model": model,
            }
        )

    if not records:
        return None
    return {"type": "TMI-TEMP", "records": records, "metadata": {}}


def format_temperature(value) -> str:
    """Human-readable temperature string used by the CLI/GUI tables."""
    if value is None or not math.isfinite(value):
        return "-"
    return "{:.3e} \u00b0C".format(value)
