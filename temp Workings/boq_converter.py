#!/usr/bin/env python3
"""Smart BOQ converter.

Converts a "standard" BOQ CSV into the import template format
(ID, BOQ Code, Parent BOQ Code, Row Type, Description, Detailed Description,
 UOM, Quantity, Rate, Amount, EPS Path, Element Name, Length, Breadth, Depth, Calculated Qty).

Usage:
  python "temp Workings/boq_converter.py" --input "path\\to\\standard.csv" --output "path\\to\\BOQ_Import.csv"

Assumptions (tweakable in code):
- Rows with UOM/Qty/Rate/Amount are MEASUREMENT rows.
- Section rows (no qty) become MAIN_ITEM or SUB_ITEM based on code pattern.
- Note rows (no code, only description) are appended to the next emitted row's Detailed Description.
"""

import argparse
import csv
import json
import re
import subprocess
import urllib.error
import urllib.request
from typing import Callable, List, Dict, Tuple, Optional

HEADER_OUT = [
    "ID",
    "BOQ Code",
    "Parent BOQ Code",
    "Row Type",
    "Description",
    "Detailed Description",
    "UOM",
    "Quantity",
    "Rate",
    "Amount",
    "EPS Path",
    "Element Name",
    "Length",
    "Breadth",
    "Depth",
    "Calculated Qty",
    "WBS Structure",
    "LLM Text",
    "Short Description",
    "WBS_Type",
    "Parent_ID",
    "LLM_Text",
    "Short_Description",
]

ROMAN_RE = re.compile(r"^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$", re.IGNORECASE)
DEFAULT_LLM_INSTRUCTION = (
    "Summarize for BOQ import. Keep construction scope clear, avoid generic words, "
    "preserve material/work method intent, no numbering changes, no invented hierarchy."
)


def _norm_header(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def detect_column_map(rows: List[List[str]]) -> Tuple[Dict[str, object], bool]:
    # Defaults for legacy wide format
    colmap: Dict[str, object] = {
        "code_cols": [0, 1, 2, 3],
        "desc": 4,
        "uom": 5,
        "qty": 6,
        "rate": 7,
        "amount": 8,
        "remarks": 9,
    }
    if not rows:
        return colmap, False

    header = rows[0]
    norm = [_norm_header(h) for h in header]

    def find_first(keys: List[str]) -> Optional[int]:
        for i, h in enumerate(norm):
            for k in keys:
                if k in h:
                    return i
        return None

    code_idx = find_first(["item no", "item", "serial", "sr no", "boq code"])
    desc_idx = find_first(["description of works", "description"])
    qty_idx = find_first(["qty", "quantity"])
    uom_idx = find_first(["uom", "unit"])
    rate_idx = find_first(["rate"])
    amount_idx = find_first(["amount"])
    remarks_idx = find_first(["remarks", "remark", "note"])

    has_header = any(h for h in norm) and (code_idx is not None and desc_idx is not None)
    if has_header:
        # Compact format: single code column
        colmap["code_cols"] = [code_idx]
        colmap["desc"] = desc_idx
        colmap["uom"] = uom_idx if uom_idx is not None else -1
        colmap["qty"] = qty_idx if qty_idx is not None else -1
        colmap["rate"] = rate_idx if rate_idx is not None else -1
        colmap["amount"] = amount_idx if amount_idx is not None else -1
        colmap["remarks"] = remarks_idx if remarks_idx is not None else -1
    return colmap, has_header


def normalize_num(s: str) -> str:
    if s is None:
        return ""
    s = s.strip().replace(",", "")
    return s


def is_numeric_text(s: str) -> bool:
    return bool(re.match(r"^-?\d+(\.\d+)?$", s.strip()))


def detect_code_type(code: str) -> str:
    if not code:
        return "none"
    if ROMAN_RE.match(code.strip()):
        return "roman"
    if re.match(r"^[A-Za-z]+$", code.strip()):
        return "alpha"
    if re.match(r"^\d+(\.\d+)+$", code.strip()):
        return "numeric_dotted"
    if re.match(r"^\d+$", code.strip()):
        return "numeric_int"
    return "other"


def classify_row_type(code: str, has_qty: bool) -> str:
    c = (code or "").strip()
    if re.match(r"^[A-Z]$", c):
        return "MAIN_ITEM"
    if re.match(r"^\d+$", c):
        return "MAIN_ITEM"
    if re.match(r"^\d+\.\d+$", c):
        return "SUB_ITEM"
    if re.match(r"^[a-z]$", c) and not has_qty:
        return "SUB_ITEM"
    if has_qty:
        return "MEASUREMENT"
    return "NONE"


def has_qty_value(s: str) -> bool:
    raw = (s or "").strip()
    if not raw:
        return False
    # Common placeholders in BOQ sheets
    if raw in {"-", "--"}:
        return False
    return True


def clean_text_for_llm(text: str) -> str:
    if not text:
        return ""
    t = text
    t = t.encode("utf-8", "ignore").decode("utf-8", "ignore")
    t = re.sub(r"\{[^\}]*\"ItemNumber\"[^\}]*\}", " ", t, flags=re.IGNORECASE)
    t = re.sub(r"\{\"ItemNumber\"[^\n]*", " ", t, flags=re.IGNORECASE)
    t = re.sub(r"`{3,}.*?`{3,}", " ", t, flags=re.DOTALL)
    t = t.replace("|", " ")
    drop_phrases = [
        "providing and laying",
        "including",
        "complete",
        "as per specification",
        "as directed",
        "labour",
        "materials",
        "etc",
        "here’s the summary",
        "here's the summary",
        "output:",
        "label:",
        "code:",
    ]
    for p in drop_phrases:
        t = re.sub(re.escape(p), " ", t, flags=re.IGNORECASE)
    t = re.sub(r"[^\x20-\x7E\n]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def clean_llm_output(text: str) -> str:
    if not text:
        return ""
    lines = [(ln or "").strip() for ln in (text or "").splitlines()]
    r = ""
    for ln in lines:
        if ln:
            r = ln
            break
    if not r:
        r = (text or "").strip()
    r = r.replace(":", " ")
    r = re.sub(r"\b(Item|SubItem)\b\s*", " ", r, flags=re.IGNORECASE)
    r = re.sub(r"^[\-\*\d\.\)\(]+\s*", "", r)
    r = re.sub(r"[{}\\[\\]\"]", " ", r)
    r = re.sub(r"\s+", " ", r).strip()
    words = r.split()
    if len(words) > 12:
        r = " ".join(words[:12])
    return r


def is_bad_llm_output(text: str) -> bool:
    t = (text or "").strip().lower()
    if not t:
        return True
    # Hard reject only obvious meta/noise responses
    hard_bad = ["here is", "output:", "label:", "code:"]
    if any(x in t for x in hard_bad):
        return True
    if "{" in t or "}" in t:
        return True
    # Require at least 2 alphabetic words for a usable title
    words = re.findall(r"[a-zA-Z]+", t)
    return len(words) < 2


def level_for_code(code: str, prev_level: int, col_level_hint: Optional[int] = None) -> int:
    ctype = detect_code_type(code)
    if ctype == "numeric_int":
        return 1
    if ctype == "numeric_dotted":
        return code.count(".") + 1
    if ctype in ("alpha", "roman", "other"):
        if col_level_hint is not None:
            return max(2, col_level_hint)
        return max(prev_level + 1, 2)
    return prev_level


def is_upperish(s: str) -> bool:
    letters = [ch for ch in s if ch.isalpha()]
    if not letters:
        return False
    upper = sum(1 for ch in letters if ch.isupper())
    return upper / len(letters) >= 0.6


def row_type(code: str, desc: str, has_qty: bool, level: int) -> str:
    if has_qty:
        return "MEASUREMENT"
    ctype = detect_code_type(code)
    # Business rule: full numbers are items, decimal numbers are sub items
    if ctype == "numeric_int":
        return "MAIN_ITEM"
    if ctype == "numeric_dotted":
        return "SUB_ITEM"
    # Default for alpha/roman/other structural codes
    return "SUB_ITEM"


def extract_code_and_level_hint(r: List[str]) -> Tuple[str, Optional[int]]:
    code_cells = [(i, (r[i] or "").strip()) for i in range(4)]
    non_empty = [(i, val) for i, val in code_cells if val]
    if not non_empty:
        return "", None
    idx, code = non_empty[-1]  # deepest visible code cell
    return code, idx + 1


def extract_code_from_columns(r: List[str], code_cols: List[int]) -> str:
    non_empty: List[Tuple[int, str]] = []
    for idx in code_cols:
        if 0 <= idx < len(r):
            v = (r[idx] or "").strip()
            if v:
                non_empty.append((idx, v))
    if not non_empty:
        return ""
    return non_empty[-1][1]


def safe_get(r: List[str], idx: int) -> str:
    if idx < 0 or idx >= len(r):
        return ""
    return (r[idx] or "").strip()


def confidence_and_reason(
    rtype: str,
    code: str,
    has_qty: bool,
    parent_code: str,
) -> Tuple[str, str]:
    ctype = detect_code_type(code)
    if rtype == "MEASUREMENT":
        if has_qty and parent_code:
            return "high", ""
        if has_qty:
            return "medium", "Measurement has qty but parent is not resolved"
        return "low", "Row tagged measurement without valid qty"
    if rtype == "MAIN_ITEM":
        if ctype == "numeric_int":
            return "high", ""
        return "medium", "MAIN_ITEM not identified by full-number code"
    if rtype == "SUB_ITEM":
        if ctype == "numeric_dotted":
            return "high", ""
        if ctype in ("alpha", "roman") and parent_code:
            return "medium", "Alphabetic/Roman sub-item linked by hierarchy context"
        return "low", "SUB_ITEM inferred with weak code pattern"
    return "low", "Unknown row type"


def heuristic_summary(text: str, max_words: int = 16) -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    clean = re.sub(r"^(note|general notes?)\s*[:\-]?\s*", "", clean, flags=re.IGNORECASE)
    first = re.split(r"[.;:]", clean)[0].strip() if clean else ""
    words = first.split()
    if not words:
        return ""
    return " ".join(words[:max_words])


def ollama_summary(
    text: str,
    model: str,
    timeout_s: int,
    label: str = "",
    code: str = "",
    instruction: str = "",
) -> Tuple[str, int, str]:
    label_line = f"Label: {label}\nCode: {code}\n" if (label or code) else ""
    instruction_line = instruction.strip() if instruction.strip() else DEFAULT_LLM_INSTRUCTION
    prompt = (
        "Summarize this BOQ node into one short line (8-16 words), no bullet, no prefix.\n"
        "Do not invent hierarchy. Respect the provided label and code.\n"
        f"Instruction: {instruction_line}\n"
        f"{label_line}"
        f"{text}"
    )
    approx_tokens = int(max(1, len(prompt.split()) * 1.33)) if prompt else 0
    # Preferred: local Ollama HTTP API with strict generation controls.
    req_body = {
        "model": model,
        "prompt": prompt + "\nReturn only one line. Do not write anything else.",
        "stream": False,
        "options": {
            "temperature": 0,
            "top_p": 0.1,
            "num_predict": 20,
            "stop": ["\n"],
        },
    }
    try:
        data = json.dumps(req_body).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/generate",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.loads(resp.read().decode("utf-8", "replace"))
        out = re.sub(r"\s+", " ", (payload.get("response", "") or "").strip())
        if not out:
            return "", int(approx_tokens), "empty response"
        tokens = int(payload.get("eval_count", 0) or 0) + int(payload.get("prompt_eval_count", 0) or 0)
        return " ".join(out.split()[:16]), max(tokens, int(approx_tokens)), ""
    except Exception:
        # Fallback: CLI
        try:
            proc = subprocess.run(
                ["ollama", "run", model, prompt],
                capture_output=True,
                text=True,
                errors="replace",
                timeout=timeout_s,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return "", int(approx_tokens), "ollama unavailable or timed out"
        if proc.returncode != 0:
            return "", int(approx_tokens), (proc.stderr or proc.stdout or "ollama call failed").strip()
        out = re.sub(r"\s+", " ", (proc.stdout or "").strip())
        if not out:
            return "", int(approx_tokens), "empty response"
        return " ".join(out.split()[:16]), int(approx_tokens), ""


def summary_text(
    desc: str,
    detailed: str,
    summary_mode: str,
    llm_model: str,
    llm_timeout: int,
    label: str,
    code: str,
    llm_instruction: str,
) -> str:
    if summary_mode == "none":
        return desc
    source_text = detailed if detailed else desc
    if not source_text:
        return desc
    if summary_mode == "ollama":
        short, _, _ = ollama_summary(
            source_text,
            llm_model,
            llm_timeout,
            label=label,
            code=code,
            instruction=llm_instruction,
        )
        if short:
            return short
    short = heuristic_summary(source_text)
    return short if short else desc


def apply_hierarchy_summaries(
    rows: List[Dict[str, str]],
    summary_mode: str,
    llm_model: str,
    llm_timeout: int,
    llm_instruction: str,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
    log_callback: Optional[Callable[[str], None]] = None,
    retry_once: bool = True,
) -> None:
    if summary_mode == "none":
        return

    by_code: Dict[str, Dict[str, str]] = {}
    children: Dict[str, List[Dict[str, str]]] = {}
    for row in rows:
        code = (row.get("BOQ Code") or "").strip()
        if code:
            by_code[code] = row
        parent = (row.get("Parent BOQ Code") or "").strip()
        if parent:
            children.setdefault(parent, []).append(row)

    def row_text(r: Dict[str, str]) -> str:
        desc = (r.get("Description") or "").strip()
        detailed = (r.get("Detailed Description") or "").strip()
        if desc and detailed:
            return f"{desc}\n{detailed}"
        return detailed or desc

    def join_parts(parts: List[str]) -> str:
        return "\n".join([p for p in parts if p])

    def llm_or_heuristic(
        payload: Dict[str, object],
        label: str,
        code: str,
        fallback_desc: str,
        batch_i: int,
        batch_n: int,
    ) -> str:
        payload_json = json.dumps(payload, ensure_ascii=False)
        llm_text_input = clean_text_for_llm(str(payload.get("LLMText", "") or ""))
        if not llm_text_input:
            llm_text_input = clean_text_for_llm(str(payload.get("ContextText", "") or payload_json))
        if summary_mode != "ollama":
            heuristic_context = str(payload.get("ContextText", "") or llm_text_input or payload_json)
            out = summary_text(
                fallback_desc,
                heuristic_context,
                summary_mode,
                llm_model,
                llm_timeout,
                label=label,
                code=code,
                llm_instruction=llm_instruction,
            )
            return clean_llm_output(out)

        attempts = 2 if retry_once else 1
        last_err = ""
        for attempt in range(1, attempts + 1):
            short, tokens, err = ollama_summary(
                llm_text_input,
                llm_model,
                llm_timeout,
                label=label,
                code=code,
                instruction=llm_instruction,
            )
            if log_callback:
                log_callback(
                    f"LLM batch {batch_i}/{batch_n} item={code} attempt={attempt} token_est={tokens}"
                )
            if short:
                short = clean_llm_output(short)
                if short and not is_bad_llm_output(short):
                    return short
                err = "invalid response format"
            last_err = err or "unknown error"
            if log_callback:
                sample = clean_llm_output(short)[:60] if short else ""
                log_callback(f"LLM error batch {batch_i}/{batch_n} item={code}: {last_err} sample='{sample}'")
        # Continue pipeline using heuristic fallback
        out = summary_text(
            fallback_desc,
            llm_text_input or payload_json,
            "heuristic",
            llm_model,
            llm_timeout,
            label=label,
            code=code,
            llm_instruction=llm_instruction,
        )
        return clean_llm_output(out)

    # Prepare sub-item blocks first (parent + child measurements)
    sub_rows = [r for r in rows if r.get("Row Type") == "SUB_ITEM"]
    main_rows = [r for r in rows if r.get("Row Type") == "MAIN_ITEM"]
    total_batches = len(sub_rows) + len(main_rows)
    done_batches = 0

    # Summarize sub-items first (parent + child measurements)
    for row in sub_rows:
        sub_code = (row.get("BOQ Code") or "").strip()
        parent_code = (row.get("Parent BOQ Code") or "").strip()
        parts_plain: List[str] = []
        parts_labeled: List[str] = []
        measurements_payload: List[Dict[str, str]] = []
        if parent_code and parent_code in by_code:
            ptxt = row_text(by_code[parent_code])
            parts_plain.append(ptxt)
            parts_labeled.extend(["Parent Context:", ptxt])
        stxt = row_text(row)
        parts_plain.append(stxt)
        parts_labeled.extend(["Sub Item Context:", stxt])
        for ch in children.get(sub_code, []):
            if ch.get("Row Type") == "MEASUREMENT":
                ctxt = row_text(ch)
                parts_plain.append(ctxt)
                parts_labeled.extend(["Child Measurement:", ctxt])
                measurements_payload.append(
                    {
                        "MeasurementDescription": (ch.get("Description") or "").strip(),
                        "Measurement": (ch.get("Quantity") or "").strip(),
                        "Unit": (ch.get("UOM") or "").strip(),
                    }
                )
        llm_text = (
            "TYPE: SUBITEM\n\n"
            f"PARENT ITEM DESCRIPTION:\n{clean_text_for_llm((by_code.get(parent_code, {}).get('Detailed Description', '') if parent_code else ''))}\n\n"
            f"SUBITEM DESCRIPTION:\n{clean_text_for_llm((row.get('Detailed Description') or '').strip())}\n\n"
            f"MEASUREMENTS:\n{clean_text_for_llm(', '.join([m.get('MeasurementDescription','') for m in measurements_payload if m.get('MeasurementDescription')]))}\n\n"
            "Generate short specific work title.\n"
            "Include material / thickness / grade / location if present.\n"
            "Max 10 words.\n"
            "No explanation.\n"
            "Return only the title."
        )
        payload = {
            "ItemNumber": parent_code,
            "SubItemNumber": sub_code,
            "DetailedDescription": (row.get("Detailed Description") or "").strip(),
            "ParentDescription": (by_code.get(parent_code, {}).get("Description", "") if parent_code else ""),
            "Measurements": measurements_payload,
            "ContextText": clean_text_for_llm(join_parts(parts_labeled if summary_mode == "ollama" else parts_plain)),
            "LLMText": llm_text,
        }
        done_batches += 1
        if progress_callback:
            progress_callback(done_batches, total_batches, "llm_batch")
        short = llm_or_heuristic(
            payload=payload,
            label="SUB_ITEM",
            code=sub_code,
            fallback_desc=row.get("Description", ""),
            batch_i=done_batches,
            batch_n=total_batches,
        )
        row["LLM Text"] = llm_text
        row["LLM_Text"] = llm_text
        row["Short Description"] = short
        row["Short_Description"] = short
        row["WBS_Type"] = "SUBITEM"
        row["Parent_ID"] = parent_code
        if short:
            row["Description"] = short

    # Summarize main-items next (all descendant sub-items + all measurements)
    for row in main_rows:
        main_code = (row.get("BOQ Code") or "").strip()
        me = row_text(row)
        parts_plain: List[str] = [me]
        parts_labeled: List[str] = ["Main Item Context:", me]
        sub_payloads: List[Dict[str, object]] = []
        direct_measurements_payload: List[Dict[str, str]] = []
        for ch in children.get(main_code, []):
            if ch.get("Row Type") == "SUB_ITEM":
                stxt = row_text(ch)
                parts_plain.append(stxt)
                parts_labeled.extend(["Child Sub Item:", stxt])
                sub_code = (ch.get("BOQ Code") or "").strip()
                sub_measures: List[Dict[str, str]] = []
                for mch in children.get(sub_code, []):
                    if mch.get("Row Type") == "MEASUREMENT":
                        mtxt = row_text(mch)
                        parts_plain.append(mtxt)
                        parts_labeled.extend(["Grandchild Measurement:", mtxt])
                        sub_measures.append(
                            {
                                "MeasurementDescription": (mch.get("Description") or "").strip(),
                                "Measurement": (mch.get("Quantity") or "").strip(),
                                "Unit": (mch.get("UOM") or "").strip(),
                            }
                        )
                sub_payloads.append(
                    {
                        "SubItemNumber": sub_code,
                        "SubItemDescription": (ch.get("Description") or "").strip(),
                        "DetailedDescription": (ch.get("Detailed Description") or "").strip(),
                        "Measurements": sub_measures,
                    }
                )
            elif ch.get("Row Type") == "MEASUREMENT":
                mtxt = row_text(ch)
                parts_plain.append(mtxt)
                parts_labeled.extend(["Child Measurement:", mtxt])
                direct_measurements_payload.append(
                    {
                        "MeasurementDescription": (ch.get("Description") or "").strip(),
                        "Measurement": (ch.get("Quantity") or "").strip(),
                        "Unit": (ch.get("UOM") or "").strip(),
                    }
                )
        all_measure_text: List[str] = []
        for s in sub_payloads:
            for m in s.get("Measurements", []):
                md = (m or {}).get("MeasurementDescription", "")
                if md:
                    all_measure_text.append(md)
        for dm in direct_measurements_payload:
            md = dm.get("MeasurementDescription", "")
            if md:
                all_measure_text.append(md)
        llm_text = (
            "TYPE: ITEM\n\n"
            f"ITEM DESCRIPTION:\n{clean_text_for_llm((row.get('Detailed Description') or '').strip())}\n\n"
            f"SUBITEMS:\n{clean_text_for_llm(' | '.join([str(s.get('DetailedDescription','')) for s in sub_payloads if s.get('DetailedDescription')]))}\n"
            f"MEASUREMENTS: {clean_text_for_llm(', '.join(all_measure_text))}\n\n"
            "Generate short work category title.\n"
            "Max 6 words.\n"
            "No explanation.\n"
            "Return only the title."
        )
        payload = {
            "ItemNumber": main_code,
            "DetailedDescription": (row.get("Detailed Description") or "").strip(),
            "SubItems": sub_payloads,
            "DirectMeasurements": direct_measurements_payload,
            "ContextText": clean_text_for_llm(join_parts(parts_labeled if summary_mode == "ollama" else parts_plain)),
            "LLMText": llm_text,
        }
        done_batches += 1
        if progress_callback:
            progress_callback(done_batches, total_batches, "llm_batch")
        short = llm_or_heuristic(
            payload=payload,
            label="MAIN_ITEM",
            code=main_code,
            fallback_desc=row.get("Description", ""),
            batch_i=done_batches,
            batch_n=total_batches,
        )
        row["LLM Text"] = llm_text
        row["LLM_Text"] = llm_text
        row["Short Description"] = short
        row["Short_Description"] = short
        row["WBS_Type"] = "ITEM"
        row["Parent_ID"] = ""
        if short:
            row["Description"] = short


def parse_standard_rows(
    rows: List[List[str]],
    colmap: Optional[Dict[str, object]] = None,
    strict: bool = False,
    summary_mode: str = "none",
    llm_model: str = "qwen2.5:0.5b",
    llm_timeout: int = 20,
    llm_instruction: str = "",
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
    summary_progress_callback: Optional[Callable[[int, int, str], None]] = None,
    summary_log_callback: Optional[Callable[[str], None]] = None,
    apply_summary: bool = True,
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    # Workflow:
    # 1) Qty rows are measurements.
    # 2) For each measurement, use rows since previous measurement as context.
    # 3) Resolve/emit MAIN_ITEM and SUB_ITEM first, then emit measurement.
    if colmap is None:
        colmap = {
            "code_cols": [0, 1, 2, 3],
            "desc": 4,
            "uom": 5,
            "qty": 6,
            "rate": 7,
            "amount": 8,
            "remarks": 9,
        }
    code_cols = list(colmap.get("code_cols", [0]))  # type: ignore[arg-type]
    desc_idx = int(colmap.get("desc", 4))
    uom_idx = int(colmap.get("uom", 5))
    qty_idx = int(colmap.get("qty", 6))
    rate_idx = int(colmap.get("rate", 7))
    amount_idx = int(colmap.get("amount", 8))
    remarks_idx = int(colmap.get("remarks", 9))

    out: List[Dict[str, str]] = []
    review_rows: List[Dict[str, str]] = []
    total_rows = len(rows)
    processed_rows = 0

    next_id = 1
    current_main_code = ""
    current_sub_code = ""
    main_rows_by_code: Dict[str, Dict[str, str]] = {}
    sub_rows_by_code: Dict[str, Dict[str, str]] = {}

    def add_row(
        code: str,
        parent_code: str,
        rtype: str,
        desc: str,
        detailed: str,
        uom: str = "",
        qty: str = "",
        rate: str = "",
        amount: str = "",
        confidence: str = "high",
        reason: str = "",
    ) -> None:
        nonlocal next_id
        out.append(
            {
                "ID": str(next_id),
                "BOQ Code": code,
                "Parent BOQ Code": parent_code,
                "Row Type": rtype,
                "Description": desc,
                "Detailed Description": detailed,
                "UOM": uom,
                "Quantity": qty,
                "Rate": rate,
                "Amount": amount,
                "EPS Path": "",
                "Element Name": "",
                "Length": "",
                "Breadth": "",
                "Depth": "",
                "Calculated Qty": "",
                "WBS Structure": "",
                "LLM Text": "",
                "Short Description": "",
                "WBS_Type": "",
                "Parent_ID": "",
                "LLM_Text": "",
                "Short_Description": "",
            }
        )
        if strict and confidence != "high":
            review_rows.append(
                {
                    "ID": str(next_id),
                    "BOQ Code": code,
                    "Parent BOQ Code": parent_code,
                    "Row Type": rtype,
                    "Confidence": confidence,
                    "Reason": reason,
                    "Description": desc,
                }
            )
        next_id += 1

    def append_detailed(target: Optional[Dict[str, str]], text: str) -> None:
        if target is None or not text:
            return
        prev = (target.get("Detailed Description") or "").strip()
        target["Detailed Description"] = f"{prev}\n{text}".strip() if prev else text

    for r in rows:
        if not r:
            continue
        row = r
        code = extract_code_from_columns(row, code_cols)
        desc = safe_get(row, desc_idx)
        uom = safe_get(row, uom_idx)
        qty_raw = safe_get(row, qty_idx)
        qty = normalize_num(qty_raw)
        rate = normalize_num(safe_get(row, rate_idx))
        amount = normalize_num(safe_get(row, amount_idx))
        remarks = safe_get(row, remarks_idx)
        has_qty = has_qty_value(qty_raw)

        # Ignore pure empties
        if not code and not desc and not remarks and not has_qty:
            continue
        rtype = classify_row_type(code, has_qty)
        code_type = detect_code_type(code)

        if rtype == "MAIN_ITEM":
            current_main_code = code
            current_sub_code = ""
            if code not in main_rows_by_code:
                add_row(
                    code=code,
                    parent_code="",
                    rtype="MAIN_ITEM",
                    desc=desc or f"Item {code}",
                    detailed=remarks,
                )
                main_rows_by_code[code] = out[-1]
                out[-1]["WBS Structure"] = code
            else:
                if desc and not main_rows_by_code[code].get("Description"):
                    main_rows_by_code[code]["Description"] = desc
                append_detailed(main_rows_by_code[code], remarks)

        elif rtype == "SUB_ITEM":
            # Ensure parent main exists
            if code_type == "numeric_dotted":
                inferred_main = code.split(".")[0]
            else:
                inferred_main = current_main_code
            parent_main = inferred_main or current_main_code
            if not parent_main:
                parent_main = "UNMAPPED"
                if parent_main not in main_rows_by_code:
                    add_row(parent_main, "", "MAIN_ITEM", "Unmapped Item", "")
                    main_rows_by_code[parent_main] = out[-1]
                    out[-1]["WBS Structure"] = parent_main
            if parent_main not in main_rows_by_code:
                add_row(parent_main, "", "MAIN_ITEM", f"Item {parent_main}", "")
                main_rows_by_code[parent_main] = out[-1]
                out[-1]["WBS Structure"] = parent_main
            current_main_code = parent_main
            current_sub_code = code
            if code not in sub_rows_by_code:
                add_row(
                    code=code,
                    parent_code=current_main_code,
                    rtype="SUB_ITEM",
                    desc=desc or f"Sub Item {code}",
                    detailed=remarks,
                )
                sub_rows_by_code[code] = out[-1]
                out[-1]["WBS Structure"] = f"{current_main_code}>{code}"
            else:
                if desc and not sub_rows_by_code[code].get("Description"):
                    sub_rows_by_code[code]["Description"] = desc
                append_detailed(sub_rows_by_code[code], remarks)

        elif rtype == "MEASUREMENT":
            parent_code = current_sub_code or current_main_code
            if not parent_code:
                # Create fallback container
                parent_code = "UNMAPPED"
                if parent_code not in main_rows_by_code:
                    add_row(parent_code, "", "MAIN_ITEM", "Unmapped Item", "")
                    main_rows_by_code[parent_code] = out[-1]
                    out[-1]["WBS Structure"] = parent_code
            add_row(
                code=code,
                parent_code=parent_code,
                rtype="MEASUREMENT",
                desc=desc,
                detailed=remarks,
                uom=uom,
                qty=qty,
                rate=rate,
                amount=amount,
            )
            out[-1]["WBS Structure"] = f"{parent_code}>{code}" if code else parent_code

        else:
            # Description lines: attach to active sub-item, else active main-item.
            target: Optional[Dict[str, str]] = None
            if current_sub_code and current_sub_code in sub_rows_by_code:
                target = sub_rows_by_code[current_sub_code]
            elif current_main_code and current_main_code in main_rows_by_code:
                target = main_rows_by_code[current_main_code]
            append_detailed(target, desc)
            append_detailed(target, remarks)

        processed_rows += 1
        if progress_callback:
            progress_callback(processed_rows, total_rows if total_rows > 0 else 1, "structure")

    if apply_summary:
        apply_hierarchy_summaries(
            out,
            summary_mode=summary_mode,
            llm_model=llm_model,
            llm_timeout=llm_timeout,
            llm_instruction=llm_instruction,
            progress_callback=summary_progress_callback,
            log_callback=summary_log_callback,
            retry_once=True,
        )

    return out, review_rows


def read_csv(path: str) -> List[List[str]]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        return list(reader)


def write_csv(path: str, rows: List[Dict[str, str]]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADER_OUT, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_review_csv(path: str, rows: List[Dict[str, str]]) -> None:
    header = ["ID", "BOQ Code", "Parent BOQ Code", "Row Type", "Confidence", "Reason", "Description"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Path to standard BOQ CSV")
    ap.add_argument("--output", required=True, help="Path to output import CSV")
    ap.add_argument("--strict", action="store_true", help="Write uncertain tags to review CSV")
    ap.add_argument("--review-output", default="", help="Path to review CSV (used with --strict)")
    ap.add_argument(
        "--summary-mode",
        choices=["none", "heuristic", "ollama"],
        default="none",
        help="Summary mode for ITEM/SUB_ITEM descriptions",
    )
    ap.add_argument("--llm-model", default="qwen2.5:0.5b", help="Local ollama model name")
    ap.add_argument("--llm-timeout", type=int, default=20, help="Timeout seconds for LLM summary call")
    ap.add_argument(
        "--llm-instruction",
        default="",
        help="Custom instruction for LLM summarization (used in --summary-mode ollama)",
    )
    ap.add_argument(
        "--llm-instruction-file",
        default="",
        help="Path to a text file containing LLM summarization instruction",
    )
    args = ap.parse_args()

    all_rows = read_csv(args.input)
    if not all_rows:
        raise SystemExit("Input CSV is empty")

    colmap, has_header = detect_column_map(all_rows)
    rows = all_rows[1:] if has_header else all_rows

    instruction = args.llm_instruction
    if args.llm_instruction_file:
        with open(args.llm_instruction_file, "r", encoding="utf-8") as f:
            instruction = f.read().strip()

    out_rows, review_rows = parse_standard_rows(
        rows,
        colmap=colmap,
        strict=args.strict,
        summary_mode=args.summary_mode,
        llm_model=args.llm_model,
        llm_timeout=args.llm_timeout,
        llm_instruction=instruction,
    )
    write_csv(args.output, out_rows)
    if args.strict:
        review_output = args.review_output
        if not review_output:
            if args.output.lower().endswith(".csv"):
                review_output = args.output[:-4] + "_review_required.csv"
            else:
                review_output = args.output + "_review_required.csv"
        write_review_csv(review_output, review_rows)


if __name__ == "__main__":
    main()
