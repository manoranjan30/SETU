# Checklist Mass Import & Header Fields — Implementation Plan
**Module:** Quality → Checklist Templates
**Status:** Not Started
**Platform:** NestJS Backend + React Frontend
**Reference Checklist:** CL.QA.08C — Beam & Slab Concreting (Puravankara Limited)

---

## 1. WHAT THIS PLAN COVERS

The physical Puravankara checklist format has these parts that the current system either misses or hardcodes:

```
┌─────────────────────────────────────────────────────┐
│ HEADER FIELDS (per checklist template)               │
│   Checklist No: CL-QA-08C   Rev No: 01              │
│   Date: ___   Dwg No: ___                            │
│   Project: ___   Location: ___   Contractor: ___     │
│   Title: CHECKLIST FOR BEAM AND SLAB                 │
│   Activity: CONCRETING                               │
├─────────────────────────────────────────────────────┤
│ SECTIONS (stages)                                    │
│   ► PRE-EXECUTION CHECKS (items 1–13)               │
│   ► CHECKS DURING EXECUTION (items 14–23)           │
│   ► POST-EXECUTION CHECKS (items 24–30)             │
├─────────────────────────────────────────────────────┤
│ ITEM COLUMNS: Sl No | Description | YES | NA | REM  │
├─────────────────────────────────────────────────────┤
│ SIGNATURE BLOCK (per checklist)                      │
│   Contractor: Site In Charge + QC Engineer           │
│   PL/PHL: Site In Charge + QA & PE                  │
│   Name / Signature / Date rows                       │
└─────────────────────────────────────────────────────┘
```

**Current system gaps:**
| Field | Current State | Target State |
|---|---|---|
| `checklistNo` | Derived from list ID (e.g., CL-QA-001) | Stored as-is from physical document (CL-QA-08C) |
| `revNo` | Hardcoded `'02'` in PDF service | Stored in template, shown in header + PDF |
| `dwgNo` | Hardcoded `'GFC-DWG-001'` | Stored per inspection instance |
| `activityTitle` | Template `name` field (free text) | Dedicated `activityTitle` field (e.g., "CHECKLIST FOR BEAM AND SLAB") |
| `activityType` | Not stored | New field (e.g., "CONCRETING", "SHUTTERING") |
| Stage signature roles | Not configurable | JSON array per stage defining who signs |
| Mass import from Excel | Not implemented | New Excel import endpoint + UI |
| Import from PDF | Not implemented | Smart PDF parser with confidence scoring + clarification step |

---

## 2. PART A — HEADER FIELDS IMPLEMENTATION

### 2.1 Backend: Update `QualityChecklistTemplate` Entity

**File:** `backend/src/quality/entities/quality-checklist-template.entity.ts`

Add these columns to the entity:

```typescript
// Add after `version` field:

@Column({ name: 'checklist_no', length: 50, nullable: true })
checklistNo: string; // e.g. 'CL-QA-08C'

@Column({ name: 'rev_no', length: 20, nullable: true, default: '01' })
revNo: string; // e.g. '01', '02'

@Column({ name: 'activity_title', length: 255, nullable: true })
activityTitle: string; // e.g. 'CHECKLIST FOR BEAM AND SLAB'

@Column({ name: 'activity_type', length: 100, nullable: true })
activityType: string; // e.g. 'CONCRETING', 'SHUTTERING', 'WATERPROOFING'

@Column({ name: 'discipline', length: 100, nullable: true })
discipline: string; // e.g. 'Civil', 'MEP', 'Finishing'

@Column({ name: 'applicable_trade', length: 100, nullable: true })
applicableTrade: string; // e.g. 'RCC', 'Masonry', 'Plumbing'

@Column({ name: 'is_global', default: false })
isGlobal: boolean; // true = available to all projects (company-level library)
```

**Database Migration SQL:**
```sql
ALTER TABLE quality_checklist_template
  ADD COLUMN checklist_no VARCHAR(50),
  ADD COLUMN rev_no VARCHAR(20) DEFAULT '01',
  ADD COLUMN activity_title VARCHAR(255),
  ADD COLUMN activity_type VARCHAR(100),
  ADD COLUMN discipline VARCHAR(100),
  ADD COLUMN applicable_trade VARCHAR(100),
  ADD COLUMN is_global BOOLEAN DEFAULT FALSE;

-- Index for quick lookup by checklist code
CREATE UNIQUE INDEX idx_checklist_no_project
  ON quality_checklist_template(project_id, checklist_no)
  WHERE checklist_no IS NOT NULL;

-- Index for global library queries
CREATE INDEX idx_checklist_global ON quality_checklist_template(is_global);
```

---

### 2.2 Backend: Update `QualityInspection` Entity (Instance-Level Fields)

Fields like `dwgNo`, `location`, `contractorName` are per-inspection (not per-template — they vary with each RFI raised).

**File:** `backend/src/quality/entities/quality-inspection.entity.ts`

Add these columns:
```typescript
// Add after existing `partLabel` field:

@Column({ name: 'drawing_no', length: 100, nullable: true })
drawingNo: string; // e.g. 'GFC-DWG-001' — filled at RFI creation

@Column({ name: 'contractor_name', length: 255, nullable: true })
contractorName: string; // Contractor firm name for this specific RFI
```

**Database Migration SQL:**
```sql
ALTER TABLE quality_inspection
  ADD COLUMN drawing_no VARCHAR(100),
  ADD COLUMN contractor_name VARCHAR(255);
```

---

### 2.3 Backend: Update `QualityStageTemplate` Entity (Signature Roles)

The current stage has `isHoldPoint` and `isWitnessPoint` but no definition of WHO signs. Add a JSON config:

**File:** `backend/src/quality/entities/quality-stage-template.entity.ts`

```typescript
// Signature slot definition stored per stage template
@Column({ name: 'signature_slots', type: 'jsonb', nullable: true })
signatureSlots: SignatureSlotConfig[] | null;
```

**TypeScript interface (add to a shared types file):**
```typescript
export interface SignatureSlotConfig {
  slotId: string;         // unique id, e.g. 'contractor_site_in_charge'
  label: string;          // Display label, e.g. 'Site In Charge'
  party: 'Contractor' | 'PL/PHL' | 'Consultant' | 'Client';
  role: string;           // System role name, e.g. 'SITE_ENGINEER', 'QA_PE'
  required: boolean;      // Is this signature mandatory to complete stage?
  sequence: number;       // Display order in signature block
}
```

**Example value for "Beam & Slab" checklist:**
```json
[
  { "slotId": "contractor_site_in_charge", "label": "Site In Charge", "party": "Contractor", "role": "SITE_ENGINEER", "required": true, "sequence": 1 },
  { "slotId": "contractor_qc_engineer",    "label": "QC Engineer",    "party": "Contractor", "role": "QC_ENGINEER",   "required": true, "sequence": 2 },
  { "slotId": "phl_site_in_charge",        "label": "Site In Charge", "party": "PL/PHL",     "role": "SITE_IN_CHARGE","required": true, "sequence": 3 },
  { "slotId": "phl_qa_pe",                 "label": "QA & PE",        "party": "PL/PHL",     "role": "QA_PE",         "required": true, "sequence": 4 }
]
```

**Migration SQL:**
```sql
ALTER TABLE quality_stage_template
  ADD COLUMN signature_slots JSONB;
```

---

### 2.4 Backend: Update DTOs

**File:** `backend/src/quality/dto/create-checklist-template.dto.ts`

Add to `CreateChecklistTemplateDto`:
```typescript
@IsOptional() @IsString() @MaxLength(50)
checklistNo?: string;

@IsOptional() @IsString() @MaxLength(20)
revNo?: string;

@IsOptional() @IsString() @MaxLength(255)
activityTitle?: string;

@IsOptional() @IsString() @MaxLength(100)
activityType?: string;

@IsOptional() @IsString() @MaxLength(100)
discipline?: string;

@IsOptional() @IsString() @MaxLength(100)
applicableTrade?: string;

@IsOptional() @IsBoolean()
isGlobal?: boolean;
```

Add to `CreateStageTemplateDto`:
```typescript
@IsOptional() @IsArray()
signatureSlots?: SignatureSlotConfig[];
```

**File:** `backend/src/quality/dto/create-inspection.dto.ts`

Add to `CreateInspectionDto`:
```typescript
@IsOptional() @IsString() @MaxLength(100)
drawingNo?: string;

@IsOptional() @IsString() @MaxLength(255)
contractorName?: string;
```

---

### 2.5 Backend: Fix Hardcoded Report Fields

**File:** `backend/src/quality/quality-report.service.ts`

Replace hardcoded values:
```typescript
// BEFORE (lines ~139, ~166):
revNo: '02',
dwgNo: 'GFC-DWG-001',

// AFTER — read from entity:
revNo: template.revNo ?? '01',
checklistNo: template.checklistNo ?? `CL-QA-${String(inspection.listId).padStart(3, '0')}`,
activityTitle: template.activityTitle ?? template.name,
activityType: template.activityType ?? '',
drawingNo: inspection.drawingNo ?? '',
contractorName: inspection.contractorName ?? inspection.vendorName ?? '',
```

---

### 2.6 Frontend: Checklist Template Form — Add Header Fields

**File:** `frontend/src/views/quality/subviews/QualityChecklist.tsx`
(or wherever the template create/edit form is)

Add a "Header Details" section at the top of the template form:

```
┌─────────────────────────────────────────────────────┐
│ CHECKLIST HEADER                                     │
│  Checklist No  [CL-QA-08C_______]  Rev No  [01___]  │
│  Activity Title [CHECKLIST FOR BEAM AND SLAB______]  │
│  Activity Type  [CONCRETING_______________________]  │
│  Discipline     [Civil ▼]  Trade  [RCC ▼]           │
│  ☐ Global Library (available to all projects)       │
└─────────────────────────────────────────────────────┘
```

**Discipline dropdown values:** Civil, MEP, Finishing, Structural, External Works
**Activity Type suggestions:** CONCRETING, SHUTTERING, REINFORCEMENT, WATERPROOFING, TILING, PLASTERING, PAINTING, PLUMBING, ELECTRICAL, HVAC, FACADE

---

## 3. PART B — EXCEL SMART IMPORT STRATEGY

The Excel parser is **format-agnostic**. It handles two kinds of input without the user needing to reformat anything:

| Mode | Description | Confidence |
|---|---|---|
| **Template format** | SETU-generated template (clean data grid, known column names) | Always 100% — no clarification |
| **Freeform / Puravankara format** | Actual Puravankara checklist Excel (merged cells, styled header block, colored section rows) | Scored per field — clarification step shown when < 80% |

The same confidence scoring and clarification step used for PDF applies to freeform Excel. Users can upload their existing checklist Excel files **as-is** — no reformatting required.

---

### 3.1 Format Detection

On receiving the Excel file, the parser runs a quick format probe on each sheet before deciding which parsing strategy to apply:

```typescript
function detectSheetFormat(sheet: WorkSheet): 'template' | 'freeform' {
  // Template format: Row 1 col A = 'checklistNo' (exact label)
  const cellA1 = getCellValue(sheet, 'A1')?.toString().toLowerCase();
  if (cellA1 === 'checklistno') return 'template';

  // Template format: Row 2 has known column headers (SlNo, Section, Description)
  const row2Values = getRowValues(sheet, 2).map(v => v?.toString().toLowerCase());
  const templateHeaders = ['slno', 'section', 'description'];
  if (templateHeaders.every(h => row2Values.includes(h))) return 'template';

  // Otherwise: freeform (treat as Puravankara-style formatted sheet)
  return 'freeform';
}
```

---

### 3.2 Template Format — Strict Parser (High-confidence path)

Used when `detectSheetFormat()` returns `'template'`. This is the SETU-generated template that was downloaded from the system. All fields are in known positions.

#### Sheet Structure
Each checklist = **one sheet** in the Excel file.
- Sheet name = Checklist code (e.g., `CL-QA-08C`)

#### Row Layout

**Row 1 — Metadata (fixed key-value)**
```
| checklistNo | revNo | activityTitle               | activityType | discipline | applicableTrade |
| CL-QA-08C   | 01    | CHECKLIST FOR BEAM AND SLAB | CONCRETING   | Civil      | RCC             |
```

**Row 2 — Column Headers**
```
| SlNo | Section | Description | Type | Mandatory | PhotoRequired | HoldPoint | WitnessPoint | SignatureSlots |
```

**Rows 3+ — Data Rows** (Section column drives stage grouping)

All values are 100% confidence. No clarification step needed.

---

### 3.3 Freeform Format — Smart Parser (Scored path)

Used when `detectSheetFormat()` returns `'freeform'`. The file looks like the physical Puravankara checklist — styled headers, merged cells, colored section rows, YES/NA column indicators.

#### 3.3.1 Header Block Extraction

Puravankara Excel headers typically occupy rows 1–5, often with merged cells and label-value pairs in adjacent columns:

```
Row 1: [PURAVANKARA LIMITED logo / company name] (merged A1:H1)
Row 2: [CHECKLIST FOR BEAM AND SLAB]             (merged A2:H2)
Row 3: Checklist No: CL-QA-08C    Rev No: 01    Date: ___
Row 4: Project: ___  Location: ___  Contractor: ___
Row 5: Dwg No: ___   Activity: CONCRETING
```

The parser scans the first 10 rows and reads **label:value pairs** using these keyword rules:

| Keyword variants to look for | Extracts | Confidence |
|---|---|---|
| `Checklist No`, `CL No`, `CL.No`, `Checklist#` | `checklistNo` | 95% if regex `[A-Z]{2}\.[A-Z]{2}\.\d+` matches |
| `Rev No`, `Revision`, `Rev.` | `revNo` | 90% if found adjacent to checklist no |
| `Activity` (standalone label) | `activityType` | 80% if value is short (< 30 chars) |
| Title row: all-caps merged row with `CHECKLIST FOR` or `CHECKLIST -` | `activityTitle` | 90% |
| `Discipline`, `Disc.` | `discipline` | 80% if value matches known list |
| `Trade`, `Applicable Trade` | `applicableTrade` | 75% |
| Company name row = `PURAVANKARA` | `isKnownFormat = true` | boosts all scores +10% |

Approach: scan each cell value, look for label text, read the immediately adjacent cell (right or below) as the value.

```typescript
function extractHeaderFromRows(rows: CellRow[]): HeaderFields {
  const labelPatterns: [RegExp, keyof HeaderFields][] = [
    [/checklist\s*(no|number|#)/i, 'checklistNo'],
    [/rev(ision)?\s*(no|\.)?/i,   'revNo'],
    [/activity\s*type/i,          'activityType'],
    [/activity$/i,                'activityType'],  // fallback
    [/discipline/i,               'discipline'],
    [/applicable\s*trade|trade/i, 'applicableTrade'],
  ];

  // Also look for the title row (large merged cell, all-caps)
  // and Dwg No as a separate pass
}
```

#### 3.3.2 Section Heading Row Detection

In Puravankara Excel files, section headings are:
- A single cell spanning the full table width (merged across all columns)
- Typically in bold and/or with a background fill colour
- Contains all-caps text (no preceding number)

Detection logic using `exceljs` cell metadata:

```typescript
function isSectionHeadingRow(row: Row): boolean {
  const firstCell = row.getCell(1);

  // Merged cell spanning most of the row
  const isMerged = firstCell.isMerged;

  // All-caps text, ≥ 5 characters
  const text = firstCell.value?.toString().trim() ?? '';
  const isAllCaps = /^[A-Z\s\-\/&]{5,}$/.test(text);

  // Bold font (common in Puravankara format)
  const isBold = firstCell.font?.bold === true;

  // Background fill (section headers usually have a coloured background)
  const hasFill = firstCell.fill?.type === 'pattern' &&
                  firstCell.fill.fgColor?.argb !== 'FFFFFFFF';

  return (isMerged || isBold || hasFill) && isAllCaps;
}
```

Confidence for detected section headings:
- Merged + bold + all-caps → 100%
- Bold + all-caps (no merge) → 90%
- All-caps only → 70% (shown in clarification if name is not in known list)

#### 3.3.3 Item Row Detection

Item rows in Puravankara Excel format have:
- Column A or B: a sequence number (integer)
- Column B or C: the item description (long text, often wrapped)
- Columns towards the right: YES / NA / REM checkboxes or headers

```typescript
function isItemRow(row: Row): boolean {
  const values = getRowValues(row);
  // First non-empty cell is a positive integer
  const firstVal = values.find(v => v !== null && v !== '');
  return typeof firstVal === 'number' && Number.isInteger(firstVal) && firstVal > 0;
}
```

Column mapping (auto-detected by reading the header row above the first item):
- Look for cells containing `YES`, `NA`, `REM`, `YES/NO`, `REMARKS` to identify response columns
- The widest text column left of YES column = Description column

#### 3.3.4 YES/NA vs YES/NO Detection

```typescript
function detectItemType(headerRow: Row): 'YES_OR_NA' | 'YES_NO' {
  const headers = getRowValues(headerRow).map(v => v?.toString().toUpperCase());
  if (headers.includes('NA') || headers.includes('N/A')) return 'YES_OR_NA';
  if (headers.includes('NO')) return 'YES_NO';
  return 'YES_OR_NA'; // default
}
```

#### 3.3.5 Signature Block Detection

Signature blocks are at the bottom of the sheet, identified by:
- Rows containing `Name`, `Signature`, `Date` labels stacked vertically
- Column headers containing role names: `Site In Charge`, `QC Engineer`, `QA & PE`, `Contractor`, `PL/PHL`

```typescript
function extractSignatureSlots(sheet: WorkSheet, startRow: number): SignatureSlotConfig[] {
  // Read from startRow to end of sheet
  // Map role labels to known slot IDs using signatoryMap (same as PDF parser)
}
```

---

### 3.4 Confidence Scoring for Excel

Same scoring thresholds as PDF (Section 9.5). Additional Excel-specific rules:

| Condition | Score adjustment |
|---|---|
| `isKnownFormat = true` (Puravankara letterhead detected) | All fields +10% |
| Template format (strict path) | All fields = 100% |
| Merged cell detected for section heading | +15% vs plain all-caps |
| Item sequence is gapless (1,2,3…n) | `itemCount` = 100% |
| Item sequence has gaps (1,2,4,5…) | `itemCount` = 75%, flag missing numbers |
| Header label found but adjacent cell empty | Field confidence = 30% |
| Sheet name matches `checklistNo` extracted from header | `checklistNo` boosted to 100% |

---

### 3.5 Clarification Step for Excel

Identical to PDF clarification step (Section 9.6). Triggered when **any field < 80% confidence**.

The UI is the same modal — users see extracted values with confidence badges and can correct anything before proceeding. The only difference from PDF: freeform Excel tends to have higher base confidence because cell metadata (bold, merge, fill color) provides stronger structural signals than raw text.

When all sheets in the file are in template format, the clarification step is skipped entirely.

---

### 3.6 Multi-Sheet Clarification

For an Excel file with 20 sheets, clarification is shown **per sheet** that needs it, not all at once. The UI shows a progress indicator:

```
┌──────────────────────────────────────────────────────────────┐
│  Reviewing sheet 3 of 20: CL-QA-10B                         │
│  ────────────────────────────────────────────────────────    │
│  Activity Type   [________________]  ❓ Not detected         │
│  Discipline      [Civil___________]  ⚠ 60% — verify         │
│                                                              │
│  [Skip this sheet]   [Apply to all remaining sheets →]      │
└──────────────────────────────────────────────────────────────┘
```

**"Apply to all remaining"** — if the same Discipline/ActivityType value is confirmed for one sheet, offer to pre-fill the same value for remaining unconfirmed sheets of the same type.

---

### 3.7 Backend: Import Endpoint

**File to create:** `backend/src/quality/checklist-import.service.ts`

**Endpoint:** `POST /quality/checklist-templates/project/:projectId/import`
(Accepts both Excel and the JSON body from PDF/Excel clarification flow)

```typescript
@Post('project/:projectId/import')
@UseInterceptors(FileInterceptor('file'))
@UseGuards(PermissionsGuard)
@RequirePermissions('QUALITY.CHECKLIST.CREATE')
async importChecklists(
  @Param('projectId') projectId: number,
  @UploadedFile() file?: Express.Multer.File,   // Excel upload path
  @Body() body?: ConfirmedImportPayload,         // JSON body path (after clarification)
  @Query('preview') preview?: string,
  @Query('overwrite') overwrite?: string,
): Promise<ImportChecklistResult>
```

**Return type:**
```typescript
interface ImportChecklistResult {
  parsed: number;
  created: number;
  skipped: number;
  overwritten: number;
  errors: ImportError[];
  templates?: ParsedChecklistPreview[];  // if preview=true
}

interface ParsedChecklistPreview {
  sheetName: string;
  parseMode: 'template' | 'freeform';   // which parser was used
  checklistNo: string;
  revNo: string;
  activityTitle: string;
  activityType: string;
  discipline: string;
  applicableTrade: string;
  stageCount: number;
  itemCount: number;
  overallConfidence: number;            // min across all fields
  requiresClarification: boolean;
  fields: FieldWithConfidence;          // per-field scores
  errors: string[];
  itemWarnings: ItemWarning[];          // merged rows, gaps, etc.
  stages: {
    name: string;
    confidence: number;
    itemCount: number;
    isHoldPoint: boolean;
  }[];
}

interface FieldWithConfidence {
  checklistNo:    { value: string; confidence: number };
  revNo:          { value: string; confidence: number };
  activityTitle:  { value: string; confidence: number };
  activityType:   { value: string; confidence: number };
  discipline:     { value: string; confidence: number };
  applicableTrade:{ value: string; confidence: number };
}

interface ConfirmedImportPayload {
  templates: ParsedChecklistPreview[];  // user-corrected previews, ready to save
}
```

**Service Logic (`ChecklistImportService`):**

```
parseExcelFile(buffer)
  ├─ Read all sheet names (skip INSTRUCTIONS, DROPDOWN_VALUES, EXAMPLE_* sheets)
  ├─ For each sheet:
  │   ├─ detectSheetFormat() → 'template' or 'freeform'
  │   ├─ [template] → strict parser (Row 1 metadata, Row 2 headers, Rows 3+ items)
  │   ├─ [freeform] → smart parser:
  │   │   ├─ Scan rows 1–10 → extractHeaderFromRows() → confidence-scored header fields
  │   │   ├─ Find table header row (YES/NA columns)
  │   │   ├─ Scan remaining rows:
  │   │   │   ├─ isSectionHeadingRow() → new stage
  │   │   │   └─ isItemRow() → append to current stage
  │   │   └─ extractSignatureSlots() → bottom of sheet
  │   ├─ scoreConfidence() → flag requiresClarification
  │   └─ Return ParsedChecklistPreview
  └─ Return array of previews

saveChecklists(projectId, confirmedPreviews, overwrite)
  ├─ Begin transaction
  ├─ For each preview:
  │   ├─ Check existing by (projectId + checklistNo)
  │   │   ├─ If exists and !overwrite → skip
  │   │   └─ If exists and overwrite → delete old, create new
  │   └─ Create QualityChecklistTemplate with stages and items
  └─ Commit transaction, return ImportChecklistResult
```

---

### 3.8 Frontend: Import UI (Updated Flow)

**File to create:** `frontend/src/components/quality/ChecklistImportModal.tsx`

#### Step 1 — Upload

```
┌──────────────────────────────────────────────────────┐
│  Import Checklists                                   │
│  ──────────────────────────────────────────────      │
│  📥 Drop your file here                              │
│     Excel (.xlsx) or PDF                             │
│     or [Browse File]                                 │
│                                                      │
│  Smart import — works with existing Puravankara      │
│  Excel files and PDFs. No reformatting needed.       │
│                                                      │
│  [Download SETU Template] (for a clean starting      │
│   point that skips the clarification step)           │
└──────────────────────────────────────────────────────┘
```

#### Step 1.5 — Clarification (shown when any sheet/PDF has field < 80%)

For Excel with multiple sheets, shown per sheet that needs it (with skip/apply-to-all options).
For PDF, shown once per file.
(See Section 9.6 for full UI design — same component, reused for both.)

#### Step 2 — Preview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Preview — 12 checklists found                                       │
│  ──────────────────────────────────────────────────────────────────  │
│  ✅ CL-QA-08C  Beam & Slab Concreting   [freeform] 3 sections  30 items │
│  ✅ CL-QA-09A  Column Shuttering        [template] 2 sections  18 items │
│  ⚠  CL-QA-11C  Plastering              [freeform] ← Already exists      │
│  ❌ CL-QA-12D  [Parse error: no items found — sheet may be empty]        │
│                                                                      │
│  Options:  ☑ Overwrite existing checklists                          │
│  [← Back]                    [Import 11 valid checklists →]         │
└──────────────────────────────────────────────────────────────────────┘
```

The `[freeform]` / `[template]` badge shows which parser was used — transparency for the user.

#### Step 3 — Result (unchanged from original plan)

---

### 3.9 Frontend: Template Download Endpoint

**New Endpoint:** `GET /quality/checklist-templates/import-template`

Returns a pre-filled SETU-format Excel with:
- Sheet `INSTRUCTIONS` — explains both format options (template vs. freeform)
- Sheet `DROPDOWN_VALUES` — valid values for Type, Discipline, ActivityType, etc.
- Sheet `EXAMPLE_CL-QA-08C` — pre-filled in SETU template format

**Implementation:** Use `exceljs` to generate programmatically.

---

## 4. PART C — UPDATED CHECKLIST LIBRARY UI

### 4.1 Checklist Library Page Changes

**File:** wherever checklist templates are listed in frontend

Add the following to the checklist list view:

1. **Import button** → opens `ChecklistImportModal`
2. **Checklist No column** in the table
3. **Rev No badge** next to checklist name
4. **Activity Type tag** (colored chip — CONCRETING=blue, FINISHING=green, etc.)
5. **Filter by Activity Type dropdown**
6. **Global Library toggle** — shows company-wide templates (isGlobal=true)

**List row format:**
```
[CL-QA-08C]  CHECKLIST FOR BEAM AND SLAB  [CONCRETING]  Rev 01  3 stages · 30 items  [Edit] [Clone] [Delete]
```

### 4.2 RFI Raise Form — Add Drawing No + Contractor

**File:** wherever the RFI creation UI is

When raising an RFI, show additional fields:
```
Drawing No  [________________]   (optional, pre-fills from last used)
Contractor  [________________]   (optional, pre-fills from vendor selection)
```

These are saved to `quality_inspection.drawing_no` and `quality_inspection.contractor_name`.

---

## 5. FILE CHANGE SUMMARY

### Backend

| File | Action | Change |
|------|--------|--------|
| `entities/quality-checklist-template.entity.ts` | **MODIFY** | Add 7 new columns |
| `entities/quality-inspection.entity.ts` | **MODIFY** | Add `drawingNo`, `contractorName` |
| `entities/quality-stage-template.entity.ts` | **MODIFY** | Add `signatureSlots` jsonb |
| `dto/create-checklist-template.dto.ts` | **MODIFY** | Add new field validations |
| `dto/create-inspection.dto.ts` | **MODIFY** | Add `drawingNo`, `contractorName` |
| `quality-report.service.ts` | **MODIFY** | Replace hardcoded revNo, dwgNo with entity values |
| `checklist-template.service.ts` | **MODIFY** | Handle new fields in create/update |
| `checklist-template.controller.ts` | **MODIFY** | Add `/import` + `/import-template` endpoints |
| `checklist-import.service.ts` | **CREATE** | Smart Excel parser (template + freeform) + bulk save |
| `checklist-pdf-parser.service.ts` | **CREATE** | PDF parser (digital + OCR), confidence scoring |
| `migrations/checklist-header-fields.sql` | **CREATE** | DB migration SQL |
| `package.json` | **MODIFY** | Add `pdf-parse`, `tesseract.js`, `pdf2pic` |

### Frontend

| File | Action | Change |
|------|--------|--------|
| `views/quality/subviews/QualityChecklist.tsx` | **MODIFY** | Add header fields to template create/edit form |
| `components/quality/ChecklistImportModal.tsx` | **CREATE** | Upload → Clarification → Preview → Result wizard |
| `components/quality/ClarificationStep.tsx` | **CREATE** | Shared clarification UI (used by both Excel + PDF paths) |
| `types/checklist-import.ts` | **CREATE** | `ParsedChecklistPreview`, `FieldWithConfidence`, `ItemWarning`, `PdfParseResult` types |
| Checklist list page | **MODIFY** | Add Import button, checklistNo column, activity type filter |
| RFI raise form | **MODIFY** | Add drawingNo + contractorName fields |

---

## 6. IMPLEMENTATION ORDER

Execute in this order to avoid blockers:

```
Week 1: Backend Foundation
  ├─ DB migration (all ALTER TABLE statements)
  ├─ Entity updates (template + inspection + stage)
  ├─ DTO updates
  └─ Fix hardcoded report fields

Week 2: Smart Excel Import Service
  ├─ checklist-import.service.ts — strict (template) parser
  ├─ Add freeform parser (detectSheetFormat, extractHeaderFromRows, isSectionHeadingRow, isItemRow)
  ├─ Confidence scoring + ItemWarning detection
  ├─ Template Excel generator (download template endpoint)
  └─ Import endpoint (POST /import)

Week 3: Frontend — Import UI
  ├─ Checklist template form — header fields
  ├─ Shared ClarificationStep component (Excel + PDF)
  ├─ ChecklistImportModal (Upload → Clarification → Preview → Result)
  ├─ Multi-sheet per-sheet clarification with Apply-to-all
  ├─ Checklist list page updates (columns + filter + Import button)
  └─ RFI raise form updates (drawingNo + contractorName)

Week 4: PDF Import
  ├─ Add pdf-parse, tesseract.js, pdf2pic to backend
  ├─ Build ChecklistPdfParserService (digital path first, then OCR)
  ├─ Add POST /import-pdf endpoint
  └─ Frontend: file-type detection + PDF clarification step (Step 1.5)

Week 5: Testing & PDF Report
  ├─ Test Excel import with real file (12+ checklists)
  ├─ Test PDF import with Puravankara digital checklist PDFs
  ├─ Test PDF import with scanned checklist (OCR path)
  ├─ Verify PDF report shows correct header fields
  └─ End-to-end test: import → assign to activity → raise RFI → PDF
```

---

## 7. ACCEPTANCE CRITERIA

### Header Fields
- [ ] `checklistNo` stored as-is (e.g., `CL-QA-08C`), not derived from ID
- [ ] `revNo` shown in checklist list, template form, and generated PDF report
- [ ] `drawingNo` captured per RFI and shown in PDF header
- [ ] `activityTitle` displayed in checklist card and PDF header
- [ ] `activityType` shows as colored chip in UI; filterable in list
- [ ] Duplicate detection by `checklistNo + projectId` (overwrite confirmation shown)
- [ ] Signature slots configurable per stage (stored as JSON)
- [ ] Existing checklists created via UI still work unchanged (all new fields nullable/defaulted)
- [ ] PDF report no longer shows hardcoded `Rev 02` or `GFC-DWG-001`

### Excel Smart Import
- [ ] Uploading an existing Puravankara-format Excel (styled, merged cells) extracts all header fields without manual reformatting
- [ ] `detectSheetFormat()` correctly identifies SETU template format sheets and skips clarification for them
- [ ] Section heading rows (merged, bold, all-caps) are detected as stage boundaries
- [ ] Item rows are identified by leading sequence number, regardless of column position
- [ ] YES / NA vs YES / NO column presence is detected and sets the correct item type
- [ ] Signature block at bottom of sheet is extracted and mapped to known role slots
- [ ] Any field < 80% confidence triggers the clarification step for that sheet
- [ ] Multi-sheet clarification shows per-sheet with "Apply to all remaining" shortcut
- [ ] Template-format sheets (100% confidence) skip clarification and go straight to preview
- [ ] Can upload a single Excel file with 20+ sheets and all import successfully
- [ ] Parse errors and item warnings surface per-sheet in preview (not silent fails)
- [ ] Download template Excel works and has the EXAMPLE sheet pre-filled with CL-QA-08C data

### PDF Smart Import
- [ ] Digital Puravankara-format PDF auto-extracts checklistNo, revNo, activityTitle with ≥ 80% confidence
- [ ] Scanned PDF runs OCR and extracts checklist structure (lower confidence → clarification step)
- [ ] Any field < 80% shown in clarification with confidence badge and editable field
- [ ] Section headings outside known patterns flagged for user correction
- [ ] Merged items surfaced with split/accept options
- [ ] After clarification, confirmed data flows through same Preview + Save pipeline as Excel
- [ ] PDF parse errors (password-protected, corrupt, non-checklist) show clear error message
- [ ] Non-Puravankara format shows warning but still allows manual header field entry

---

## 8. EXCEL TEMPLATE — CL-QA-08C PRE-FILL DATA

The downloadable template should include this sheet pre-filled as an example:

**Sheet name:** `CL-QA-08C`

**Row 1 (metadata):**
```
CL-QA-08C | 01 | CHECKLIST FOR BEAM AND SLAB | CONCRETING | Civil | RCC
```

**Rows 3–35 (items):**
```
SlNo | Section                    | Description                                                                    | Type      | Mandatory | PhotoReq | HoldPoint | WitnessPoint
1    | PRE-EXECUTION CHECKS       | Checked and ensured the availability of GFC drawing with Name, date and no.?  | YES_OR_NA | Yes       | No       | No        | No
2    | PRE-EXECUTION CHECKS       | Ensured QA & PE approved work method statement is available with the team       | YES_OR_NA | Yes       | No       | No        | No
3    | PRE-EXECUTION CHECKS       | Ensured materials used in concrete are tested as per ITP and approved by QA & PE | YES_OR_NA | Yes       | No       | No        | No
4    | PRE-EXECUTION CHECKS       | Checked and ensured all the shuttering and reinforcement works are completed and approved | YES_OR_NA | Yes | No | No | No
5    | PRE-EXECUTION CHECKS       | Checked and ensured MEP services are completed and approved.                   | YES_OR_NA | Yes       | No       | Yes       | No
6    | PRE-EXECUTION CHECKS       | Checked and ensured necessary barricading and safety measures are taken.       | YES_OR_NA | Yes       | No       | No        | No
7    | PRE-EXECUTION CHECKS       | Checked and ensured required tools are available at the site.                  | YES_OR_NA | Yes       | No       | No        | No
8    | PRE-EXECUTION CHECKS       | Ensured sufficient manpower is available for concreting on site.               | YES_OR_NA | Yes       | No       | No        | No
9    | PRE-EXECUTION CHECKS       | Ensured suitable vibrators, fuel and vibrator needles employed for different members | YES_OR_NA | Yes | No | No | No
10   | PRE-EXECUTION CHECKS       | Ensured vibrators are in working condition and standby vibrators are available at site. | YES_OR_NA | Yes | No | No | No
11   | PRE-EXECUTION CHECKS       | Ensured markings are made on the column dowels for concrete level.             | YES_OR_NA | Yes       | No       | No        | No
12   | PRE-EXECUTION CHECKS       | Ensured necessary cube moulds and slump cones are available at site.           | YES_OR_NA | Yes       | No       | No        | No
13   | PRE-EXECUTION CHECKS       | Checked and ensured all the workers wearing safety PPE's.                      | YES_OR_NA | Yes       | No       | No        | No
14   | CHECKS DURING EXECUTION    | Checked and ensured the grade of concrete, mix ratio of materials mentioned in the batch ticket are as per approved design mix. | YES_OR_NA | Yes | No | No | No
15   | CHECKS DURING EXECUTION    | Ensured the workability of the mix as per approved requirements.               | YES_OR_NA | Yes       | No       | No        | No
16   | CHECKS DURING EXECUTION    | Ensured pour cards are filled for every truck load of concrete.                | YES_OR_NA | Yes       | No       | No        | No
17   | CHECKS DURING EXECUTION    | Ensured shuttering is wet and clean before concreting.                         | YES_OR_NA | Yes       | No       | No        | No
18   | CHECKS DURING EXECUTION    | Ensured layer wise concreting followed for depth of concreting more than 500mm. | YES_OR_NA | Yes      | No       | No        | No
19   | CHECKS DURING EXECUTION    | Ensured number of concrete cubes are casted for testing at site.               | YES_OR_NA | Yes       | No       | No        | No
20   | CHECKS DURING EXECUTION    | Ensured sufficient compaction is done properly.                                | YES_OR_NA | Yes       | No       | No        | No
21   | CHECKS DURING EXECUTION    | Ensured the concrete is finished within three hours from the time of mixing / as per design mix if retarders are used. | YES_OR_NA | Yes | No | No | No
22   | CHECKS DURING EXECUTION    | Ensured the level of finish is checked and corrected when concrete is fresh.   | YES_OR_NA | Yes       | No       | No        | No
23   | CHECKS DURING EXECUTION    | Ensured if any excess slurry is cleaned.                                       | YES_OR_NA | Yes       | No       | No        | No
24   | POST-EXECUTION CHECKS      | Ensured deshuttering is done after the recommended stripping time              | YES_OR_NA | Yes       | No       | No        | No
25   | POST-EXECUTION CHECKS      | Ensured all tie rod holes are packed with approved grout                       | YES_OR_NA | Yes       | Yes      | No        | No
26   | POST-EXECUTION CHECKS      | Ensured the surface of the concrete is good without any defects such as honey combs, damages etc. | YES_OR_NA | Yes | Yes | No | Yes
27   | POST-EXECUTION CHECKS      | Ensured the dimensions, line level plumb are within limits and recorded post deshuttering | YES_OR_NA | Yes | No | No | No
28   | POST-EXECUTION CHECKS      | Ensured the date of casting is neatly marked on the surface.                   | YES_OR_NA | Yes       | No       | No        | No
29   | POST-EXECUTION CHECKS      | Ensured the curing of the concrete is done by covering the surface using hessain cloths / using curing compounds. | YES_OR_NA | Yes | Yes | No | No
30   | POST-EXECUTION CHECKS      | Ensured housekeeping is maintained around the cast area.                       | YES_OR_NA | Yes       | No       | No        | No
```

**Signature slots (applied to final stage — POST-EXECUTION CHECKS):**
```json
[
  {"slotId":"contractor_site_in_charge","label":"Site In Charge","party":"Contractor","role":"SITE_ENGINEER","required":true,"sequence":1},
  {"slotId":"contractor_qc_engineer","label":"QC Engineer","party":"Contractor","role":"QC_ENGINEER","required":true,"sequence":2},
  {"slotId":"phl_site_in_charge","label":"Site In Charge","party":"PL/PHL","role":"SITE_IN_CHARGE","required":true,"sequence":3},
  {"slotId":"phl_qa_pe","label":"QA & PE","party":"PL/PHL","role":"QA_PE","required":true,"sequence":4}
]
```

---

## 9. PART D — PDF SMART IMPORT STRATEGY

PDF checklists from Puravankara's quality library (scanned or digital) must be importable using the same 3-step wizard flow as Excel, but with an additional **smart-parse → clarify → confirm** intermediate step because PDF structure must be inferred rather than read from a schema.

---

### 9.1 When PDF Import is Triggered

The existing upload step (Step 1) detects file type:
- `.xlsx` / `.xls` → Excel path (existing Part B flow)
- `.pdf` → PDF path (new Part D flow)

Both paths converge at the same **Preview + Confirm** step and the same **backend save** call. Only the parsing pipeline differs.

---

### 9.2 PDF Parsing Pipeline

```
PDF Upload
  │
  ├─ [Digital PDF?]  ──→  pdf-parse / pdfjs-dist  ──→  Raw text + layout
  │
  └─ [Scanned image?] ──→  Tesseract.js (OCR)  ──→  Raw text (lower fidelity)
         │
         ▼
  Structure Detection  (rule-based heuristics on raw text)
         │
         ▼
  Field Extraction  (regex + keyword matching per Puravankara format)
         │
         ▼
  Confidence Scoring  (per extracted field, 0–100%)
         │
         ├─ All fields ≥ 80%  ──→  Skip clarification, go to Preview step
         │
         └─ Any field < 80%  ──→  Clarification step
```

---

### 9.3 Digital PDF vs Scanned PDF Detection

Before running OCR, check if the PDF has extractable text:

```typescript
// In pdf-parse call result:
const result = await pdfParse(buffer);
const isDigital = result.text.trim().length > 50; // enough text was extracted

if (isDigital) {
  return extractFromText(result.text);
} else {
  // Fall back to OCR
  const ocrText = await runTesseract(buffer); // convert PDF pages to images first
  return extractFromText(ocrText);
}
```

**Packages:**
- `pdf-parse` (npm) — lightweight text extraction from digital PDFs
- `pdfjs-dist` — alternative with layout/position data for column detection
- `tesseract.js` — in-process OCR for scanned PDFs (no external service needed)
- `pdf2pic` or `sharp` — convert PDF pages to PNG for Tesseract input

---

### 9.4 Structure Detection Rules

Puravankara checklists follow a consistent layout. Use these heuristics to identify regions:

#### 9.4.1 Header Block Detection

The header is at the top of page 1. Look for these patterns (case-insensitive):

| Pattern to match | Extracts |
|---|---|
| `Checklist No[:\s]+([A-Z]{2}\.[A-Z]{2}\.\d+[A-Z]?)` | `checklistNo` |
| `Rev(?:\.|ision)?\s*No[:\s]+(\w+)` | `revNo` |
| `Date[:\s]+([\d\/\-\.]+)` | `revDate` |
| `Dwg\.?\s*No[:\s]+(\S+)` | `drawingNo` |
| `(?:CHECKLIST FOR|CHECKLIST -|FOR)\s+(.+?)(?:\n|$)` | `activityTitle` |
| Company logo / letterhead → `PURAVANKARA` → confirms it's a Puravankara doc | `isKnownFormat = true` |

If `isKnownFormat = false` (no Puravankara letterhead detected), flag the import with a warning and ask the user to confirm or correct all header fields.

#### 9.4.2 Section Heading Detection

Section headings are typically:
- ALL CAPS
- Standalone line (not preceded by a number)
- Followed by numbered items

```typescript
// Regex: line is all-caps and ≥ 5 chars, not a number, preceded by blank line
const isSectionHeading = (line: string) =>
  /^[A-Z\s\-\/&]{5,}$/.test(line.trim()) &&
  !/^\d/.test(line.trim());
```

Known section heading patterns in Puravankara checklists:
- `PRE-EXECUTION CHECKS`
- `CHECKS DURING EXECUTION`
- `POST EXECUTION CHECKS` / `POST-EXECUTION CHECKS`
- `DURING EXECUTION`
- `BEFORE COMMENCEMENT`
- `MATERIALS CHECK`
- `SAFETY CHECKS`

If a heading is detected that does NOT match known patterns, assign confidence 65% and include in clarification.

#### 9.4.3 Item Row Detection

Each checklist item typically follows this pattern:

```
<SlNo>  <Description text...>  YES  NA  REM
```

Regex to detect item rows:
```typescript
// Line starts with 1–3 digit number followed by text
const isItemRow = /^(\d{1,3})[.\s]+(.{10,})/.test(line);
```

Column presence detection:
- Look for `YES` / `NA` / `REM` header row near top of table area
- If `YES / NO` appears instead of `YES / NA` → `type = 'YES_NO'`
- If no YES/NA columns detected → default to `YES_OR_NA`

#### 9.4.4 Signature Block Detection

Signature blocks are at the bottom of the last section. Detect by:
- Keywords: `Signature`, `Name`, `Date`, `Contractor`, `PL/PHL`, `Consultant`
- Two-column or four-column layout of role labels

Extract signature roles and map to known `SignatureSlotConfig` roles:
```typescript
const signatoryMap: Record<string, string> = {
  'site in charge': 'SITE_ENGINEER',
  'qc engineer': 'QC_ENGINEER',
  'qa & pe': 'QA_PE',
  'quality engineer': 'QC_ENGINEER',
  'project manager': 'PROJECT_MANAGER',
};
```

---

### 9.5 Confidence Scoring

Each extracted field gets a confidence score (0–100%):

| Field | How confidence is determined |
|---|---|
| `checklistNo` | 100% if regex matches Puravankara format (`CL.QA.XXX`); 70% if partial match; 30% if guessed |
| `revNo` | 100% if `Rev No:` label found and value is `\d{2}`; 60% if only a number found near top |
| `activityTitle` | 90% if line after "CHECKLIST FOR" matches; 60% if inferred from document title |
| `activityType` | 85% if extracted from header; 50% if inferred from activity title keywords |
| `sections` | 100% if all-caps standalone line; 65% if heuristic match |
| `item descriptions` | 90% if preceded by sequential number; 60% if number is missing/skipped |
| `item count` | 100% if count matches Sl.No sequence with no gaps; 70% if gaps detected |
| `signatureSlots` | 80% if known role labels found; 50% if unknown labels detected |

**Threshold:** If any field scores < 80%, the clarification step is shown.

---

### 9.6 Clarification Step (New Step 1.5)

When confidence < 80% for any field, insert a **Clarification modal** between upload and the preview step.

#### UI Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  PDF Parsed — Some fields need your confirmation                    │
│  ────────────────────────────────────────────────────────────────   │
│  We extracted the following from the PDF. Please verify:            │
│                                                                     │
│  Checklist No     [CL.QA.08C___________]   ✅ High confidence      │
│  Rev No           [01__________________]   ✅ High confidence      │
│  Activity Title   [CHECKLIST FOR BEAM AND SLAB___________]  ✅     │
│  Activity Type    [CONCRETING__________]   ⚠ 55% — please verify  │
│  Discipline       [Civil_______________]   ⚠ 50% — please confirm │
│  Trade            [____________________]   ❓ Not detected         │
│                                                                     │
│  Sections detected (3):                                             │
│  ┌──────────────────────────────────────────────┐                  │
│  │ ✅ PRE-EXECUTION CHECKS           (13 items) │                  │
│  │ ✅ CHECKS DURING EXECUTION        (10 items) │                  │
│  │ ⚠  POST EXECUTION CHECKS          ( 7 items) │ ← rename?        │
│  │    [POST-EXECUTION CHECKS_______]            │                  │
│  └──────────────────────────────────────────────┘                  │
│                                                                     │
│  Items with uncertainty (2):                                        │
│  ├ Row 14: [Full text auto-extracted] ✅                            │
│  └ Row 22: "Ensured concrete is finished" — 2 lines merged?        │
│    [View full text ▼]  [Accept merged text]  [Split into 2 items]  │
│                                                                     │
│  [← Re-upload different file]        [Confirm and Preview →]       │
└─────────────────────────────────────────────────────────────────────┘
```

#### Clarification Fields

Show only fields where confidence < 80% or where value is empty:

| Field state | Display |
|---|---|
| Confidence ≥ 80% | Show value with ✅ — read-only (collapsed by default) |
| Confidence 50–79% | Show editable field with ⚠ badge and confidence % |
| Confidence < 50% or empty | Show empty editable field with ❓ badge |

#### Section Name Editing

When a detected section name doesn't match known patterns exactly, show the detected name with an inline editable field so the user can correct the label before import (e.g., `POST EXECUTION CHECKS` → `POST-EXECUTION CHECKS`).

#### Item Merge/Split

If two adjacent item descriptions appear to have been merged by the PDF reader (long text covering two logical items), surface them for user review with options:
- **Accept merged** — keep as one item
- **Split here** — user clicks inside the text to mark the split point

---

### 9.7 Backend: PDF Import Endpoint

**New Endpoint:** `POST /quality/checklist-templates/project/:projectId/import-pdf`

```typescript
@Post('project/:projectId/import-pdf')
@UseInterceptors(FileInterceptor('file'))
@UseGuards(PermissionsGuard)
@RequirePermissions('QUALITY.CHECKLIST.CREATE')
async importChecklistFromPdf(
  @Param('projectId') projectId: number,
  @UploadedFile() file: Express.Multer.File,
): Promise<PdfParseResult>
```

**Return type:**
```typescript
interface PdfParseResult {
  // Extracted fields with confidence scores
  fields: {
    checklistNo:  { value: string | null; confidence: number };
    revNo:        { value: string | null; confidence: number };
    activityTitle:{ value: string | null; confidence: number };
    activityType: { value: string | null; confidence: number };
    discipline:   { value: string | null; confidence: number };
    applicableTrade:{ value: string | null; confidence: number };
  };

  // Detected sections with their items
  sections: ParsedSection[];

  // Signature roles detected (if any)
  signatureSlots: { value: SignatureSlotConfig[]; confidence: number };

  // Overall parse quality indicator
  overallConfidence: number;      // min of all field confidences
  requiresClarification: boolean; // true if any field < 80%

  // Any items that look like they might be merged or malformed
  itemWarnings: ItemWarning[];

  // Whether source was digital or OCR
  parseMethod: 'digital' | 'ocr';
}

interface ParsedSection {
  name: string;
  confidence: number;   // confidence of section heading detection
  items: ParsedItem[];
}

interface ParsedItem {
  slNo: number | null;
  description: string;
  type: 'YES_OR_NA' | 'YES_NO' | 'TEXT';
  confidence: number;
}

interface ItemWarning {
  approximateSlNo: number;
  description: string;
  warningType: 'possible_merge' | 'missing_number' | 'truncated_text';
  rawText: string;
}
```

**After user confirms fields in the clarification step**, the frontend sends a **second call** to the standard `import-excel` save endpoint, passing the corrected parsed data as JSON (same `ParsedChecklistPreview` shape used by Excel import) — so the save logic is reused:

```
PDF parse result  →  clarification UI  →  user-corrected ParsedChecklistPreview
    →  POST /quality/checklist-templates/project/:id/import-excel?preview=false
       (with Content-Type: application/json, body = corrected preview array)
```

This means the backend `saveChecklists()` function works for both Excel and PDF imports without modification.

---

### 9.8 Backend: PDF Parser Service

**File to create:** `backend/src/quality/checklist-pdf-parser.service.ts`

**Key methods:**

```typescript
@Injectable()
export class ChecklistPdfParserService {

  // Entry point — detects digital vs scanned and routes accordingly
  async parsePdf(buffer: Buffer): Promise<PdfParseResult>

  // Extract text from digital PDF
  private async extractDigitalText(buffer: Buffer): Promise<string>

  // Run OCR on scanned PDF (converts pages to images first)
  private async extractOcrText(buffer: Buffer): Promise<string>

  // Main structure parser — takes raw text, returns structured result
  private parseChecklistText(text: string): PdfParseResult

  // Extract header fields from top-of-page text block
  private extractHeaderFields(headerText: string): HeaderFields

  // Split raw text into section blocks
  private detectSections(lines: string[]): RawSection[]

  // Parse individual item rows within a section
  private parseItems(lines: string[]): ParsedItem[]

  // Detect and map signature blocks
  private detectSignatureSlots(footerText: string): SignatureSlotConfig[]

  // Score confidence for all extracted fields
  private scoreConfidence(result: Partial<PdfParseResult>): PdfParseResult
}
```

**npm packages to add to backend:**
```json
"pdf-parse": "^1.1.1",
"tesseract.js": "^5.0.0",
"pdf2pic": "^3.1.1"
```

---

### 9.9 Frontend: Updated Upload Step (Step 1)

The existing Step 1 upload box needs minor changes:

```
┌──────────────────────────────────────────────────┐
│  Import Checklists                               │
│  ────────────────────────────────────────────    │
│  📥 Drop your file here                          │
│     Excel (.xlsx) or PDF                         │
│     or [Browse File]                             │
│                                                  │
│  Excel: one sheet per checklist (structured)     │
│  PDF: single checklist, smart-parsed             │
│                                                  │
│  [Download Excel Template]                       │
└──────────────────────────────────────────────────┘
```

**Note:** PDF import supports one checklist per PDF. For multiple PDFs, users upload them one at a time (or the backend can accept a ZIP of PDFs as a future enhancement).

---

### 9.10 Updated Import Flow (Full)

```
Step 1 — Upload
  ├─ .xlsx/.xls → [Excel path]
  │     └─ POST /import-excel?preview=true
  │           └─ Step 2 — Preview (existing Excel flow)
  │
  └─ .pdf → [PDF path]
        └─ POST /import-pdf
              ├─ overallConfidence ≥ 80%?
              │     └─ Skip clarification → Step 2 — Preview (same as Excel)
              │
              └─ overallConfidence < 80%?
                    └─ Step 1.5 — Clarification modal
                          └─ User confirms / corrects fields
                                └─ Step 2 — Preview (with corrected data)

Step 2 — Preview (shared)
  └─ User reviews sections, items, counts, overwrites existing?

Step 3 — Confirm & Save
  └─ POST /import-excel (JSON body with corrected ParsedChecklistPreview)
        └─ Step 4 — Result summary
```

---

### 9.11 Updated File Change Summary (Part D additions)

#### Backend

| File | Action | Change |
|------|--------|--------|
| `checklist-pdf-parser.service.ts` | **CREATE** | Full PDF parsing pipeline (digital + OCR) |
| `checklist-template.controller.ts` | **MODIFY** | Add `POST /import-pdf` endpoint |
| `package.json` | **MODIFY** | Add `pdf-parse`, `tesseract.js`, `pdf2pic` |

#### Frontend

| File | Action | Change |
|------|--------|--------|
| `ChecklistImportModal.tsx` | **MODIFY** | File type detection; add PDF clarification step (Step 1.5) |
| `types/checklist-import.ts` | **MODIFY** | Add `PdfParseResult`, `ParsedSection`, `ItemWarning` types |

---

### 9.12 Acceptance Criteria — PDF Import

- [ ] Uploading a digital Puravankara-format PDF auto-extracts checklistNo, revNo, activityTitle with ≥ 80% confidence
- [ ] Scanned PDF (image-only) runs OCR and extracts checklist structure (may be lower confidence, triggering clarification)
- [ ] Any field with confidence < 80% is shown in the clarification step with the extracted value and a confidence badge
- [ ] User can edit any extracted field in the clarification step before proceeding
- [ ] Section headings that differ from known Puravankara patterns are flagged for user correction
- [ ] Items that appear to be merged across lines are surfaced with split/accept options
- [ ] After clarification, the confirmed data flows through the same Preview + Save pipeline as Excel import
- [ ] PDF parse errors (password-protected PDF, corrupt file, non-checklist content) show a clear error message and prevent reaching the preview step
- [ ] Non-Puravankara PDF format (no recognisable header) shows a warning banner but still allows manual entry of header fields
- [ ] All PDF-imported checklists appear in the library identically to Excel-imported or manually created ones

---

### 9.13 Future Enhancements (Out of Scope for Now)

| Enhancement | Notes |
|---|---|
| ZIP batch PDF upload | Upload ZIP of 20 PDFs → import all in sequence with per-file status |
| Learning from corrections | Store user corrections to improve regex rules over time |
| AI-assisted parsing | Send extracted text to Claude API for structured field extraction — higher accuracy on non-standard formats |
| Multi-page PDF with multiple checklists | Detect page breaks as checklist boundaries |
| Signature image extraction | Extract actual signature blocks as image regions for display in PDF report |
