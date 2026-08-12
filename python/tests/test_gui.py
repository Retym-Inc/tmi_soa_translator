import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import tmi_soa_gui as gui  # noqa: E402
from parsers.detect import detect_and_parse  # noqa: E402

FIXTURE_DIR = pathlib.Path(__file__).resolve().parent / "fixtures"


def _load(name):
    text = (FIXTURE_DIR / name).read_text(encoding="utf-8")
    return detect_and_parse(text)


class TestGuiHelpers(unittest.TestCase):
    def test_fmt_duration_units(self):
        self.assertEqual(gui.fmt_duration(None), "-")
        self.assertTrue(gui.fmt_duration(2.0).endswith("s"))
        self.assertIn("ns", gui.fmt_duration(2.29e-8))
        self.assertIn("ps", gui.fmt_duration(8.58e-11))

    def test_lifetime_color_thresholds(self):
        self.assertEqual(gui.lifetime_color(0.5), gui.RED)
        self.assertEqual(gui.lifetime_color(5), gui.ORANGE)
        self.assertEqual(gui.lifetime_color(50), gui.GREEN)
        self.assertEqual(gui.lifetime_color(float("inf")), gui.FAINT)

    def test_soa_kpis(self):
        report = _load("soa_report.txt")
        cards = gui.soa_kpis(report["records"])
        labels = [c[0] for c in cards]
        self.assertIn("Total Violations", labels)
        self.assertEqual(cards[0][1], str(len(report["records"])))

    def test_tmi_kpis_shortest_and_below(self):
        report = _load("tmi_report.txt")
        cards = gui.tmi_kpis(report["records"])
        self.assertEqual(cards[0][0], "Shortest Lifetime")
        # U2/M2 has the shortest finite lifetime (1.5 yr)
        self.assertEqual(cards[0][2], "U2/M2")

    def test_report_to_csv_headers(self):
        tmi_csv = gui.report_to_csv(_load("tmi_report.txt"))
        self.assertIn("Rank,Instance,", tmi_csv)
        self.assertIn("Lifetime(HCI+BTI,yr)", tmi_csv)
        soa_csv = gui.report_to_csv(_load("soa_report.txt"))
        self.assertIn("#Violations", soa_csv)

    def test_temperature_color_thresholds(self):
        self.assertEqual(gui.temperature_color(160), gui.RED)
        self.assertEqual(gui.temperature_color(20), gui.ORANGE)
        self.assertEqual(gui.temperature_color(1), gui.GREEN)
        self.assertEqual(gui.temperature_color(float("nan")), gui.FAINT)

    def test_temp_kpis(self):
        report = _load("tmi_temp_report.txt")
        cards = gui.temp_kpis(report["records"])
        self.assertEqual(cards[0][0], "Hottest Instance")
        self.assertEqual(cards[0][2], "OUTPUT_DRIVER.I1.M2")

    def test_temp_report_to_csv_headers(self):
        temp_csv = gui.report_to_csv(_load("tmi_temp_report.txt"))
        self.assertIn("dtemperature_avg", temp_csv)
        self.assertIn("Annotation", temp_csv)

    def test_build_hierarchy_nesting(self):
        report = _load("soa_report.txt")
        root = gui.TranslatorApp._build_hierarchy(report["records"])
        # instance XU1/M1 is a single dotted-part path (no dots) -> one child
        self.assertTrue(root["children"])


if __name__ == "__main__":
    unittest.main()
