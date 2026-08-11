#!/usr/bin/env python3
"""Offline desktop GUI for parsing and summarizing TMI degradation / SOA reports.

Cross-platform (Windows & Linux), fully offline. Built with customtkinter for a
modern look and pandas for tabular data handling. The heavy parsing is delegated
to the shared ``parsers`` engine that also backs the command-line translator, so
the GUI and CLI stay consistent.

Run:
    python app.py

Dependencies (see requirements-gui.txt):
    pip install customtkinter==5.2.2 pandas==2.2.2
"""

import os
import re
import sys
from tkinter import filedialog, ttk

# Make the sibling ``parsers`` package importable when launched from any CWD.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import customtkinter as ctk
except ImportError:  # pragma: no cover - environment guidance only
    sys.stderr.write(
        "customtkinter is required. Install GUI dependencies with:\n"
        "    pip install -r requirements-gui.txt\n"
    )
    raise

try:
    import pandas as pd
except ImportError:  # pragma: no cover - environment guidance only
    sys.stderr.write(
        "pandas is required. Install GUI dependencies with:\n"
        "    pip install -r requirements-gui.txt\n"
    )
    raise

from parsers.detect import detect_and_parse
from parsers.tmi import format_lifetime_years

# --- Metadata regexes (dashboard-only; table parsing lives in ``parsers``) ----
_CORE_COUNT_RE = re.compile(r"Area sum of\s+(\d+)\s+Core devices", re.IGNORECASE)
_IO_COUNT_RE = re.compile(r"Area sum of\s+(\d+)\s+IO devices", re.IGNORECASE)
_AREA_RE = re.compile(
    r"^(?P<key>Drawn_Core|Effective_Core|Drawn_IO|Effective_IO)_gate_area_by_TMI"
    r"\s*=\s*(?P<value>[\d.eE+\-]+)\s*(?P<unit>\S+)?",
    re.IGNORECASE,
)
_DAGE_RE = re.compile(r"^dageTime\s*=\s*(?P<value>.+?)\s*$")
_SUM_DAGE_RE = re.compile(r"^Sum dageTime\s*=\s*(?P<value>.+?)\s*$")


def extract_metadata(text):
    """Extract dashboard metadata (areas, device counts, dageTime) from raw text."""
    meta = {
        "coreDeviceCount": None,
        "ioDeviceCount": None,
        "drawnCoreArea": None,
        "effectiveCoreArea": None,
        "drawnIOArea": None,
        "effectiveIOArea": None,
        "dageTime": None,
        "sumDageTime": None,
    }
    area_keys = {
        "drawn_core": "drawnCoreArea",
        "effective_core": "effectiveCoreArea",
        "drawn_io": "drawnIOArea",
        "effective_io": "effectiveIOArea",
    }
    for line in text.splitlines():
        stripped = line.strip()

        core = _CORE_COUNT_RE.search(stripped)
        if core:
            meta["coreDeviceCount"] = int(core.group(1))
        io = _IO_COUNT_RE.search(stripped)
        if io:
            meta["ioDeviceCount"] = int(io.group(1))

        area = _AREA_RE.match(stripped)
        if area:
            unit = area.group("unit") or ""
            meta[area_keys[area.group("key").lower()]] = "{} {}".format(
                area.group("value"), unit
            ).strip()

        if meta["sumDageTime"] is None:
            sum_dage = _SUM_DAGE_RE.match(stripped)
            if sum_dage:
                meta["sumDageTime"] = sum_dage.group("value").strip()
                continue
        if meta["dageTime"] is None:
            dage = _DAGE_RE.match(stripped)
            if dage:
                meta["dageTime"] = dage.group("value").strip()

    return meta


def reports_by_type(text):
    """Return a ``{'TMI': report, 'SOA': report}`` mapping using the shared engine."""
    parsed = detect_and_parse(text)
    reports = {}
    if not parsed:
        return reports
    if isinstance(parsed, dict):
        parsed = [parsed]
    for report in parsed:
        reports[report["type"]] = report
    return reports


def tmi_dataframe(report):
    """Build a display-friendly DataFrame for TMI degradation records."""
    if not report or not report.get("records"):
        return pd.DataFrame()
    rows = []
    for rec in report["records"]:
        rows.append(
            {
                "Rank": rec.get("rank"),
                "Instance": rec.get("instance"),
                "didsat(HCI+BTI,%)": rec.get("didsat_hci_bti"),
                "didlin(HCI+BTI,%)": rec.get("didlin_hci_bti"),
                "dvtlin(HCI+BTI,V)": rec.get("dvtlin_hci_bti"),
                "lifetime(HCI+BTI)": format_lifetime_years(rec.get("lifetimeHCIBTI")),
                "lifetime(HCI)": format_lifetime_years(rec.get("lifetimeHCI")),
                "lifetime(BTI)": format_lifetime_years(rec.get("lifetimeBTI")),
                "lifetime_item": rec.get("lifetime_item"),
                "EOL_spec": rec.get("eol_spec"),
                "Model": rec.get("model"),
            }
        )
    df = pd.DataFrame(rows)
    return df.sort_values("Rank").reset_index(drop=True)


def soa_dataframe(report):
    """Build a display-friendly DataFrame for SOA violation records."""
    if not report or not report.get("records"):
        return pd.DataFrame()
    rows = []
    for rec in report["records"]:
        entries = rec.get("voltageEntries", [])
        summary = "; ".join(
            "{} {} {}".format(
                entry.get("param", ""), entry.get("range", ""), entry.get("percent", "")
            ).strip()
            for entry in entries
        )
        rows.append(
            {
                "Rank": rec.get("rank"),
                "Instance": rec.get("instance"),
                "Violations": len(entries),
                "Voltage_in_SOA": summary,
                "Worst %": rec.get("worstPercent"),
                "Worst duration (s)": rec.get("worstDuration"),
                "Model": rec.get("model"),
            }
        )
    df = pd.DataFrame(rows)
    return df.sort_values(["Rank", "Worst %"], ascending=[True, False]).reset_index(
        drop=True
    )


class TmiSoaApp(ctk.CTk):
    """Main application window."""

    def __init__(self):
        super().__init__()

        ctk.set_appearance_mode("System")
        ctk.set_default_color_theme("blue")

        self.title("TMI / SOA Report Analyzer")
        self.geometry("1180x760")
        self.minsize(900, 600)

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        self._current_file = None
        self._tmi_df = pd.DataFrame()
        self._soa_df = pd.DataFrame()

        self._build_header()
        self._build_dashboard()
        self._build_data_view()

    # -- UI construction -----------------------------------------------------
    def _build_header(self):
        header = ctk.CTkFrame(self, corner_radius=12)
        header.grid(row=0, column=0, padx=16, pady=(16, 8), sticky="ew")
        header.grid_columnconfigure(1, weight=1)

        title = ctk.CTkLabel(
            header,
            text="TMI Degradation & SOA Violation Analyzer",
            font=ctk.CTkFont(size=20, weight="bold"),
        )
        title.grid(row=0, column=0, padx=16, pady=14, sticky="w")

        self.file_label = ctk.CTkLabel(
            header, text="No file loaded", anchor="w", text_color=("gray30", "gray70")
        )
        self.file_label.grid(row=0, column=1, padx=8, pady=14, sticky="ew")

        load_btn = ctk.CTkButton(header, text="Load File", command=self.load_file)
        load_btn.grid(row=0, column=2, padx=16, pady=14, sticky="e")

    def _build_dashboard(self):
        self.dashboard = ctk.CTkFrame(self, corner_radius=12)
        self.dashboard.grid(row=1, column=0, padx=16, pady=8, sticky="ew")
        self.dashboard.grid_columnconfigure((0, 1, 2), weight=1, uniform="cards")

        heading = ctk.CTkLabel(
            self.dashboard,
            text="Summary Dashboard",
            font=ctk.CTkFont(size=16, weight="bold"),
        )
        heading.grid(row=0, column=0, columnspan=3, padx=16, pady=(12, 4), sticky="w")

        self.card_area = self._make_card(self.dashboard, 1, 0, "Gate Area (Effective)")
        self.card_soa = self._make_card(self.dashboard, 1, 1, "SOA Violations")
        self.card_tmi = self._make_card(self.dashboard, 1, 2, "Degradation Instances")

        self.top_tmi_box = self._make_list_card(
            self.dashboard, 2, 0, "Top 3 Worst Degradation"
        )
        self.top_soa_box = self._make_list_card(
            self.dashboard, 2, 1, "Top 3 SOA Violations", columnspan=2
        )

    def _make_card(self, parent, row, col, title):
        card = ctk.CTkFrame(parent, corner_radius=10)
        card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
        card.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(
            card, text=title, font=ctk.CTkFont(size=12, weight="bold")
        ).grid(row=0, column=0, padx=12, pady=(10, 2), sticky="w")
        value = ctk.CTkLabel(
            card, text="-", justify="left", font=ctk.CTkFont(size=13)
        )
        value.grid(row=1, column=0, padx=12, pady=(0, 10), sticky="w")
        return value

    def _make_list_card(self, parent, row, col, title, columnspan=1):
        card = ctk.CTkFrame(parent, corner_radius=10)
        card.grid(
            row=row, column=col, columnspan=columnspan, padx=8, pady=8, sticky="nsew"
        )
        card.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(
            card, text=title, font=ctk.CTkFont(size=12, weight="bold")
        ).grid(row=0, column=0, padx=12, pady=(10, 2), sticky="w")
        box = ctk.CTkTextbox(card, height=90, wrap="none")
        box.grid(row=1, column=0, padx=12, pady=(0, 10), sticky="nsew")
        box.configure(state="disabled")
        return box

    def _build_data_view(self):
        self.tabview = ctk.CTkTabview(self, corner_radius=12)
        self.tabview.grid(row=2, column=0, padx=16, pady=(8, 16), sticky="nsew")
        self.tabview.add("Degradation (TMI)")
        self.tabview.add("SOA Violations")

        self.tmi_tree = self._make_tree(self.tabview.tab("Degradation (TMI)"))
        self.soa_tree = self._make_tree(self.tabview.tab("SOA Violations"))

    def _make_tree(self, parent):
        parent.grid_columnconfigure(0, weight=1)
        parent.grid_rowconfigure(0, weight=1)

        container = ttk.Frame(parent)
        container.grid(row=0, column=0, sticky="nsew")
        container.grid_columnconfigure(0, weight=1)
        container.grid_rowconfigure(0, weight=1)

        tree = ttk.Treeview(container, show="headings")
        tree.grid(row=0, column=0, sticky="nsew")

        vsb = ttk.Scrollbar(container, orient="vertical", command=tree.yview)
        vsb.grid(row=0, column=1, sticky="ns")
        hsb = ttk.Scrollbar(container, orient="horizontal", command=tree.xview)
        hsb.grid(row=1, column=0, sticky="ew")
        tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        return tree

    # -- Actions -------------------------------------------------------------
    def load_file(self):
        path = filedialog.askopenfilename(
            title="Select a TMI / SOA report",
            filetypes=[("Text/report files", "*.txt *.rpt *.log *.out"), ("All files", "*.*")],
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as handle:
                text = handle.read()
        except OSError as exc:
            self._set_status("Failed to read file: {}".format(exc))
            return

        self._current_file = path
        self.file_label.configure(text=os.path.basename(path))

        reports = reports_by_type(text)
        metadata = extract_metadata(text)
        self._tmi_df = tmi_dataframe(reports.get("TMI"))
        self._soa_df = soa_dataframe(reports.get("SOA"))

        self._update_dashboard(metadata)
        self._populate_tree(self.tmi_tree, self._tmi_df)
        self._populate_tree(self.soa_tree, self._soa_df)

    def _set_status(self, message):
        self.file_label.configure(text=message)

    def _update_dashboard(self, metadata):
        core = metadata.get("effectiveCoreArea") or "-"
        io = metadata.get("effectiveIOArea") or "-"
        self.card_area.configure(text="Core: {}\nIO:   {}".format(core, io))

        self.card_soa.configure(text=str(len(self._soa_df)))
        self.card_tmi.configure(text=str(len(self._tmi_df)))

        self._fill_list(self.top_tmi_box, self._top_tmi_lines())
        self._fill_list(self.top_soa_box, self._top_soa_lines())

    def _top_tmi_lines(self):
        if self._tmi_df.empty:
            return ["No degradation records found."]
        lines = []
        for _, row in self._tmi_df.head(3).iterrows():
            lines.append(
                "#{}  {}  (lifetime {})".format(
                    row["Rank"], row["Instance"], row["lifetime(HCI+BTI)"]
                )
            )
        return lines

    def _top_soa_lines(self):
        if self._soa_df.empty:
            return ["No SOA violations found."]
        lines = []
        for _, row in self._soa_df.head(3).iterrows():
            lines.append(
                "#{}  {}  (worst {}%)".format(
                    row["Rank"], row["Instance"], row["Worst %"]
                )
            )
        return lines

    def _fill_list(self, box, lines):
        box.configure(state="normal")
        box.delete("1.0", "end")
        box.insert("1.0", "\n".join(lines))
        box.configure(state="disabled")

    def _populate_tree(self, tree, df):
        tree.delete(*tree.get_children())
        if df.empty:
            tree["columns"] = ("info",)
            tree.heading("info", text="Info")
            tree.column("info", anchor="w", width=400)
            tree.insert("", "end", values=("No records found.",))
            return

        columns = list(df.columns)
        tree["columns"] = columns
        for col in columns:
            tree.heading(col, text=col)
            width = min(max(len(str(col)) * 9, 80), 420)
            tree.column(col, anchor="w", width=width, stretch=False)

        for _, row in df.iterrows():
            tree.insert("", "end", values=[row[col] for col in columns])


def main():
    app = TmiSoaApp()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
