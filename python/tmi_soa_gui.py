#!/usr/bin/env python3
"""Offline desktop GUI for the TMI/SOA report translator.

Pure standard-library (Tkinter) reimplementation of the web dashboard so the
same analysis is available fully offline, with no browser, Node.js or network
access. It reuses the parsers in ``python/parsers`` and mirrors the web app:
an upload/paste zone, KPI cards, a sortable/filterable data table with CSV
export, simple charts, and a hierarchy tree.

Run:

    python3 python/tmi_soa_gui.py            # open the file picker
    python3 python/tmi_soa_gui.py report.txt # load a report on startup
"""
import csv
import math
import os
import sys
from io import StringIO

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# Allow running as a script from any working directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parsers.detect import detect_and_parse
from parsers.tmi import format_lifetime_years

TOOL_VERSION = "1.0.0"

# ─── Dark theme palette (mirrors the web dashboard) ──────────────────────────
BG = "#030712"          # gray-950
PANEL = "#111827"       # gray-900
PANEL_ALT = "#1f2937"   # gray-800
BORDER = "#374151"      # gray-700
TEXT = "#e5e7eb"        # gray-200
MUTED = "#9ca3af"       # gray-400
FAINT = "#6b7280"       # gray-500
BLUE = "#60a5fa"
RED = "#f87171"
ORANGE = "#fb923c"
YELLOW = "#fbbf24"
GREEN = "#34d399"
PURPLE = "#a78bfa"
TEAL = "#2dd4bf"

CHART_COLORS = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f87171",
                "#38bdf8", "#fb923c", "#c084fc"]

MONO = ("Courier New", 10)
MONO_SM = ("Courier New", 9)
UI = ("Segoe UI", 10)
UI_BOLD = ("Segoe UI", 10, "bold")
UI_TITLE = ("Segoe UI", 16, "bold")


# ─── Formatting helpers (parallel to the web app) ────────────────────────────
def fmt_duration(seconds):
    if seconds is None:
        return "-"
    s = seconds
    if s >= 1:
        return "{:.3f} s".format(s)
    if s >= 1e-3:
        return "{:.3f} ms".format(s * 1e3)
    if s >= 1e-6:
        return "{:.3f} \u00b5s".format(s * 1e6)
    if s >= 1e-9:
        return "{:.3f} ns".format(s * 1e9)
    if s >= 1e-12:
        return "{:.3f} ps".format(s * 1e12)
    return "{:.3e} s".format(s)


def _is_finite_number(value):
    return isinstance(value, (int, float)) and math.isfinite(value)


def lifetime_color(years):
    if not _is_finite_number(years):
        return FAINT
    if years < 1:
        return RED
    if years < 10:
        return ORANGE
    return GREEN


# ─── Report-wide statistics (KPI cards) ──────────────────────────────────────
def soa_kpis(records):
    model_counts, param_counts = {}, {}
    worst_duration, worst_percent, worst_inst = 0.0, 0.0, ""
    for rec in records:
        model_counts[rec["model"]] = model_counts.get(rec["model"], 0) + 1
        for entry in rec["voltageEntries"]:
            param_counts[entry["param"]] = param_counts.get(entry["param"], 0) + 1
            if entry["durationValue"] > worst_duration:
                worst_duration = entry["durationValue"]
                worst_inst = rec["instance"]
            if entry["percentValue"] > worst_percent:
                worst_percent = entry["percentValue"]
    top_model = max(model_counts.items(), key=lambda kv: kv[1], default=None)
    top_param = max(param_counts.items(), key=lambda kv: kv[1], default=None)
    return [
        ("Total Violations", str(len(records)), "", RED),
        ("Top Violated Model", top_model[0] if top_model else "-",
         "{} instances".format(top_model[1] if top_model else 0), ORANGE),
        ("Worst Stress Duration", fmt_duration(worst_duration), worst_inst, YELLOW),
        ("Top Violated Parameter", top_param[0] if top_param else "-",
         "{} occurrences".format(top_param[1] if top_param else 0), PURPLE),
    ]


def tmi_kpis(records):
    finite = [r for r in records if _is_finite_number(r.get("lifetimeHCIBTI"))]
    finite.sort(key=lambda r: r["lifetimeHCIBTI"])
    shortest = finite[0] if finite else None
    below = sum(1 for r in finite if r["lifetimeHCIBTI"] < 10)
    hci_dom = bti_dom = 0
    for r in records:
        h = r["lifetimeHCI"] if _is_finite_number(r.get("lifetimeHCI")) else 1e9
        b = r["lifetimeBTI"] if _is_finite_number(r.get("lifetimeBTI")) else 1e9
        if h < b:
            hci_dom += 1
        elif b < h:
            bti_dom += 1
    dominant = "HCI" if hci_dom > bti_dom else "BTI" if bti_dom > hci_dom else "Mixed"
    return [
        ("Shortest Lifetime",
         format_lifetime_years(shortest["lifetimeHCIBTI"]) if shortest else "-",
         shortest["instance"] if shortest else "N/A", RED),
        ("Devices Below 10 yr", str(below), "lifetime(HCI+BTI) < 10 yr", ORANGE),
        ("Dominant Mechanism", dominant,
         "HCI: {} \u00b7 BTI: {}".format(hci_dom, bti_dom), YELLOW),
        ("Total Analyzed", str(len(records)), "device instances", BLUE),
    ]


# ─── CSV export (matches the web app's download format) ──────────────────────
def report_to_csv(report):
    output = StringIO()
    writer = csv.writer(output, lineterminator="\n")
    if report["type"] == "TMI":
        writer.writerow(["Rank", "Instance", "Lifetime(HCI+BTI,yr)",
                         "Lifetime(HCI,yr)", "Lifetime(BTI,yr)",
                         "Lifetime Item", "EOL Spec", "Model"])
        for r in report["records"]:
            writer.writerow([r["rank"], r["instance"], r["lifetime_hci_bti_raw"],
                             r["lifetime_hci_raw"], r["lifetime_bti_raw"],
                             r["lifetime_item"], r["eol_spec"], r["model"]])
    else:
        writer.writerow(["Rank", "Instance", "#Violations", "Parameters",
                         "WorstDuration(s)", "WorstDutyCycle(%)", "Model"])
        for r in report["records"]:
            params = "+".join(dict.fromkeys(v["param"] for v in r["voltageEntries"]))
            writer.writerow([r["rank"], r["instance"], len(r["voltageEntries"]),
                             params, r["worstDuration"], r["worstPercent"], r["model"]])
    return output.getvalue()


# ─── Small reusable widgets ──────────────────────────────────────────────────
class KpiCard(tk.Frame):
    def __init__(self, master, label, value, sub, accent):
        super().__init__(master, bg=PANEL, highlightbackground=BORDER,
                         highlightthickness=1, padx=16, pady=12)
        tk.Label(self, text=label.upper(), bg=PANEL, fg=accent,
                 font=("Segoe UI", 8, "bold")).pack(anchor="w")
        tk.Label(self, text=value, bg=PANEL, fg=TEXT,
                 font=("Segoe UI", 18, "bold"), anchor="w",
                 wraplength=220, justify="left").pack(anchor="w", pady=(4, 0))
        if sub:
            tk.Label(self, text=sub, bg=PANEL, fg=FAINT, font=("Segoe UI", 8),
                     anchor="w", wraplength=220, justify="left").pack(anchor="w")


class BarChart(tk.Canvas):
    """Minimal horizontal/vertical bar chart drawn on a canvas."""

    def __init__(self, master, data, horizontal=False, unit="", height=260,
                 threshold=None, colorer=None):
        super().__init__(master, bg=PANEL, height=height, highlightthickness=0)
        self.data = data
        self.horizontal = horizontal
        self.unit = unit
        self.threshold = threshold
        self.colorer = colorer
        self.bind("<Configure>", lambda _e: self._draw())

    def _draw(self):
        self.delete("all")
        if not self.data:
            self.create_text(self.winfo_width() // 2, self.winfo_height() // 2,
                             text="No data", fill=FAINT, font=UI)
            return
        w, h = self.winfo_width(), self.winfo_height()
        max_val = max((v for _, v in self.data), default=0) or 1
        if self.horizontal:
            self._draw_horizontal(w, h, max_val)
        else:
            self._draw_vertical(w, h, max_val)

    def _bar_color(self, idx, value):
        if self.colorer:
            return self.colorer(value)
        return CHART_COLORS[idx % len(CHART_COLORS)]

    def _draw_horizontal(self, w, h, max_val):
        left, right, top, bottom = 150, 40, 12, 12
        n = len(self.data)
        gap = 6
        bh = max(6, (h - top - bottom - gap * (n - 1)) / n)
        if self.threshold is not None and max_val:
            tx = left + (w - left - right) * (self.threshold / max_val)
            self.create_line(tx, top, tx, h - bottom, fill=YELLOW, dash=(4, 4))
        for i, (name, value) in enumerate(self.data):
            y = top + i * (bh + gap)
            bar_w = (w - left - right) * (value / max_val)
            self.create_rectangle(left, y, left + bar_w, y + bh,
                                  fill=self._bar_color(i, value), width=0)
            self.create_text(left - 8, y + bh / 2, text=name, anchor="e",
                             fill=MUTED, font=MONO_SM)
            label = "{:.4g}{}".format(value, self.unit) if isinstance(value, float) \
                else "{}{}".format(value, self.unit)
            self.create_text(left + bar_w + 6, y + bh / 2, text=label,
                             anchor="w", fill=TEXT, font=MONO_SM)

    def _draw_vertical(self, w, h, max_val):
        left, right, top, bottom = 40, 16, 16, 40
        n = len(self.data)
        gap = 10
        bw = max(8, (w - left - right - gap * (n - 1)) / n)
        for i, (name, value) in enumerate(self.data):
            x = left + i * (bw + gap)
            bar_h = (h - top - bottom) * (value / max_val)
            y = h - bottom - bar_h
            self.create_rectangle(x, y, x + bw, h - bottom,
                                  fill=self._bar_color(i, value), width=0)
            self.create_text(x + bw / 2, y - 8, text=str(value), fill=TEXT,
                             font=MONO_SM)
            self.create_text(x + bw / 2, h - bottom + 12, text=name, fill=MUTED,
                             font=MONO_SM, anchor="n")


class PieChart(tk.Canvas):
    def __init__(self, master, data, height=240):
        super().__init__(master, bg=PANEL, height=height, highlightthickness=0)
        self.data = [(n, v) for n, v in data if v > 0]
        self.bind("<Configure>", lambda _e: self._draw())

    def _draw(self):
        self.delete("all")
        total = sum(v for _, v in self.data)
        if not total:
            self.create_text(self.winfo_width() // 2, self.winfo_height() // 2,
                             text="No data", fill=FAINT, font=UI)
            return
        w, h = self.winfo_width(), self.winfo_height()
        r = min(w, h) / 2 - 20
        cx, cy = min(w / 2, r + 20), h / 2
        start = 90.0
        for i, (name, value) in enumerate(self.data):
            extent = -360.0 * value / total
            self.create_arc(cx - r, cy - r, cx + r, cy + r, start=start,
                            extent=extent, fill=CHART_COLORS[i % len(CHART_COLORS)],
                            outline=PANEL)
            start += extent
        ly = 20
        for i, (name, value) in enumerate(self.data):
            lx = cx + r + 24
            self.create_rectangle(lx, ly, lx + 12, ly + 12,
                                  fill=CHART_COLORS[i % len(CHART_COLORS)], width=0)
            self.create_text(lx + 18, ly + 6, text="{}: {}".format(name, value),
                             anchor="w", fill=MUTED, font=MONO_SM)
            ly += 20


# ─── Main application ────────────────────────────────────────────────────────
class TranslatorApp(tk.Tk):
    def __init__(self, initial_path=None):
        super().__init__()
        self.title("TMI / SOA Report Analyzer")
        self.configure(bg=BG)
        self.geometry("1180x760")
        self.minsize(900, 600)
        self._configure_style()

        self.reports = []       # list of report dicts currently loaded
        self.active_index = 0
        self.sort_state = {}    # column -> ascending bool, per active report

        self.container = tk.Frame(self, bg=BG)
        self.container.pack(fill="both", expand=True)
        self._show_upload()

        if initial_path:
            self.after(50, lambda: self._load_path(initial_path))

    def _configure_style(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Treeview", background=PANEL, fieldbackground=PANEL,
                        foreground=TEXT, rowheight=24, font=MONO_SM, borderwidth=0)
        style.configure("Treeview.Heading", background=PANEL_ALT, foreground=MUTED,
                        font=UI_BOLD, relief="flat")
        style.map("Treeview.Heading", background=[("active", BORDER)])
        style.map("Treeview", background=[("selected", "#1d4ed8")],
                  foreground=[("selected", "#ffffff")])
        style.configure("TNotebook", background=BG, borderwidth=0)
        style.configure("TNotebook.Tab", background=PANEL, foreground=MUTED,
                        padding=(16, 8), font=UI)
        style.map("TNotebook.Tab", background=[("selected", PANEL_ALT)],
                  foreground=[("selected", BLUE)])

    def _clear(self):
        for child in self.container.winfo_children():
            child.destroy()

    # ── Upload view ──────────────────────────────────────────────────────────
    def _show_upload(self):
        self._clear()
        wrap = tk.Frame(self.container, bg=BG)
        wrap.place(relx=0.5, rely=0.5, anchor="center")

        tk.Label(wrap, text="TMI / SOA Report Analyzer", bg=BG, fg=TEXT,
                 font=UI_TITLE).pack()
        tk.Label(wrap, text="Cadence Virtuoso reliability & safe-operating-area "
                 "analysis \u2014 offline", bg=BG, fg=MUTED, font=UI).pack(pady=(2, 20))

        drop = tk.Frame(wrap, bg=PANEL, highlightbackground=BORDER,
                        highlightthickness=2, padx=60, pady=40)
        drop.pack()
        tk.Label(drop, text="Open a report file", bg=PANEL, fg=TEXT,
                 font=UI_BOLD).pack()
        tk.Label(drop, text=".txt / .log / .rpt \u2014 SOA & TMI reports",
                 bg=PANEL, fg=FAINT, font=("Segoe UI", 9)).pack(pady=(2, 12))
        tk.Button(drop, text="Browse\u2026", command=self._browse, bg="#2563eb",
                  fg="white", font=UI_BOLD, relief="flat", padx=18, pady=6,
                  activebackground="#1d4ed8", activeforeground="white").pack()

        tk.Label(wrap, text="\u2014 or paste report text \u2014", bg=BG, fg=FAINT,
                 font=("Segoe UI", 9)).pack(pady=(18, 6))
        self.paste_box = tk.Text(wrap, width=80, height=10, bg=PANEL, fg=TEXT,
                                 insertbackground=TEXT, font=MONO_SM,
                                 relief="flat", highlightbackground=BORDER,
                                 highlightthickness=1)
        self.paste_box.pack()
        tk.Button(wrap, text="Analyze pasted text", command=self._analyze_paste,
                  bg=PANEL_ALT, fg=TEXT, font=UI, relief="flat", padx=14, pady=6,
                  activebackground=BORDER, activeforeground="white").pack(pady=10)

    def _browse(self):
        path = filedialog.askopenfilename(
            title="Select a SOA or TMI report",
            filetypes=[("Report files", "*.txt *.log *.rpt"), ("All files", "*.*")])
        if path:
            self._load_path(path)

    def _analyze_paste(self):
        text = self.paste_box.get("1.0", "end").strip()
        if not text:
            return
        self._load_text(text)

    def _load_path(self, path):
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as handle:
                text = handle.read()
        except OSError as exc:
            messagebox.showerror("Cannot open file", str(exc))
            return
        self._load_text(text)

    def _load_text(self, text):
        parsed = detect_and_parse(text)
        if not parsed:
            messagebox.showwarning(
                "No report detected",
                "Could not detect a valid SOA or TMI report in the supplied text.")
            return
        self.reports = parsed if isinstance(parsed, list) else [parsed]
        self.active_index = 0
        self._show_dashboard()

    # ── Dashboard view ───────────────────────────────────────────────────────
    def _show_dashboard(self):
        self._clear()
        self.sort_state = {}
        report = self.reports[self.active_index]

        header = tk.Frame(self.container, bg=PANEL, padx=16, pady=10)
        header.pack(fill="x")
        tk.Label(header, text="TMI / SOA Analyzer", bg=PANEL, fg=TEXT,
                 font=UI_BOLD).pack(side="left")
        badge_bg = "#7c2d12" if report["type"] == "SOA" else "#1e3a8a"
        badge_fg = ORANGE if report["type"] == "SOA" else BLUE
        tk.Label(header, text=" {} Report ".format(report["type"]), bg=badge_bg,
                 fg=badge_fg, font=("Segoe UI", 9, "bold")).pack(side="left", padx=10)

        for label, value in self._meta_chips(report):
            tk.Label(header, text="{}: {}".format(label, value), bg=PANEL_ALT,
                     fg=MUTED, font=MONO_SM, padx=6, pady=2).pack(side="left", padx=3)

        tk.Button(header, text="New Report", command=self._show_upload, bg=PANEL_ALT,
                  fg=TEXT, font=UI, relief="flat", padx=12, pady=4,
                  activebackground=BORDER, activeforeground="white").pack(side="right")

        if len(self.reports) > 1:
            selector = tk.Frame(self.container, bg=PANEL_ALT, padx=16, pady=6)
            selector.pack(fill="x")
            tk.Label(selector, text="Both report types detected:", bg=PANEL_ALT,
                     fg=FAINT, font=("Segoe UI", 9)).pack(side="left", padx=(0, 8))
            for i, rep in enumerate(self.reports):
                active = i == self.active_index
                tk.Button(selector, text=rep["type"],
                          command=lambda idx=i: self._switch_report(idx),
                          bg="#1e3a8a" if active else PANEL, fg=TEXT if active else MUTED,
                          font=UI, relief="flat", padx=12, pady=2).pack(side="left", padx=3)

        # KPI cards
        kpis = soa_kpis(report["records"]) if report["type"] == "SOA" \
            else tmi_kpis(report["records"])
        kpi_row = tk.Frame(self.container, bg=BG, padx=16, pady=12)
        kpi_row.pack(fill="x")
        for label, value, sub, accent in kpis:
            KpiCard(kpi_row, label, value, sub, accent).pack(
                side="left", fill="both", expand=True, padx=6)

        notebook = ttk.Notebook(self.container)
        notebook.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        notebook.add(self._build_table_tab(notebook, report), text="Data Table")
        notebook.add(self._build_charts_tab(notebook, report), text="Charts")
        notebook.add(self._build_hierarchy_tab(notebook, report), text="Hierarchy")

    def _switch_report(self, index):
        self.active_index = index
        self._show_dashboard()

    def _meta_chips(self, report):
        chips = []
        meta = report.get("metadata", {})
        if report["type"] == "TMI":
            for key, label in (("coreDeviceCount", "Core devices"),
                               ("ioDeviceCount", "IO devices"),
                               ("effectiveCoreArea", "Area"),
                               ("sumDageTime", "dageTime")):
                if meta.get(key) is not None:
                    chips.append((label, meta[key]))
        elif meta.get("sortingNum") is not None:
            chips.append(("soa_sorting_num", meta["sortingNum"]))
        chips.append(("Rows", len(report["records"])))
        return chips

    # ── Data table tab ───────────────────────────────────────────────────────
    def _build_table_tab(self, master, report):
        frame = tk.Frame(master, bg=BG)
        is_tmi = report["type"] == "TMI"

        controls = tk.Frame(frame, bg=BG, pady=8)
        controls.pack(fill="x")
        tk.Label(controls, text="Filter:", bg=BG, fg=MUTED, font=UI).pack(side="left")
        query_var = tk.StringVar()
        entry = tk.Entry(controls, textvariable=query_var, bg=PANEL, fg=TEXT,
                         insertbackground=TEXT, font=UI, relief="flat",
                         highlightbackground=BORDER, highlightthickness=1, width=40)
        entry.pack(side="left", padx=8)
        count_var = tk.StringVar()
        tk.Label(controls, textvariable=count_var, bg=BG, fg=FAINT,
                 font=("Segoe UI", 9)).pack(side="left", padx=8)
        tk.Button(controls, text="Export CSV",
                  command=lambda: self._export_csv(report), bg=PANEL_ALT, fg=TEXT,
                  font=UI, relief="flat", padx=12, pady=3,
                  activebackground=BORDER, activeforeground="white").pack(side="right")

        if is_tmi:
            columns = [("rank", "Rank", 60), ("instance", "Instance", 240),
                       ("lifetimeHCIBTI", "Lifetime HCI+BTI", 130),
                       ("lifetimeHCI", "Lifetime HCI", 120),
                       ("lifetimeBTI", "Lifetime BTI", 120),
                       ("lifetime_item", "Item", 90), ("eol_spec", "EOL Spec", 90),
                       ("model", "Model", 160)]
        else:
            columns = [("rank", "Rank", 60), ("instance", "Instance", 260),
                       ("count", "# Params", 80), ("params", "Parameters", 150),
                       ("worstDuration", "Worst Duration", 130),
                       ("worstPercent", "Duty Cycle %", 110), ("model", "Model", 150)]

        tree_wrap = tk.Frame(frame, bg=BG)
        tree_wrap.pack(fill="both", expand=True)
        tree = ttk.Treeview(tree_wrap, columns=[c[0] for c in columns],
                            show="tree headings", selectmode="browse")
        tree.column("#0", width=24, stretch=False)
        for key, label, width in columns:
            tree.heading(key, text=label,
                         command=lambda k=key: self._sort_table(k, report, columns,
                                                                 tree, query_var,
                                                                 count_var))
            anchor = "w" if key in ("instance", "params", "model") else "center"
            tree.column(key, width=width, anchor=anchor)
        vsb = ttk.Scrollbar(tree_wrap, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vsb.set)
        tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        for color, name in ((RED, "red"), (ORANGE, "orange"), (GREEN, "green"),
                            (FAINT, "faint"), (MUTED, "detail")):
            tree.tag_configure(name, foreground=color)

        query_var.trace_add("write", lambda *_: self._populate_table(
            report, columns, tree, query_var, count_var))
        self._populate_table(report, columns, tree, query_var, count_var)
        return frame

    def _filtered_sorted(self, report, query_key):
        query = query_key.lower()
        records = [r for r in report["records"]
                   if query in r["instance"].lower() or query in r["model"].lower()]
        state = self.sort_state.get("__active__")
        if state:
            key, ascending = state
            records = self._sorted_records(records, key, ascending)
        return records

    @staticmethod
    def _sort_value(record, key):
        if key == "count":
            return len(record["voltageEntries"])
        if key == "params":
            return "+".join(dict.fromkeys(v["param"] for v in record["voltageEntries"]))
        value = record.get(key)
        if value is None:
            return math.inf
        return value

    def _sorted_records(self, records, key, ascending):
        def sort_key(record):
            value = self._sort_value(record, key)
            if isinstance(value, str):
                return (1, value.lower())
            if value is None or (isinstance(value, float) and math.isinf(value)):
                return (2, 0)
            return (0, value)
        return sorted(records, key=sort_key, reverse=not ascending)

    def _sort_table(self, key, report, columns, tree, query_var, count_var):
        state = self.sort_state.get("__active__")
        ascending = not (state and state[0] == key and state[1])
        self.sort_state["__active__"] = (key, ascending)
        self._populate_table(report, columns, tree, query_var, count_var)

    def _populate_table(self, report, columns, tree, query_var, count_var):
        tree.delete(*tree.get_children())
        records = self._filtered_sorted(report, query_var.get())
        is_tmi = report["type"] == "TMI"
        for rec in records:
            if is_tmi:
                values = [rec["rank"], rec["instance"],
                          format_lifetime_years(rec.get("lifetimeHCIBTI")),
                          format_lifetime_years(rec.get("lifetimeHCI")),
                          format_lifetime_years(rec.get("lifetimeBTI")),
                          rec["lifetime_item"], rec["eol_spec"], rec["model"]]
                tag = self._lifetime_tag(rec.get("lifetimeHCIBTI"))
                tree.insert("", "end", values=values, tags=(tag,))
            else:
                params = "+".join(dict.fromkeys(v["param"] for v in rec["voltageEntries"]))
                values = [rec["rank"], rec["instance"], len(rec["voltageEntries"]),
                          params, fmt_duration(rec["worstDuration"]),
                          "{:.2f}%".format(rec["worstPercent"]), rec["model"]]
                parent = tree.insert("", "end", values=values)
                for v in rec["voltageEntries"]:
                    detail = "{} as {} | range {} | dur {} | duty {}".format(
                        v["param"], v["condition"], v["range"], v["duration"],
                        v["percent"])
                    tree.insert(parent, "end", values=["", detail, "", "", "", "", ""],
                                tags=("detail",))
        count_var.set("{} of {} rows".format(len(records), len(report["records"])))

    @staticmethod
    def _lifetime_tag(years):
        if not _is_finite_number(years):
            return "faint"
        if years < 1:
            return "red"
        if years < 10:
            return "orange"
        return "green"

    def _export_csv(self, report):
        path = filedialog.asksaveasfilename(
            title="Export CSV", defaultextension=".csv",
            initialfile="{}_report.csv".format(report["type"].lower()),
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")])
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8", newline="") as handle:
                handle.write(report_to_csv(report))
        except OSError as exc:
            messagebox.showerror("Export failed", str(exc))
            return
        messagebox.showinfo("Export complete", "Saved {} rows to\n{}".format(
            len(report["records"]), path))

    # ── Charts tab ───────────────────────────────────────────────────────────
    def _build_charts_tab(self, master, report):
        outer = tk.Frame(master, bg=BG)
        canvas = tk.Canvas(outer, bg=BG, highlightthickness=0)
        scroll = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        inner = tk.Frame(canvas, bg=BG)
        inner.bind("<Configure>",
                   lambda _e: canvas.configure(scrollregion=canvas.bbox("all")))
        window = canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.bind("<Configure>", lambda e: canvas.itemconfigure(window, width=e.width))
        canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

        if report["type"] == "TMI":
            self._tmi_charts(inner, report["records"])
        else:
            self._soa_charts(inner, report["records"])
        return outer

    def _chart_panel(self, master, title, subtitle):
        panel = tk.Frame(master, bg=PANEL, highlightbackground=BORDER,
                         highlightthickness=1, padx=16, pady=12)
        panel.pack(fill="x", padx=8, pady=8)
        tk.Label(panel, text=title, bg=PANEL, fg=TEXT, font=UI_BOLD).pack(anchor="w")
        tk.Label(panel, text=subtitle, bg=PANEL, fg=FAINT,
                 font=("Segoe UI", 9)).pack(anchor="w", pady=(0, 8))
        return panel

    def _tmi_charts(self, master, records):
        finite = [r for r in records if _is_finite_number(r.get("lifetimeHCIBTI"))]
        finite.sort(key=lambda r: r["lifetimeHCIBTI"])
        top10 = [(".".join(r["instance"].split(".")[-2:]), r["lifetimeHCIBTI"])
                 for r in finite[:10]]
        panel = self._chart_panel(master, "Top 10 Worst Lifetime Instances",
                                  "Shortest lifetime(HCI+BTI) \u2014 red <1 yr \u00b7 "
                                  "orange <10 yr \u00b7 green \u226510 yr")
        BarChart(panel, top10, horizontal=True, unit=" yr", height=300,
                 threshold=10, colorer=lifetime_color).pack(fill="x")

        hci = bti = mixed = 0
        for r in records:
            c = r.get("lifetimeHCIBTI")
            if not _is_finite_number(c):
                continue
            h = r["lifetimeHCI"] if _is_finite_number(r.get("lifetimeHCI")) else math.inf
            b = r["lifetimeBTI"] if _is_finite_number(r.get("lifetimeBTI")) else math.inf
            if h < b * 0.5:
                hci += 1
            elif b < h * 0.5:
                bti += 1
            else:
                mixed += 1
        panel = self._chart_panel(master, "Degradation Mechanism Breakdown",
                                  "For instances with finite lifetime \u2014 which "
                                  "mechanism limits reliability most")
        PieChart(panel, [("HCI dominant", hci), ("BTI dominant", bti),
                         ("Mixed / Equal", mixed)]).pack(fill="x")

    def _soa_charts(self, master, records):
        param_counts, model_counts = {}, {}
        buckets = {"0%": 0, "0-1%": 0, "1-10%": 0, "10-50%": 0, ">50%": 0}
        for r in records:
            model_counts[r["model"]] = model_counts.get(r["model"], 0) + 1
            for v in r["voltageEntries"]:
                param_counts[v["param"]] = param_counts.get(v["param"], 0) + 1
                p = v["percentValue"]
                if p == 0:
                    buckets["0%"] += 1
                elif p < 1:
                    buckets["0-1%"] += 1
                elif p < 10:
                    buckets["1-10%"] += 1
                elif p < 50:
                    buckets["10-50%"] += 1
                else:
                    buckets[">50%"] += 1

        param_dist = sorted(param_counts.items(), key=lambda kv: kv[1], reverse=True)
        panel = self._chart_panel(master, "Voltage Parameter Violation Frequency",
                                  "Total count of each violation type across all instances")
        BarChart(panel, param_dist, horizontal=False, height=260).pack(fill="x")

        panel = self._chart_panel(master, "Duty Cycle Distribution",
                                  "% of simulation time spent in violation")
        PieChart(panel, list(buckets.items())).pack(fill="x")

        model_dist = sorted(model_counts.items(), key=lambda kv: kv[1],
                            reverse=True)[:10]
        panel = self._chart_panel(master, "Top Violated Model Types",
                                  "Instance count per transistor model")
        BarChart(panel, model_dist, horizontal=True, height=240).pack(fill="x")

    # ── Hierarchy tab ────────────────────────────────────────────────────────
    def _build_hierarchy_tab(self, master, report):
        frame = tk.Frame(master, bg=BG)
        tk.Label(frame, text="Hierarchical view grouped by schematic path.",
                 bg=BG, fg=FAINT, font=("Segoe UI", 9)).pack(anchor="w", pady=6)
        tree_wrap = tk.Frame(frame, bg=BG)
        tree_wrap.pack(fill="both", expand=True)
        tree = ttk.Treeview(tree_wrap, columns=("count", "stat"), show="tree headings")
        tree.heading("#0", text="Path")
        tree.heading("count", text="Devices")
        tree.heading("stat", text="Worst")
        tree.column("#0", width=420)
        tree.column("count", width=90, anchor="center")
        tree.column("stat", width=120, anchor="center")
        vsb = ttk.Scrollbar(tree_wrap, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vsb.set)
        tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        for color, name in ((RED, "red"), (ORANGE, "orange"), (GREEN, "green"),
                            (YELLOW, "yellow"), (MUTED, "leaf")):
            tree.tag_configure(name, foreground=color)

        root = self._build_hierarchy(report["records"])
        self._insert_hierarchy(tree, "", root, report["type"])
        return frame

    @staticmethod
    def _build_hierarchy(records):
        root = {"children": {}, "records": []}
        for rec in records:
            node = root
            for part in rec["instance"].split("."):
                node = node["children"].setdefault(
                    part, {"name": part, "children": {}, "records": []})
            node["records"].append(rec)
        return root

    def _node_stats(self, node, report_type):
        count = len(node["records"])
        if report_type == "TMI":
            worst = math.inf
            for r in node["records"]:
                v = r.get("lifetimeHCIBTI")
                if _is_finite_number(v):
                    worst = min(worst, v)
        else:
            worst = 0.0
            for r in node["records"]:
                worst = max(worst, r["worstPercent"])
        for child in node["children"].values():
            c_count, c_worst = self._node_stats(child, report_type)
            count += c_count
            if report_type == "TMI":
                worst = min(worst, c_worst)
            else:
                worst = max(worst, c_worst)
        return count, worst

    def _insert_hierarchy(self, tree, parent, node, report_type):
        for name, child in node["children"].items():
            count, worst = self._node_stats(child, report_type)
            if report_type == "TMI":
                stat = format_lifetime_years(worst) if math.isfinite(worst) else ""
                tag = self._lifetime_tag(worst) if math.isfinite(worst) else "leaf"
            else:
                stat = "{:.2f}%".format(worst) if worst else ""
                tag = ("red" if worst > 50 else "orange" if worst > 10
                       else "yellow") if worst else "leaf"
            item = tree.insert(parent, "end", text=name, values=(count, stat),
                               tags=(tag,), open=parent == "")
            self._insert_hierarchy(tree, item, child, report_type)
            for rec in child["records"]:
                if report_type == "TMI":
                    leaf_stat = format_lifetime_years(rec.get("lifetimeHCIBTI"))
                    leaf_tag = self._lifetime_tag(rec.get("lifetimeHCIBTI"))
                else:
                    leaf_stat = "{} violations".format(len(rec["voltageEntries"]))
                    leaf_tag = "leaf"
                tree.insert(item, "end", text=rec["instance"].split(".")[-1],
                            values=(rec["model"], leaf_stat), tags=(leaf_tag,))


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    initial = argv[0] if argv else None
    try:
        app = TranslatorApp(initial_path=initial)
    except tk.TclError as exc:
        sys.stderr.write(
            "Unable to start the GUI (no display available?): {}\n".format(exc))
        return 1
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
