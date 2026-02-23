# Quality Sequencer Implementation Status

## Overview
Implemented the **Quality Activity Sequencer** (Node-Based Visual Editor) replacing the linear list view.

## Backend (NestJS)
- **New Entity**: `QualitySequenceEdge` (`quality-sequence-edge.entity.ts`) to store graph connections (Hard/Soft constraints).
- **Updated Entity**: `QualityActivity` (`quality-activity.entity.ts`) with `OneToMany` relations to edges and `position` JSON column.
- **New Service**: `QualitySequencerService` (`quality-sequencer.service.ts`) handling:
  - `getGraph(listId)`: Returns nodes and edges.
  - `saveGraph(listId)`: Updates positions, syncs edges, performs cycle detection.
- **New Controller**: `QualitySequencerController` (`quality-sequencer.controller.ts`) exposing `/quality/sequences/:listId`.
- **Module Update**: Registered components in `QualityModule`.

## Frontend (React)
- **Library**: Installed `@xyflow/react`.
- **New Page**: `QualitySequencer.tsx` (`src/views/quality/sequencer/`)
  - Full screen canvas.
  - Load/Save functionality.
  - Drag and Drop from Sidebar to create new activities.
  - Edge click handler to toggle Hard/Soft constraints.
- **Components**:
  - `QualityActivityNode.tsx`: Custom node visualizing activity status and sequence.
  - `Sidebar.tsx`: Draggable toolbox.
- **Service Update**: Added `getSequence`, `saveSequence`, `createActivity` to `quality.service.ts`.
- **Routing**: Updated `App.tsx` to route `projects/:projectId/quality/activity-lists/:listId/sequence` to the new Sequencer.

## Next Steps
- Run backend migration (synchronize database schema).
- Verify cycle detection in edge cases.
- enhance UI for "Lag Time" configuration (currently only constraint type toggle).
