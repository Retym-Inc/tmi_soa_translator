import math
import re
from typing import Dict, Optional

_HEADER_RE = re.compile(r"\bRank\b.*\bInstance\b.*didsat\(HCI")
_CORE_RE = re.compile(r"Area sum of (\d+) Core devices")
_IO_RE = re.compile(r"Area sum of (\d+) IO devices")
_EFFECTIVE_RE = re.compile(r"Effective_Core_gate_area_by_TMI\s*=\s*([\d.eE+\-]+)\s*um")
_SUM_DAGE_RE = re.compile(r"^Sum dageTime\s*=\s*([\d.]+\s*yr)")
_DAGE_RE = re.compile(r"^dageTime\s*=\s*([\d.]+\s*yr)")
_SOA_BOUNDARY_RE = re.compile(
    r"Safe Operation Area checked|soa_sorting_num|Voltage_in_SOA"
)


def parse_lifetime_value(raw: str):
    if not raw:
        return None
    value = raw.strip()
    if value.startswith(">"):
        return float("inf")
    try:
        return float(value)
    except ValueError:
        return None


def format_lifetime_years(years) -> str:
    if years is None:
        return "-"
    if not math.isfinite(years) or years > 100:
        return ">100 yr"
    if years >= 1:
        return "{:.3f} yr".format(years)
    days = years * 365.25
    if days >= 1:
        return "{:.1f} days".format(days)
    hours = days * 24
    if hours >= 1:
        return "{:.2f} hr".format(hours)
    minutes = hours * 60
    return "{:.2f} min".format(minutes)


def parse_tmi(text: str) -> Optional[Dict[str, object]]:
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
        line = lines[i]
        core_match = _CORE_RE.search(line)
        if core_match:
            metadata["coreDeviceCount"] = int(core_match.group(1))

        io_match = _IO_RE.search(line)
        if io_match:
            metadata["ioDeviceCount"] = int(io_match.group(1))

        effective_match = _EFFECTIVE_RE.search(line)
        if effective_match:
            metadata["effectiveCoreArea"] = "{} µm²".format(effective_match.group(1))

        sum_dage_match = _SUM_DAGE_RE.search(line)
        if sum_dage_match:
            metadata["sumDageTime"] = sum_dage_match.group(1).strip()

        dage_match = _DAGE_RE.search(line)
        if dage_match and "dageTime" not in metadata:
            metadata["dageTime"] = dage_match.group(1).strip()

    records = []
    for i in range(header_idx + 1, len(lines)):
        line = lines[i].strip()
        if _SOA_BOUNDARY_RE.search(line):
            break
        if not line or line.startswith("*") or line.startswith("[") or line.startswith("]"):
            continue
        if line == "VV":
            continue

        tokens = re.split(r"\s+", line)
        if len(tokens) < 17:
            continue

        try:
            rank = int(tokens[0])
        except ValueError:
            continue

        instance = tokens[1]
        didsat_hci_bti = tokens[2]
        didlin_hci_bti = tokens[3]
        dvtlin_hci_bti = tokens[4]
        didsat_hci = tokens[5]
        didlin_hci = tokens[6]
        dvtlin_hci = tokens[7]
        didsat_bti = tokens[8]
        didlin_bti = tokens[9]
        dvtlin_bti = tokens[10]
        lifetime_hci_bti_raw = tokens[11]
        lifetime_hci_raw = tokens[12]
        lifetime_bti_raw = tokens[13]
        lifetime_item = tokens[14]
        eol_spec = tokens[15]
        model = " ".join(tokens[16:])

        records.append(
            {
                "rank": rank,
                "instance": instance,
                "didsat_hci_bti": didsat_hci_bti,
                "didlin_hci_bti": didlin_hci_bti,
                "dvtlin_hci_bti": dvtlin_hci_bti,
                "didsat_hci": didsat_hci,
                "didlin_hci": didlin_hci,
                "dvtlin_hci": dvtlin_hci,
                "didsat_bti": didsat_bti,
                "didlin_bti": didlin_bti,
                "dvtlin_bti": dvtlin_bti,
                "lifetime_hci_bti_raw": lifetime_hci_bti_raw,
                "lifetime_hci_raw": lifetime_hci_raw,
                "lifetime_bti_raw": lifetime_bti_raw,
                "lifetimeHCIBTI": parse_lifetime_value(lifetime_hci_bti_raw),
                "lifetimeHCI": parse_lifetime_value(lifetime_hci_raw),
                "lifetimeBTI": parse_lifetime_value(lifetime_bti_raw),
                "lifetime_item": lifetime_item,
                "eol_spec": eol_spec,
                "model": model,
            }
        )

    return {"type": "TMI", "records": records, "metadata": metadata}
