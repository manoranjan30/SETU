#!/usr/bin/env python3
"""GUI wrapper for BOQ converter with optional Ollama setup.

This stays outside core app under temp Workings.
"""

import os
import shutil
import subprocess
import threading
import time
import csv
import json
import uuid
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import boq_converter as converter

INSTRUCTION_PRESETS = {
    "Balanced (Recommended)": (
        "Summarize BOQ scope in 8-16 words. Keep technical intent, material/system name, and execution method. "
        "No invented hierarchy, no vague text."
    ),
    "Technical Strict": (
        "Use technical construction wording. Preserve method and material terms. "
        "Do not simplify domain terms. 8-16 words only."
    ),
    "Commercial Focus": (
        "Summarize scope with cost-relevant signals: material, installation, treatment, and coverage context. "
        "No extra claims. 8-16 words."
    ),
    "Ultra Short": (
        "Return very compact summary 6-10 words, retain only primary scope and material."
    ),
}

class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("BOQ Smart Converter")
        self.geometry("860x620")
        self.minsize(760, 560)

        self.input_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.strict_var = tk.BooleanVar(value=True)
        self.summary_mode_var = tk.StringVar(value="heuristic")
        self.model_var = tk.StringVar(value="qwen2.5:0.5b")
        self.model_custom_var = tk.StringVar(value="")
        self.download_model_var = tk.StringVar(value="qwen2.5:0.5b")
        self.timeout_var = tk.StringVar(value="20")
        self.instruction_preset_var = tk.StringVar(value="Balanced (Recommended)")
        self.instruction_name_var = tk.StringVar(value="Custom BOQ Summary")
        self.saved_instruction_var = tk.StringVar(value="")
        self.status_var = tk.StringVar(value="Ready")
        self.progress_var = tk.DoubleVar(value=0.0)
        self.manual_map_var = tk.BooleanVar(value=False)
        self.header_options: list[str] = []

        self.map_code_var = tk.StringVar(value="")
        self.map_desc_var = tk.StringVar(value="")
        self.map_uom_var = tk.StringVar(value="")
        self.map_qty_var = tk.StringVar(value="")
        self.map_rate_var = tk.StringVar(value="")
        self.map_amount_var = tk.StringVar(value="")
        self.map_remarks_var = tk.StringVar(value="")
        self.instruction_profiles: list[dict] = []
        self.instructions_store_path = os.path.join(os.path.dirname(__file__), "instruction_profiles.json")
        self.system_models: list[str] = []

        self._build_ui()
        self._prefill_paths()
        self._refresh_ollama_status()

    def _build_ui(self) -> None:
        outer = ttk.Frame(self)
        outer.pack(fill="both", expand=True)

        canvas = tk.Canvas(outer, highlightthickness=0)
        vscroll = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vscroll.set)

        vscroll.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        frame = ttk.Frame(canvas, padding=12)
        canvas_window = canvas.create_window((0, 0), window=frame, anchor="nw")

        def _on_frame_configure(_event=None) -> None:
            canvas.configure(scrollregion=canvas.bbox("all"))

        def _on_canvas_configure(event) -> None:
            canvas.itemconfigure(canvas_window, width=event.width)

        frame.bind("<Configure>", _on_frame_configure)
        canvas.bind("<Configure>", _on_canvas_configure)
        self._bind_mousewheel(canvas)

        title = ttk.Label(frame, text="BOQ CSV Converter", font=("Segoe UI", 14, "bold"))
        title.pack(anchor="w")

        subtitle = ttk.Label(
            frame,
            text="Convert standard BOQ to import template with auto item/sub-item tagging and long-description merge.",
        )
        subtitle.pack(anchor="w", pady=(0, 12))

        file_box = ttk.LabelFrame(frame, text="Files", padding=10)
        file_box.pack(fill="x")

        self._path_row(file_box, "Input CSV", self.input_var, self._pick_input, 0)
        self._path_row(file_box, "Output CSV", self.output_var, self._pick_output, 1)

        opt_box = ttk.LabelFrame(frame, text="Conversion Options", padding=10)
        opt_box.pack(fill="x", pady=(12, 0))

        strict_cb = ttk.Checkbutton(opt_box, text="Strict mode (create review file)", variable=self.strict_var)
        strict_cb.grid(row=0, column=0, sticky="w", pady=(0, 8))

        ttk.Label(opt_box, text="Summary Mode").grid(row=1, column=0, sticky="w")
        summary_combo = ttk.Combobox(
            opt_box,
            values=["none", "heuristic", "ollama"],
            textvariable=self.summary_mode_var,
            state="readonly",
            width=18,
        )
        summary_combo.grid(row=1, column=1, sticky="w", padx=(8, 18))
        summary_combo.bind("<<ComboboxSelected>>", lambda _e: self._toggle_ollama_fields())

        ttk.Label(opt_box, text="LLM Model").grid(row=1, column=2, sticky="w")
        self.model_combo = ttk.Combobox(
            opt_box,
            values=["custom"],
            textvariable=self.model_var,
            state="readonly",
            width=20,
        )
        self.model_combo.grid(row=1, column=3, sticky="w", padx=(8, 8))
        self.model_combo.bind("<<ComboboxSelected>>", lambda _e: self._toggle_ollama_fields())
        self.model_custom_entry = ttk.Entry(opt_box, textvariable=self.model_custom_var, width=18)
        self.model_custom_entry.grid(row=1, column=4, sticky="w")

        ttk.Label(opt_box, text="Timeout (s)").grid(row=1, column=5, sticky="w")
        self.timeout_entry = ttk.Entry(opt_box, textvariable=self.timeout_var, width=8)
        self.timeout_entry.grid(row=1, column=6, sticky="w", padx=(8, 0))

        ttk.Label(opt_box, text="LLM Instruction Preset").grid(row=2, column=0, sticky="w", pady=(10, 0))
        preset_combo = ttk.Combobox(
            opt_box,
            values=list(INSTRUCTION_PRESETS.keys()),
            textvariable=self.instruction_preset_var,
            state="readonly",
            width=32,
        )
        preset_combo.grid(row=2, column=1, columnspan=2, sticky="w", padx=(8, 18), pady=(10, 0))
        preset_combo.bind("<<ComboboxSelected>>", lambda _e: self._apply_instruction_preset())

        ttk.Button(opt_box, text="Apply Preset", command=self._apply_instruction_preset).grid(
            row=2, column=3, sticky="w", pady=(10, 0)
        )

        ttk.Label(opt_box, text="Custom LLM Instruction").grid(row=3, column=0, sticky="nw", pady=(10, 0))
        self.instruction_text = tk.Text(opt_box, height=4, width=72, wrap="word")
        self.instruction_text.grid(row=3, column=1, columnspan=6, sticky="we", padx=(8, 0), pady=(10, 0))

        ttk.Label(opt_box, text="Instruction Name").grid(row=4, column=0, sticky="w", pady=(8, 0))
        ttk.Entry(opt_box, textvariable=self.instruction_name_var, width=30).grid(
            row=4, column=1, sticky="w", padx=(8, 8), pady=(8, 0)
        )
        ttk.Label(opt_box, text="Saved Instructions").grid(row=4, column=2, sticky="w", pady=(8, 0))
        self.saved_instruction_combo = ttk.Combobox(
            opt_box,
            textvariable=self.saved_instruction_var,
            state="readonly",
            width=32,
        )
        self.saved_instruction_combo.grid(row=4, column=3, columnspan=2, sticky="w", padx=(8, 8), pady=(8, 0))
        ttk.Button(opt_box, text="Load", command=self._load_selected_instruction).grid(row=4, column=5, sticky="w", pady=(8, 0))
        ttk.Button(opt_box, text="Save New", command=self._save_new_instruction).grid(row=5, column=1, sticky="w", pady=(8, 0))
        ttk.Button(opt_box, text="Update", command=self._update_instruction).grid(row=5, column=2, sticky="w", pady=(8, 0))
        ttk.Button(opt_box, text="Delete", command=self._delete_instruction).grid(row=5, column=3, sticky="w", pady=(8, 0))

        map_box = ttk.LabelFrame(frame, text="Column Mapping (Optional)", padding=10)
        map_box.pack(fill="x", pady=(12, 0))
        ttk.Checkbutton(
            map_box,
            text="Use manual mapping",
            variable=self.manual_map_var,
            command=self._toggle_mapping_controls,
        ).grid(row=0, column=0, sticky="w")
        ttk.Button(map_box, text="Load Headers From Input", command=self._load_headers_from_input).grid(
            row=0, column=1, sticky="w", padx=(8, 0)
        )

        self.map_controls: list[ttk.Combobox] = []
        self.map_controls.append(self._map_row(map_box, "Item No / Serial", self.map_code_var, 1))
        self.map_controls.append(self._map_row(map_box, "Description", self.map_desc_var, 2))
        self.map_controls.append(self._map_row(map_box, "UOM", self.map_uom_var, 3))
        self.map_controls.append(self._map_row(map_box, "Qty", self.map_qty_var, 4))
        self.map_controls.append(self._map_row(map_box, "Rate", self.map_rate_var, 5))
        self.map_controls.append(self._map_row(map_box, "Amount", self.map_amount_var, 6))
        self.map_controls.append(self._map_row(map_box, "Remarks (optional)", self.map_remarks_var, 7))

        run_box = ttk.Frame(frame)
        run_box.pack(fill="x", pady=(12, 0))
        ttk.Button(run_box, text="Convert Now", command=self._convert_async).pack(side="left")
        ttk.Button(run_box, text="Open Output Folder", command=self._open_output_folder).pack(side="left", padx=8)
        ttk.Label(run_box, textvariable=self.status_var).pack(side="left", padx=16)

        progress = ttk.Progressbar(frame, mode="determinate", variable=self.progress_var, maximum=100)
        progress.pack(fill="x", pady=(8, 0))
        self.progress = progress

        llm_box = ttk.LabelFrame(frame, text="Ollama Setup (Optional)", padding=10)
        llm_box.pack(fill="x", pady=(12, 0))

        self.ollama_status = ttk.Label(llm_box, text="Checking ollama...")
        self.ollama_status.grid(row=0, column=0, columnspan=4, sticky="w", pady=(0, 8))

        ttk.Button(llm_box, text="Refresh Status", command=self._refresh_ollama_status).grid(row=1, column=0, sticky="w")
        ttk.Button(llm_box, text="Install Ollama (winget)", command=self._install_ollama_async).grid(
            row=1, column=1, sticky="w", padx=8
        )
        ttk.Label(llm_box, text="Model to Download").grid(row=2, column=0, sticky="w", pady=(8, 0))
        ttk.Entry(llm_box, textvariable=self.download_model_var, width=30).grid(row=2, column=1, sticky="w", pady=(8, 0))
        ttk.Button(llm_box, text="Download Model", command=self._pull_model_async).grid(row=2, column=2, sticky="w", pady=(8, 0))
        ttk.Button(llm_box, text="List Models", command=self._list_models_async).grid(row=1, column=3, sticky="w", padx=8)
        ttk.Button(llm_box, text="Open Ollama Download Page", command=self._open_ollama_download).grid(
            row=3, column=0, columnspan=2, sticky="w", pady=(8, 0)
        )

        log_box = ttk.LabelFrame(frame, text="Processing Log Panel", padding=10)
        log_box.pack(fill="both", expand=True, pady=(12, 0))

        self.log = tk.Text(log_box, height=12, wrap="word")
        self.log.pack(fill="both", expand=True)

        self._toggle_ollama_fields()
        self._apply_instruction_preset()
        self._toggle_mapping_controls()
        self._load_instruction_profiles()

    def _bind_mousewheel(self, canvas: tk.Canvas) -> None:
        def _on_mousewheel(event) -> None:
            delta = 0
            if hasattr(event, "delta") and event.delta:
                delta = int(-1 * (event.delta / 120))
            elif getattr(event, "num", None) == 4:
                delta = -1
            elif getattr(event, "num", None) == 5:
                delta = 1
            if delta != 0:
                canvas.yview_scroll(delta, "units")

        # Windows / macOS
        self.bind_all("<MouseWheel>", _on_mousewheel)
        # Linux fallback
        self.bind_all("<Button-4>", _on_mousewheel)
        self.bind_all("<Button-5>", _on_mousewheel)

    def _path_row(self, parent: ttk.Widget, label: str, var: tk.StringVar, browse_cmd, row: int) -> None:
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w")
        ttk.Entry(parent, textvariable=var, width=84).grid(row=row, column=1, sticky="we", padx=(8, 8))
        ttk.Button(parent, text="Browse", command=browse_cmd).grid(row=row, column=2, sticky="w")
        parent.columnconfigure(1, weight=1)

    def _prefill_paths(self) -> None:
        default_in = os.path.join(os.path.expanduser("~"), "Desktop", "BOQ format planning.csv")
        if os.path.exists(default_in):
            self.input_var.set(default_in)
            out = os.path.join(os.path.dirname(default_in), "BOQ_Import.csv")
            self.output_var.set(out)

    def _toggle_ollama_fields(self) -> None:
        use_llm = self.summary_mode_var.get() == "ollama"
        state = "normal" if use_llm else "disabled"
        self.model_combo.configure(state="readonly" if use_llm else "disabled")
        self.timeout_entry.configure(state=state)
        if self.model_var.get() == "custom" and use_llm:
            self.model_custom_entry.configure(state="normal")
        else:
            self.model_custom_entry.configure(state="disabled")
        # Keep instruction editable; it may be prepared before enabling ollama.

    def _apply_instruction_preset(self) -> None:
        preset = self.instruction_preset_var.get()
        text = INSTRUCTION_PRESETS.get(preset, "")
        self.instruction_text.delete("1.0", "end")
        self.instruction_text.insert("1.0", text)

    def _get_instruction(self) -> str:
        return self.instruction_text.get("1.0", "end").strip()

    def _effective_model(self) -> str:
        if self.model_var.get() == "custom":
            return (self.model_custom_var.get() or "").strip() or "qwen2.5:0.5b"
        return (self.model_var.get() or "").strip() or "qwen2.5:0.5b"

    def _set_model_options(self, models: list[str]) -> None:
        values = models[:] + ["custom"] if models else ["custom"]
        current = self.model_var.get().strip()
        self.model_combo["values"] = values
        if current and current in values:
            self.model_var.set(current)
        elif models:
            self.model_var.set(models[0])
        else:
            self.model_var.set("custom")
        self._toggle_ollama_fields()

    @staticmethod
    def _parse_ollama_models(list_output: str) -> list[str]:
        lines = [ln.strip() for ln in (list_output or "").splitlines() if ln.strip()]
        if not lines:
            return []
        start = 1 if lines and lines[0].lower().startswith("name") else 0
        models: list[str] = []
        for ln in lines[start:]:
            name = ln.split()[0].strip()
            if name and name not in models:
                models.append(name)
        return models

    def _load_instruction_profiles(self) -> None:
        try:
            if os.path.exists(self.instructions_store_path):
                with open(self.instructions_store_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.instruction_profiles = data if isinstance(data, list) else []
            else:
                self.instruction_profiles = []
        except Exception:
            self.instruction_profiles = []
        self._refresh_instruction_dropdown()

    def _save_instruction_profiles(self) -> None:
        with open(self.instructions_store_path, "w", encoding="utf-8") as f:
            json.dump(self.instruction_profiles, f, ensure_ascii=False, indent=2)

    def _refresh_instruction_dropdown(self) -> None:
        names = [f"{p.get('instruction_name','Unnamed')} | {p.get('model','')}" for p in self.instruction_profiles]
        self.saved_instruction_combo["values"] = names
        if names and not self.saved_instruction_var.get():
            self.saved_instruction_var.set(names[0])

    def _get_selected_profile_index(self) -> int:
        value = self.saved_instruction_var.get().strip()
        names = list(self.saved_instruction_combo["values"])
        return names.index(value) if value in names else -1

    def _load_selected_instruction(self) -> None:
        idx = self._get_selected_profile_index()
        if idx < 0:
            self._show_error("Load Failed", "Select a saved instruction first.")
            return
        p = self.instruction_profiles[idx]
        self.instruction_name_var.set(p.get("instruction_name", ""))
        model = p.get("model", "qwen2.5:0.5b")
        model_values = list(self.model_combo["values"])
        if model in model_values:
            self.model_var.set(model)
            self.model_custom_var.set("")
        else:
            self.model_var.set("custom")
            self.model_custom_var.set(model)
        self.instruction_text.delete("1.0", "end")
        self.instruction_text.insert("1.0", p.get("prompt_text", ""))
        self._toggle_ollama_fields()
        self._log("Loaded saved instruction profile")

    def _save_new_instruction(self) -> None:
        prompt = self._get_instruction()
        name = (self.instruction_name_var.get() or "").strip() or "Custom BOQ Summary"
        profile = {
            "id": str(uuid.uuid4()),
            "instruction_name": name,
            "model": self._effective_model(),
            "prompt_text": prompt,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        self.instruction_profiles.append(profile)
        self._save_instruction_profiles()
        self._refresh_instruction_dropdown()
        self._log(f"Saved instruction profile: {name}")

    def _update_instruction(self) -> None:
        idx = self._get_selected_profile_index()
        if idx < 0:
            self._show_error("Update Failed", "Select a saved instruction first.")
            return
        self.instruction_profiles[idx]["instruction_name"] = (self.instruction_name_var.get() or "").strip() or "Custom BOQ Summary"
        self.instruction_profiles[idx]["model"] = self._effective_model()
        self.instruction_profiles[idx]["prompt_text"] = self._get_instruction()
        self.instruction_profiles[idx]["created_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        self._save_instruction_profiles()
        self._refresh_instruction_dropdown()
        self._log("Updated instruction profile")

    def _delete_instruction(self) -> None:
        idx = self._get_selected_profile_index()
        if idx < 0:
            self._show_error("Delete Failed", "Select a saved instruction first.")
            return
        deleted = self.instruction_profiles.pop(idx)
        self._save_instruction_profiles()
        self.saved_instruction_var.set("")
        self._refresh_instruction_dropdown()
        self._log(f"Deleted instruction profile: {deleted.get('instruction_name', '')}")

    def _pick_input(self) -> None:
        path = filedialog.askopenfilename(
            title="Select Standard BOQ CSV",
            filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")],
        )
        if path:
            self.input_var.set(path)
            if not self.output_var.get():
                out = os.path.join(os.path.dirname(path), "BOQ_Import.csv")
                self.output_var.set(out)
            self._load_headers_from_input()

    def _pick_output(self) -> None:
        path = filedialog.asksaveasfilename(
            title="Select Output CSV",
            defaultextension=".csv",
            filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")],
        )
        if path:
            self.output_var.set(path)

    def _map_row(self, parent: ttk.Widget, label: str, var: tk.StringVar, row: int) -> ttk.Combobox:
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=(6, 0))
        combo = ttk.Combobox(parent, textvariable=var, state="readonly", width=56)
        combo.grid(row=row, column=1, sticky="w", padx=(8, 0), pady=(6, 0))
        return combo

    def _toggle_mapping_controls(self) -> None:
        state = "readonly" if self.manual_map_var.get() else "disabled"
        for c in self.map_controls:
            c.configure(state=state)

    def _load_headers_from_input(self) -> None:
        path = self.input_var.get().strip()
        if not path or not os.path.exists(path):
            self._show_error("Input Error", "Select a valid input CSV before loading headers.")
            return
        try:
            with open(path, newline="", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                header = next(reader, [])
            self.header_options = [f"{i}: {h}" for i, h in enumerate(header)]
            options = ["(None)"] + self.header_options
            for c in self.map_controls:
                c["values"] = options
            self._auto_prefill_mapping(header)
            self._log(f"Loaded headers: {len(header)} columns")
        except Exception as exc:  # pylint: disable=broad-except
            self._show_error("Header Load Failed", str(exc))

    def _auto_prefill_mapping(self, header: list[str]) -> None:
        norm = [h.strip().lower() for h in header]

        def pick(keys: list[str]) -> str:
            for i, h in enumerate(norm):
                if any(k in h for k in keys):
                    return f"{i}: {header[i]}"
            return "(None)"

        self.map_code_var.set(pick(["item no", "item", "serial", "sr no", "boq code"]))
        self.map_desc_var.set(pick(["description of works", "description"]))
        self.map_uom_var.set(pick(["uom", "unit"]))
        self.map_qty_var.set(pick(["qty", "quantity"]))
        self.map_rate_var.set(pick(["rate"]))
        self.map_amount_var.set(pick(["amount"]))
        self.map_remarks_var.set(pick(["remarks", "remark", "note"]))

    @staticmethod
    def _combo_to_index(value: str) -> int:
        value = (value or "").strip()
        if not value or value == "(None)":
            return -1
        try:
            return int(value.split(":", 1)[0].strip())
        except Exception:
            return -1

    def _get_manual_colmap(self) -> dict[str, object]:
        return {
            "code_cols": [self._combo_to_index(self.map_code_var.get())],
            "desc": self._combo_to_index(self.map_desc_var.get()),
            "uom": self._combo_to_index(self.map_uom_var.get()),
            "qty": self._combo_to_index(self.map_qty_var.get()),
            "rate": self._combo_to_index(self.map_rate_var.get()),
            "amount": self._combo_to_index(self.map_amount_var.get()),
            "remarks": self._combo_to_index(self.map_remarks_var.get()),
        }

    def _ui(self, fn, *args, **kwargs) -> None:
        self.after(0, lambda: fn(*args, **kwargs))

    def _set_status(self, text: str) -> None:
        self._ui(self.status_var.set, text)

    def _set_progress(self, value: float) -> None:
        self._ui(self.progress_var.set, max(0.0, min(100.0, value)))

    def _log(self, text: str) -> None:
        stamped = f"[{time.strftime('%H:%M:%S')}] {text}"
        def _append() -> None:
            self.log.insert("end", stamped + "\n")
            self.log.see("end")
        self._ui(_append)

    def _show_error(self, title: str, text: str) -> None:
        self._ui(messagebox.showerror, title, text)

    def _show_info(self, title: str, text: str) -> None:
        self._ui(messagebox.showinfo, title, text)

    def _set_indeterminate(self, on: bool) -> None:
        def _apply() -> None:
            if on:
                self.progress.configure(mode="indeterminate")
                self.progress.start(12)
            else:
                self.progress.stop()
                self.progress.configure(mode="determinate")
        self._ui(_apply)

    def _run_in_thread(self, fn) -> None:
        thread = threading.Thread(target=fn, daemon=True)
        thread.start()

    def _convert_async(self) -> None:
        self._run_in_thread(self._convert)

    def _convert(self) -> None:
        in_path = self.input_var.get().strip()
        out_path = self.output_var.get().strip()
        if not in_path or not os.path.exists(in_path):
            self._show_error("Input Error", "Please select a valid input CSV.")
            return
        if not out_path:
            self._show_error("Output Error", "Please select an output CSV path.")
            return

        summary_mode = self.summary_mode_var.get()
        model = self._effective_model()
        llm_instruction = self._get_instruction()
        try:
            timeout = int(self.timeout_var.get().strip() or "20")
        except ValueError:
            self._show_error("Input Error", "Timeout must be an integer.")
            return

        self._set_status("Converting...")
        self._set_progress(0)
        self._log("Starting conversion")
        self._log(f"Input: {in_path}")
        self._log(f"Output: {out_path}")
        self._log(f"Strict: {self.strict_var.get()}, Summary: {summary_mode}")
        if summary_mode == "ollama":
            self._log(f"Instruction: {llm_instruction[:140]}{'...' if len(llm_instruction) > 140 else ''}")

        try:
            self._set_progress(10)
            self._set_status("Stage 1/6: File Upload Complete (10%)")
            rows = converter.read_csv(in_path)

            self._set_progress(20)
            self._set_status("Stage 2/6: Excel -> CSV Parsing (20%)")
            colmap = None
            if self.manual_map_var.get():
                colmap = self._get_manual_colmap()
                # If manual mapping is enabled, treat first row as header and remove it.
                if rows:
                    rows = rows[1:]
                self._log(f"Manual mapping enabled: {colmap}")
            else:
                detected_map, has_header = converter.detect_column_map(rows)
                colmap = detected_map
                if has_header and rows:
                    rows = rows[1:]
                self._log(f"Auto mapping: {colmap}")

            qty_idx = int(colmap.get("qty", -1)) if colmap else -1
            measurement_count = 0
            for r in rows:
                q_raw = ((r[qty_idx] if 0 <= qty_idx < len(r) else "") or "")
                if converter.has_qty_value(q_raw):
                    measurement_count += 1
            self._set_progress(40)
            self._set_status("Stage 3/6: Serial & Quantity Detection Logic (40%)")
            self._log(f"Detected measurements: {measurement_count}")

            def on_structure_progress(done: int, total: int, phase: str) -> None:
                if total <= 0:
                    return
                pct = 40 + ((done / total) * 20.0)
                self._set_progress(pct)
                self._set_status(
                    f"Stage 4/6: Description Merging & Structuring (60%) - {done}/{total}"
                )

            out_rows, review_rows = converter.parse_standard_rows(
                rows,
                colmap=colmap,
                strict=self.strict_var.get(),
                summary_mode="none",
                llm_model=model,
                llm_timeout=timeout,
                llm_instruction=llm_instruction,
                progress_callback=on_structure_progress,
                apply_summary=False,
            )

            self._set_progress(60)
            self._set_status("Stage 4/6: Description Merging & Structuring (60%)")

            def on_llm_progress(done: int, total: int, phase: str) -> None:
                if total <= 0:
                    self._set_progress(80)
                    return
                pct = 60 + ((done / total) * 20.0)
                self._set_progress(pct)
                self._set_status(f"Stage 5/6: LLM Batch Processing (80%) - batch {done}/{total}")

            converter.apply_hierarchy_summaries(
                out_rows,
                summary_mode=summary_mode,
                llm_model=model,
                llm_timeout=timeout,
                llm_instruction=llm_instruction,
                progress_callback=on_llm_progress,
                log_callback=self._log,
                retry_once=True,
            )
            self._set_progress(80)
            self._set_status("Stage 5/6: LLM Batch Processing (80%)")

            converter.write_csv(out_path, out_rows)
            self._log(f"Wrote output rows: {len(out_rows)}")
            if self.strict_var.get():
                review_path = out_path[:-4] + "_review_required.csv" if out_path.lower().endswith(".csv") else out_path + "_review_required.csv"
                converter.write_review_csv(review_path, review_rows)
                self._log(f"Wrote review rows: {len(review_rows)} -> {review_path}")
            self._set_status("Stage 6/6: Final JSON Assembly & Save (100%)")
            self._set_progress(100)
            self._set_status("Completed")
            self._show_info("Success", "Conversion completed.")
        except Exception as exc:  # pylint: disable=broad-except
            self._set_status("Failed")
            self._log(f"Error: {exc}")
            self._show_error("Conversion Failed", str(exc))

    def _refresh_ollama_status(self) -> None:
        path = shutil.which("ollama")
        if not path:
            self.ollama_status.configure(text="Ollama: Not found on PATH")
            self.system_models = []
            self._set_model_options([])
            return
        try:
            proc = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True,
                errors="replace",
                timeout=10,
                check=False,
            )
            if proc.returncode == 0:
                lines = [line for line in (proc.stdout or "").splitlines() if line.strip()]
                count = max(0, len(lines) - 1) if lines else 0
                self.system_models = self._parse_ollama_models(proc.stdout or "")
                self._set_model_options(self.system_models)
                self._ui(self.ollama_status.configure, text=f"Ollama: Installed ({count} local models)")
            else:
                self.system_models = []
                self._set_model_options([])
                self._ui(self.ollama_status.configure, text="Ollama: Installed but not responding cleanly")
        except Exception:
            self.system_models = []
            self._set_model_options([])
            self._ui(self.ollama_status.configure, text="Ollama: Installed but status check failed")

    def _install_ollama_async(self) -> None:
        self._run_in_thread(self._install_ollama)

    def _install_ollama(self) -> None:
        self._log("Installing Ollama with winget...")
        self._set_status("Installing Ollama...")
        self._set_indeterminate(True)
        try:
            rc = self._run_command_stream(
                [
                    "winget",
                    "install",
                    "-e",
                    "--id",
                    "Ollama.Ollama",
                    "--accept-package-agreements",
                    "--accept-source-agreements",
                ],
                timeout=1800,
            )
            if rc == 0:
                self._log("Ollama install completed.")
                self._set_status("Ollama installed")
            else:
                self._set_status(f"Ollama install failed (exit {rc})")
                self._log("winget install failed. Common causes: no admin policy, source blocked, corporate restrictions.")
                self._log("Fallback: use 'Open Ollama Download Page' and install manually.")
                self._show_error("Install Failed", f"winget could not install Ollama (exit {rc}). Check log.")
        except FileNotFoundError:
            self._set_status("winget not found")
            self._show_error("Install Failed", "winget is not available on this system.")
        except Exception as exc:  # pylint: disable=broad-except
            self._set_status("Ollama install failed")
            self._show_error("Install Failed", str(exc))
        finally:
            self._set_indeterminate(False)
            self._refresh_ollama_status()

    def _pull_model_async(self) -> None:
        self._run_in_thread(self._pull_model)

    def _pull_model(self) -> None:
        model = (self.download_model_var.get() or "").strip() or self._effective_model()
        if not shutil.which("ollama"):
            self._show_error("Ollama Missing", "Install Ollama first.")
            return
        self._set_status("Downloading model...")
        self._set_indeterminate(True)
        self._log(f"Pulling model: {model}")
        try:
            rc = self._run_command_stream(["ollama", "pull", model], timeout=1800)
            if rc == 0:
                self._log(f"Model ready: {model}")
                self._set_status("Model ready")
                self._show_info("Model Ready", f"Downloaded: {model}")
            else:
                self._set_status(f"Model download failed (exit {rc})")
                self._show_error("Model Download Failed", f"Could not pull model (exit {rc}). Check log.")
        except Exception as exc:  # pylint: disable=broad-except
            self._set_status("Model download failed")
            self._show_error("Model Download Failed", str(exc))
        finally:
            self._set_indeterminate(False)
            self._refresh_ollama_status()

    def _list_models_async(self) -> None:
        self._run_in_thread(self._list_models)

    def _list_models(self) -> None:
        if not shutil.which("ollama"):
            self._show_error("Ollama Missing", "Install Ollama first.")
            return
        try:
            proc = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True,
                errors="replace",
                timeout=20,
                check=False,
            )
            self._log("Local models:")
            self._log((proc.stdout or "").strip() or "(none)")
        except Exception as exc:  # pylint: disable=broad-except
            self._log(f"Model list error: {exc}")

    def _run_command_stream(self, cmd: list[str], timeout: int = 1800) -> int:
        self._log("Command: " + " ".join(cmd))
        start = time.time()
        with subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        ) as proc:
            assert proc.stdout is not None
            while True:
                line = proc.stdout.readline()
                if line:
                    self._log(line.rstrip())
                if proc.poll() is not None:
                    break
                if time.time() - start > timeout:
                    proc.kill()
                    self._log(f"Command timed out after {timeout}s")
                    return 124
            # Read any remaining buffered output
            tail = proc.stdout.read()
            if tail:
                for ln in tail.splitlines():
                    self._log(ln)
            return int(proc.returncode or 0)

    def _open_ollama_download(self) -> None:
        try:
            os.startfile("https://ollama.com/download")  # type: ignore[attr-defined]
        except Exception as exc:  # pylint: disable=broad-except
            self._show_error("Open Link Failed", str(exc))

    def _open_output_folder(self) -> None:
        out = self.output_var.get().strip()
        target = os.path.dirname(out) if out else os.getcwd()
        if not target:
            target = os.getcwd()
        try:
            os.startfile(target)  # type: ignore[attr-defined]
        except Exception as exc:  # pylint: disable=broad-except
            messagebox.showerror("Open Folder Failed", str(exc))


def main() -> None:
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
