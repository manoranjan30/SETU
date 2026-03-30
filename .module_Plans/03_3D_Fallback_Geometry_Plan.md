# 3D Progress Fallback Geometry Plan

## Requirement

If no coordinate information exists at any hierarchy level, the system must still show a 3D model using default geometry:

- footprint: `30m x 40m`
- floor-to-floor height: `3m`
- tower-to-tower spacing: `5m`

## Current State

Files scanned:

- `backend/src/planning/building-line-coordinate.service.ts`
- `frontend/src/components/planning/BuildingProgress3DTab.tsx`

Current behavior:

- renderer can fall back from room to unit to floor to tower to block to project polygon
- but it still requires some polygon source somewhere
- if no coordinates exist anywhere, the viewer cannot synthesize geometry

## Gap

No synthetic geometry generation exists.

## Solution

### Frontend-first fallback

Implement synthetic polygons in `BuildingProgress3DTab.tsx` when:

- root structure exists
- towers and floors exist
- but no polygons are available at any level for the selected scope

### Synthetic rules

- each tower footprint uses a generated rectangle
- width `30`
- depth `40`
- spacing `5`
- lay towers along one axis in deterministic order
- each floor height defaults to `3`

### Output rules

- preserve normal progress overlay logic
- preserve selected tower filtering
- preserve floor/unit/room modes as much as practical
- generated geometry should be clearly marked internally as synthetic/fallback for future UI labeling

## Future Enhancement

Optionally later add backend-generated synthetic snapshots for consistency across web, mobile, and dashboards.

## Verification

- project with no coordinates still renders 3D massing
- multiple towers render side-by-side with 5m spacing
- floor stacking uses 3m heights
- progress overlays still work

