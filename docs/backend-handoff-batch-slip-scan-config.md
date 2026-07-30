# Backend Handoff: Batch Slip Scan — Configurable Field Label Synonyms

## Summary

The mobile app has an on-device "Scan Batch Slip" feature on the Concrete Pour Card entry screen: the user photographs a batching-plant delivery slip, ML Kit OCRs it on-device, and a regex parser pulls out truck no., quantity, grade, slump, batch time, challan no., and supplier name to pre-fill the entry form. It's regex-only (no LLM) and runs fully offline — this matters because construction sites have unreliable connectivity.

Different batching plants word their slip labels differently ("Truck No" vs "Vehicle No" vs "Lorry No", "Qty" vs "Volume" vs "Delivered Qty", etc.). Today those label synonyms are hardcoded in the mobile app, so supporting a new supplier's wording requires an app release. The ask: let a quality admin add label synonyms through a config screen instead, so mobile can pick up new wording without a redeploy.

**This request is backend + admin-panel work only.** No changes to the OCR/scan flow itself — that stays exactly as it is on mobile once this ships.

## Design decision: plain label text, not raw regex — and why

The obvious-looking design is a free-text "regex" field the admin types into. **Recommend against that.** Reasons:

- The regex runs on end-user phones with no execution timeout available in Dart's `RegExp` — a malformed or pathological pattern (accidental catastrophic backtracking) typed by a non-technical admin degrades or hangs the scan for every user of that project, not just the admin who typed it.
- There's no reliable way to validate "is this a safe, correct regex" server-side before saving it — syntax validity isn't the same as runtime safety.
- It's not functionally necessary. The actual requirement is "recognize this label wording," not "control the entire match/capture logic." Plain text achieves that just as well.

**Recommended design instead:** the admin types the literal label text as printed on the slip (e.g. `RMC Unit`, `Veh Reg No`, `Delivered Qty`) — no regex syntax at all. Mobile is responsible for regex-escaping that literal string and wrapping it with the existing value-shape pattern for that field (a quantity is still always "digits, optional decimal," a time is still always `HH:MM`, etc. — only the *label* wording is configurable, not the value shape). This is what the rest of this doc assumes.

## Scope boundary — please keep this contained

- **No image/zone/pixel mapping.** A separate "map where on the slip each field sits" idea was considered and explicitly deferred — real slip photos have inconsistent rotation/skew/scale, so pixel-coordinate mapping from a sample photo isn't reliable without perspective correction, which is a much larger and separate problem. This handoff is text-label synonyms only.
- **No backend OCR.** This endpoint never receives a photo or OCR'd text. It only serves/stores the synonym config. Extraction stays 100% on-device on mobile, for the same offline reason described above.
- **No per-scan network call.** Mobile will fetch and cache this config per project (same pattern already used for `getConcreteGrades(projectId)`), refreshed opportunistically — not on every scan.

## Data model

New table, closely modeled on the existing `quality_concrete_grades` pattern (project-scoped master data):

```typescript
@Entity('quality_batch_slip_field_synonyms')
export class QualityBatchSlipFieldSynonym {
  @PrimaryGeneratedColumn()
  id: number;

  // null = global/company-wide default, applies to every project that
  // hasn't got its own entry for the same fieldKey. Non-null = specific
  // to that project (ADDED on top of globals, not a replacement — see
  // merge behavior below).
  @Column({ type: 'int', nullable: true })
  projectId: number | null;

  @Column({ type: 'varchar', length: 40 })
  fieldKey: string; // see enum below

  // Plain literal label text as printed on the slip — NOT a regex.
  @Column({ type: 'varchar', length: 60 })
  label: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

Recommend a unique constraint / index on `(projectId, fieldKey, lower(label))` to prevent duplicate synonyms for the same field.

### `fieldKey` enum values

Matches mobile's `BatchSlipExtraction` fields 1:1 — don't add/rename without checking with mobile first, since the key is what mobile keys its merge logic on:

| fieldKey | Meaning | Example labels already built into mobile |
|---|---|---|
| `TRUCK_NO` | Delivery truck/vehicle registration | "Truck No", "Vehicle No", "Veh No", "Lorry No" |
| `DELIVERY_CHALLAN_NO` | Delivery challan / docket / ticket number | "Challan No", "DC No", "Ticket No", "Invoice No" |
| `MIX_GRADE` | Concrete grade/mix ID | "Grade", "Mix ID", "Concrete Grade", "Concrete Type" |
| `QUANTITY_M3` | Delivered concrete volume | "Qty", "Quantity", "Volume", "Delivered Qty" |
| `SLUMP_MM` | Slump test value | "Slump" |
| `BATCH_START_TIME` | Batching/loading/dispatch time | "Batch Time", "Loading Time", "Dispatch Time" |
| `SUPPLIER_NAME` | RMC plant/supplier name | "Plant", "Supplier", "RMC Plant", "Batching Plant" |

## API endpoints

Two endpoints — a lean one mobile consumes at scan-config-fetch time, and a CRUD set for the admin config menu.

### `GET /api/quality/batch-slip-config?projectId=:id`
`@Permissions('QUALITY.BATCH_SLIP_CONFIG.READ')`

Returns the **resolved, active** synonym list for that project — global (`projectId IS NULL`) rows **unioned** with that project's own rows, deduplicated case-insensitively, grouped by `fieldKey`. This is the shape mobile actually fetches and caches:

```json
{
  "TRUCK_NO": ["RMC Wagon No", "Truck Reg"],
  "DELIVERY_CHALLAN_NO": ["Voucher No"],
  "SUPPLIER_NAME": ["Unit Name"]
}
```

(Only fields that have *admin-added* synonyms need to appear — mobile already has its own built-in defaults and unions them with whatever this returns. An empty/unconfigured project should return `{}`, and the scan feature keeps working exactly as it does today.)

### Admin CRUD (for the new "Batch Slip Scan Config" menu inside Quality module config)

- `GET /api/quality/batch-slip-config/synonyms?projectId=:id` — full list including inactive, for the management UI. `@Permissions('QUALITY.BATCH_SLIP_CONFIG.MANAGE')`
- `POST /api/quality/batch-slip-config/synonyms` — body `{ projectId: number | null, fieldKey: string, label: string }`. `@Permissions('QUALITY.BATCH_SLIP_CONFIG.MANAGE')`
- `PUT /api/quality/batch-slip-config/synonyms/:id` — update `label` / `isActive`. `@Permissions('QUALITY.BATCH_SLIP_CONFIG.MANAGE')`
- `DELETE /api/quality/batch-slip-config/synonyms/:id` — hard delete, or soft via `isActive = false` (your call, either is fine since the resolved GET only returns active rows either way). `@Permissions('QUALITY.BATCH_SLIP_CONFIG.MANAGE')`

## Permissions

Add following the existing `MODULE.ENTITY.ACTION` convention (see `QUALITY.POUR_CARD.*` for the most recent precedent):

- `QUALITY.BATCH_SLIP_CONFIG.READ`
- `QUALITY.BATCH_SLIP_CONFIG.MANAGE`

Register in `permission-registry.ts` and `permission-config.ts` alongside the other `QUALITY.*` entries. Preset wiring (which roles get this by default) is your call — QC Manager / project-quality-admin style presets are the natural fit, but you know the preset structure better than I do.

## Validation rules

- `label`: required, trimmed, 2–60 chars. Reject blank/whitespace-only.
- `fieldKey`: must be one of the enum values above — reject anything else with 400.
- `projectId`: must be `null` or a valid existing project id.
- Duplicate `(projectId, fieldKey, label)` (case-insensitive) → 400, not a silent upsert.
- **No regex-syntax validation needed** — `label` is stored and transmitted as plain text, never compiled as a pattern on the backend. This is the whole point of the plain-text design above.

## Merge/resolution behavior (please confirm this matches what you build)

- Global (`projectId = null`) synonyms apply to every project by default.
- A project-specific synonym for the same `fieldKey` **adds** to the globals for that project — it does not replace or hide them. This avoids an admin accidentally breaking a working default while adding a project-specific one.
- Mobile's own built-in synonym list (hardcoded, ships with the app) is a third layer, unioned in on the mobile side — this backend response only needs to carry what's been explicitly configured, not the full merged set mobile ends up using.

## Regression checks

1. Project with no rows at all → `GET /api/quality/batch-slip-config` returns `{}`, 200 OK, not an error.
2. Global synonym + project-specific synonym for the same `fieldKey` both appear in the resolved response for that project.
3. A project-specific synonym does **not** appear for a *different* project.
4. `isActive = false` row is excluded from the resolved GET immediately.
5. Duplicate `(projectId, fieldKey, label)` rejected with 400.
6. User without `QUALITY.BATCH_SLIP_CONFIG.MANAGE` gets 403 on POST/PUT/DELETE; read-only `QUALITY.BATCH_SLIP_CONFIG.READ` user can still hit the GET endpoints.

## What happens on the mobile side (context only — no action needed from you beyond the API above)

Once this ships, mobile will fetch `GET /api/quality/batch-slip-config?projectId=:id` the same way it already fetches concrete grades, cache it locally, and union the returned labels into the existing per-field regex label-alternation group before running the on-device parser. That's a separate, later mobile-side change — nothing here blocks on it, and nothing in this doc requires you to touch the OCR/scan code at all.
