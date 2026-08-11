import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

FIXTURE_DIR = pathlib.Path(__file__).resolve().parent / "fixtures"
CLI = pathlib.Path(__file__).resolve().parents[1] / "tmi_soa_translator.py"


class TestCLI(unittest.TestCase):
    def _run(self, *args, input_text=None):
        cmd = [sys.executable, str(CLI)] + list(args)
        return subprocess.run(cmd, input=input_text, text=True, capture_output=True, check=False)

    def test_json_formats(self):
        result = self._run(str(FIXTURE_DIR / "soa_report.txt"))
        self.assertEqual(0, result.returncode)
        payload = json.loads(result.stdout)
        self.assertIn("run", payload)
        self.assertEqual("SOA", payload["reports"][0]["type"])

    def test_csv_stdout_and_multi_file_output(self):
        result = self._run(str(FIXTURE_DIR / "tmi_report.txt"), "--format", "csv")
        self.assertEqual(0, result.returncode)
        self.assertIn("rank,instance", result.stdout)

        with tempfile.TemporaryDirectory() as tmpdir:
            prefix = pathlib.Path(tmpdir) / "combined.csv"
            result = self._run(str(FIXTURE_DIR / "combined_report.txt"), "--format", "csv", "-o", str(prefix))
            self.assertEqual(0, result.returncode)
            self.assertTrue((pathlib.Path(tmpdir) / "combined_soa.csv").exists())
            self.assertTrue((pathlib.Path(tmpdir) / "combined_tmi.csv").exists())

    def test_table_output(self):
        result = self._run(str(FIXTURE_DIR / "tmi_report.txt"), "--format", "table")
        self.assertEqual(0, result.returncode)
        self.assertIn("TMI", result.stdout)
        self.assertIn("days", result.stdout)

    def test_stdin_and_failure(self):
        combined = (FIXTURE_DIR / "combined_report.txt").read_text(encoding="utf-8")
        ok = self._run("-", "--format", "json", input_text=combined)
        self.assertEqual(0, ok.returncode)

        bad = self._run("-", input_text="nothing here")
        self.assertNotEqual(0, bad.returncode)
        self.assertIn("Could not detect a valid SOA or TMI report", bad.stderr)


if __name__ == "__main__":
    unittest.main()
