# Quality Module — Activity List & Sequence Manager

## Confirmed Decisions
- Standalone (not linked to Planning activities)
- Multiple lists per EPS node allowed
- EPS structure inherited from project
- Sequence Manager is a separate page/menu
- Manual entry + CSV import + Edit + Delete
- Delete auto-relinks sequence to previous valid activity
- allowBreak toggle per activity (permission-controlled)

## Phase 1 — Backend

### 1.1 Entities
- [ ] `QualityActivityList` entity
- [ ] `QualityActivity` entity (self-referential previousActivityId)

### 1.2 Module scaffold
- [ ] `quality-activity` NestJS module
- [ ] DTOs: CreateListDto, UpdateListDto, CreateActivityDto, UpdateActivityDto, ImportCsvDto

### 1.3 Service methods
- [ ] createList, getLists, getListById, updateList, deleteList
- [ ] createActivity, getActivities, updateActivity, deleteActivity (with auto-relink)
- [ ] importFromCsv (parse, validate, bulk insert)
- [ ] reorderActivities (update sequence numbers)

### 1.4 Controller endpoints
- [ ] GET    /quality/lists?projectId=&epsNodeId=
- [ ] POST   /quality/lists
- [ ] PATCH  /quality/lists/:id
- [ ] DELETE /quality/lists/:id
- [ ] GET    /quality/lists/:listId/activities
- [ ] POST   /quality/lists/:listId/activities
- [ ] PATCH  /quality/activities/:id
- [ ] DELETE /quality/activities/:id
- [ ] POST   /quality/lists/:listId/import-csv
- [ ] PATCH  /quality/lists/:listId/reorder

## Phase 2 — Frontend: Activity Lists Page

### 2.1 Route
- [ ] Add route: /dashboard/projects/:projectId/quality/lists
- [ ] Add sidebar item under Quality Control

### 2.2 ActivityListsPage component
- [ ] EPS tree on left (reuse Tree component)
- [ ] Table of lists for selected node (name, item count, created by, actions)
- [ ] "+ Create List" button → modal
- [ ] "Import CSV" button → upload modal
- [ ] Edit list → modal
- [ ] Delete list → confirm dialog
- [ ] Click row → navigate to Sequence Manager

## Phase 3 — Frontend: Sequence Manager Page

### 3.1 Route
- [ ] Add route: /dashboard/projects/:projectId/quality/lists/:listId/sequence

### 3.2 SequenceManagerPage component
- [ ] Header: list name, EPS node breadcrumb
- [ ] "+ Add Activity" button → inline form or modal
- [ ] Drag-and-drop list (using @dnd-kit/core)
- [ ] Per-row: sequence badge, activity name, description, Hold Point toggle, Witness Point toggle, Allow Break toggle, Edit button, Delete button
- [ ] Visual predecessor connector (arrow/line showing previous activity)
- [ ] Auto-save sequence on drop
- [ ] Delete auto-relinks previousActivityId

## CSV Format
```
Sequence,ActivityName,Description,PreviousActivityCode,HoldPoint,WitnessPoint,ResponsibleParty,AllowBreak
1,Excavation Check,Verify depth,,Y,N,Contractor,N
2,Reinforcement Inspection,Check bar dia,1,Y,Y,Consultant,N
```
