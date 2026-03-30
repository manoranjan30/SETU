# Implementation Waves and Verification Matrix

## Wave 1: Foundations

### Deliverables

- synthetic 3D fallback geometry
- centralized project lifecycle helper
- notification context/composer skeleton
- import/export shared contracts

### Verification

- targeted backend build
- targeted frontend type check on touched files
- manual smoke test for 3D project preview with no coordinates

## Wave 2: Notifications

### Deliverables

- central notification composer
- human-readable push messages
- approval-authority aware routing in priority modules

### Verification

- project/floor/activity readable push text
- no raw ids
- correct recipients by role/permission

## Wave 3: Export

### Deliverables

- shared export menu component
- backend export endpoints where full dataset required
- high-priority module coverage

### Verification

- current grid and full dataset exports match scope
- CSV and Excel generate correct headers and row counts

## Wave 4: Bulk Import

### Deliverables

- shared CSV import wizard
- staged validation and commit
- first adapters:
  - BOQ
  - WBS/Schedule
  - Work Orders
  - Labor

### Verification

- dry-run preview
- row-level errors
- successful commit with audit trail

## Wave 5: Lifecycle Closeout

### Deliverables

- closed projects removed from active selectors and lists
- reporting still supports explicit closed-project view

### Verification

- closed project hidden in operational selectors
- visible in historical/report contexts

## Regression Rules

- do not rewrite working transactional logic when adding import/export
- do not make schema changes for optional preferences until the messaging composer layer is proven
- keep synthetic 3D geometry isolated to no-coordinate cases only
- guard every rollout behind targeted tests or manual smoke checks in the touched modules

