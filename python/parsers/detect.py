import re
from typing import List, Optional, Union

from .soa import parse_soa
from .tmi import parse_tmi
from .tmi_temp import parse_tmi_temp

_SOA_DETECT_RE = re.compile(r"Voltage_in_SOA|Safe Operation Area checked")
_TMI_DETECT_RE = re.compile(r"TMI degradation|didsat\(HCI\+BTI")
_TMI_TEMP_DETECT_RE = re.compile(r"dtemperature_avg")


def detect_and_parse(text: str, report_type: str = "auto") -> Optional[Union[dict, List[dict]]]:
    results = []

    is_soa = bool(_SOA_DETECT_RE.search(text))
    is_temp = bool(_TMI_TEMP_DETECT_RE.search(text))
    # The temperature report also matches "TMI degradation"; keep the two
    # distinct so a temperature report is not also parsed as a lifetime report.
    is_tmi = bool(_TMI_DETECT_RE.search(text)) and not is_temp

    if report_type == "soa":
        is_soa, is_tmi, is_temp = True, False, False
    elif report_type == "tmi":
        is_soa, is_tmi, is_temp = False, True, False
    elif report_type == "tmi-temp":
        is_soa, is_tmi, is_temp = False, False, True

    if is_soa:
        soa_result = parse_soa(text)
        if soa_result and soa_result.get("records"):
            results.append(soa_result)

    if is_tmi:
        tmi_result = parse_tmi(text)
        if tmi_result and tmi_result.get("records"):
            results.append(tmi_result)

    if is_temp:
        temp_result = parse_tmi_temp(text)
        if temp_result and temp_result.get("records"):
            results.append(temp_result)

    if not results:
        return None
    return results[0] if len(results) == 1 else results
