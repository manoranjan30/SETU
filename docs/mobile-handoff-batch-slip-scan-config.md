# Mobile Handoff: Pour Card Batch Slip Scan Config

## Scope

Mobile scan/OCR remains offline and on-device. The backend only stores plain label synonyms entered by Quality admins, then serves a resolved field dictionary that mobile can cache per project.

## Backend APIs

Base path assumes the usual API prefix: `/api`.

### Read Resolved Config

`GET /api/quality/batch-slip-config?projectId=:projectId`

Permission: `QUALITY.BATCH_SLIP_CONFIG.READ`

Response shape:

```json
{
  "TRUCK_NO": ["Truck No", "Vehicle No"],
  "DELIVERY_CHALLAN_NO": ["Delivery Challan No", "DC No"],
  "MIX_GRADE": ["Grade", "Mix Grade"],
  "QUANTITY_M3": ["Qty", "Quantity"],
  "SLUMP_MM": ["Slump"],
  "BATCH_START_TIME": ["Batch Start Time"],
  "SUPPLIER_NAME": ["Supplier", "RMC Plant"]
}
```

If no rows exist, response is `{}`.

The backend returns active global labels plus active project-specific labels, deduped case-insensitively. Mobile should merge this with any built-in fallback labels and treat backend labels as configuration, not extraction logic.

### Admin CRUD

Admin CRUD is web/admin only, but listed here for contract awareness.

`GET /api/quality/batch-slip-config/synonyms?projectId=:projectId`

`POST /api/quality/batch-slip-config/synonyms`

```json
{
  "projectId": 7,
  "fieldKey": "TRUCK_NO",
  "label": "Vehicle No"
}
```

`projectId: null` means global default.

`PUT /api/quality/batch-slip-config/synonyms/:id`

```json
{
  "label": "Truck Number",
  "isActive": true
}
```

`DELETE /api/quality/batch-slip-config/synonyms/:id`

Admin permission: `QUALITY.BATCH_SLIP_CONFIG.MANAGE`

## Field Keys

- `TRUCK_NO`
- `DELIVERY_CHALLAN_NO`
- `MIX_GRADE`
- `QUANTITY_M3`
- `SLUMP_MM`
- `BATCH_START_TIME`
- `SUPPLIER_NAME`

## Mobile Implementation Notes

Fetch `GET /api/quality/batch-slip-config?projectId=:id` when the project opens, after login, or when the user manually refreshes project master data.

Cache by `projectId` with a timestamp. Use cached labels when offline. If the request fails, continue with built-in labels plus the last cache.

Do not expect regex, parsing expressions, bounding boxes, or OCR templates from backend. The labels are literal user-facing text hints only.

Normalize comparisons on-device using lowercase, whitespace collapse, and punctuation-tolerant matching. Keep the actual extraction rules inside the mobile app so scanning remains offline.

After extracting values, prefill the pour card batch slip fields and let the user review/edit before save or submit.

## UX Direction

Under the project Pour Card flow, show a scan action for batch slip capture. After OCR, present a review screen with confidence indicators for the seven mapped fields, quick edit controls, image preview, and a clear confirmation action.

For low-confidence or unmapped text, show a compact “Needs review” section instead of blocking the full entry.
