import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from parsers.detect import detect_and_parse
from parsers.soa import parse_soa, parse_voltage_entry
from parsers.tmi import format_lifetime_years, parse_lifetime_value, parse_tmi
from parsers.tmi_temp import (
    format_temperature,
    parse_temperature_value,
    parse_tmi_temp,
    temperature_annotation,
)

FIXTURE_DIR = pathlib.Path(__file__).resolve().parent / "fixtures"


class TestSOAParser(unittest.TestCase):
    def test_parse_voltage_entry_invalid_shapes(self):
        self.assertIsNone(parse_voltage_entry("Vgs as x"))
        self.assertIsNone(parse_voltage_entry("(Vgs no as token)"))
        self.assertIsNone(parse_voltage_entry("(Vgs as cond, range, 1s)"))

    def test_parse_voltage_entry_units_and_fallback(self):
        parsed = parse_voltage_entry("(Vgs as cond, range, 2.5S, 3.5%)")
        self.assertEqual(2.5, parsed["durationValue"])
        self.assertEqual(3.5, parsed["percentValue"])

        parsed_bad = parse_voltage_entry("(Vgs as cond, range, BADs, NaN%)")
        self.assertEqual(0.0, parsed_bad["durationValue"])
        self.assertEqual(0.0, parsed_bad["percentValue"])

    def test_model_vs_voltage_detection(self):
        text = (
            "soa_sorting_num is set to 3\n"
            "Rank\tInstance\tVoltage_in_SOA\tModel\n"
            "1\tinst\t(Vgs as c, r, 1s, 1%)\t(model not model)\treal_model\n"
        )
        parsed = parse_soa(text)
        self.assertEqual("real_model", parsed["records"][0]["model"])
        self.assertEqual(1, len(parsed["records"][0]["voltageEntries"]))


class TestTMIParser(unittest.TestCase):
    def test_metadata_extraction(self):
        text = (FIXTURE_DIR / "tmi_report.txt").read_text(encoding="utf-8")
        parsed = parse_tmi(text)
        self.assertEqual(123, parsed["metadata"]["coreDeviceCount"])
        self.assertEqual(45, parsed["metadata"]["ioDeviceCount"])
        self.assertEqual("1.23e+04 µm²", parsed["metadata"]["effectiveCoreArea"])
        self.assertEqual("0.500 yr", parsed["metadata"]["sumDageTime"])
        self.assertEqual("0.250 yr", parsed["metadata"]["dageTime"])

    def test_parse_lifetime_value(self):
        self.assertEqual(float("inf"), parse_lifetime_value(">100"))
        self.assertEqual(4.667e-04, parse_lifetime_value("4.667e-04"))
        self.assertIsNone(parse_lifetime_value("garbage"))

    def test_format_lifetime_boundaries(self):
        self.assertEqual("-", format_lifetime_years(None))
        self.assertEqual(">100 yr", format_lifetime_years(float("inf")))
        self.assertEqual(">100 yr", format_lifetime_years(101))
        self.assertEqual("1.000 yr", format_lifetime_years(1))
        self.assertEqual("1.0 days", format_lifetime_years(1 / 365.25))
        self.assertEqual("1.00 hr", format_lifetime_years(1 / (365.25 * 24)))
        self.assertEqual("30.00 min", format_lifetime_years(1 / (365.25 * 24 * 2)))


class TestDetection(unittest.TestCase):
    def test_detect_types(self):
        soa = (FIXTURE_DIR / "soa_report.txt").read_text(encoding="utf-8")
        tmi = (FIXTURE_DIR / "tmi_report.txt").read_text(encoding="utf-8")
        combined = (FIXTURE_DIR / "combined_report.txt").read_text(encoding="utf-8")

        self.assertEqual("SOA", detect_and_parse(soa)["type"])
        self.assertEqual("TMI", detect_and_parse(tmi)["type"])

        both = detect_and_parse(combined)
        self.assertIsInstance(both, list)
        self.assertEqual(["SOA", "TMI"], [r["type"] for r in both])

        self.assertIsNone(detect_and_parse("not a report"))


class TestTMITemperatureParser(unittest.TestCase):
    def _report(self):
        text = (FIXTURE_DIR / "tmi_temp_report.txt").read_text(encoding="utf-8")
        return parse_tmi_temp(text)

    def test_parse_records(self):
        parsed = self._report()
        self.assertEqual("TMI-TEMP", parsed["type"])
        self.assertEqual(6, len(parsed["records"]))
        first = parsed["records"][0]
        self.assertEqual(1, first["rank"])
        self.assertEqual("OUTPUT_DRIVER.I1.M2", first["instance"])
        self.assertEqual(160.8, first["dtemperature_avg"])
        self.assertEqual("*", first["annotation"])
        self.assertEqual("nch_ulvt_mac.1", first["model"])

    def test_double_annotation(self):
        parsed = self._report()
        double = parsed["records"][2]
        self.assertEqual("**", double["annotation"])
        self.assertEqual(160.3, double["dtemperature_avg"])

    def test_value_helpers(self):
        self.assertEqual(160.8, parse_temperature_value("1.608e+02*"))
        self.assertEqual(7.109, parse_temperature_value("7.109e+00"))
        self.assertIsNone(parse_temperature_value("garbage"))
        self.assertEqual("**", temperature_annotation("1.6e2**"))
        self.assertEqual("", temperature_annotation("1.6e2"))

    def test_format_temperature(self):
        self.assertEqual("-", format_temperature(None))
        self.assertEqual("1.608e+02 \u00b0C", format_temperature(160.8))

    def test_detect_temperature_report(self):
        text = (FIXTURE_DIR / "tmi_temp_report.txt").read_text(encoding="utf-8")
        parsed = detect_and_parse(text)
        self.assertEqual("TMI-TEMP", parsed["type"])


if __name__ == "__main__":
    unittest.main()
