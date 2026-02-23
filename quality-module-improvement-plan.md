# Implementation Plan: Quality Module Improvement

Building upon the existing Quality module, this plan outlines the path to an enterprise-grade construction quality ERP system with multi-stage inspections, checklist templates, and digital compliance.

## 1. Analysis of Current State vs. Target
| Feature | Current State | Target State | Gap |
|---------|---------------|--------------|-----|
| **Locations** | Projects, Blocks, Towers, Floors | + Units, Rooms | Expand filter logic in UI |
| **Checklists** | JSON blob in `QualityChecklist` | Template-based structure (`Template` -> `Item`) | New Entity Model required |
| **Inspections** | Single-step (Pending/Approved) | Multi-stage (Pre/During/Post) | Multi-stage orchestration required |
| **Observations** | `QualityItem` (Snag) | Lifecycle with Severity & Assignment | Refine `QualityItem` or extend it |
| **Compliance** | Basic logging | Digital Signatures & SHA-256 Locking | Cryptographic service required |

---

## 2. Phase 1: Backend Data Model Enhancement (Sprint 1)
Objective: Setup the foundation without breaking existing logic.

### 2.1 New Entities
- **`QualityChecklistTemplate`**: Master templates for activities.
- **`QualityStageTemplate`**: Defines custom stages per template (e.g., 'Pre', 'During', 'Post', or any custom sequence).
- **`QualityChecklistItemTemplate`**: Granular items within a stage template (type: Yes/No, Text, Numeric, Photo).
- **`QualityInspection`**: Updated to link with the new stage-based workflow.
- **`QualityInspectionStage`**: Tracking execution of individual stages defined by the template.
- **`QualityChecklistItem`**: Execution record (answers) for each item in a stage.
- **`QualitySignature`**: Capturing user signatures, timestamps, and data hashes.

### 2.2 Entity Relationships
- `QualityActivity` -> `QualityChecklistTemplate` (1:1)
- `QualityChecklistTemplate` -> `QualityStageTemplate` (1:N)
- `QualityStageTemplate` -> `QualityChecklistItemTemplate` (1:N)
- `QualityInspection` -> `QualityInspectionStage` (1:N)
- `QualityInspectionStage` -> `QualitySignature` (1:1)

---

## 3. Phase 2: Service Layer & Core Logic (Sprint 2)
Objective: Move logic from generic `QualityService` to specialized services.

### 3.1 specialized Services
- **`ChecklistService`**: Handles template versioning, item-wise pass/fail logic.
- **`InspectionService`**: Workflow orchestration. Auto-closing stages upon reaching witness/hold points.
- **`ComplianceService`**:
    - `generateHash(data)`: Create SHA-256 hash including checklist answers, photo references, GPS coordinates, and timestamps.
    - `verifyIntegrity(stageId)`: Detect tampering.
- **`ObservationService`**: Manage observation lifecycle (Minor/Major/Critical).

---

## 4. Phase 3: Frontend UI/UX Pro Max (Sprint 3)
Objective: Implement the stunning, premium UI from wireframes.

### 4.1 Dashboard Hub
- **Status Heatmap**: Visualize floor/unit-wise quality status.
- **Advanced Metrics**: Quality Score %, Observation Density.

### 4.2 Interactive Checklist Builder
- Drag-and-drop builder for custom templates.
- Support for mandatory photo evidence.

### 4.3 Inspector Execution Flow
- Mobile-responsive execution interface.
- Integrated Signature Pad for instant sign-offs.

---

## 5. Phase 4: Migration & Integration (Sprint 4)
Objective: Transition from legacy to new system.

### 5.1- **Backward Compatibility**: Migrate legacy `quality_checklists` table (JSON) into the new relational structure (`Template` -> `Stage` -> `Item`).
- **Graceful Transition**: Update `QualityInspection` to handle both legacy (one-off) and new (stage-based) inspections during the rollout.

### 5.2 Document Locking
- Implementation of immutable records once a stage is "Fingerprinted" (Hashed).
- QR code generation for field verification.

---

## 6. Verification Plan
- **Unit Tests**: Test SHA-256 hash mismatch detection.
- **Integration Tests**: Verify dependency-locked inspections (cannot start 'During' stage without 'Pre' approval).
- **Performance**: Audit Dashboard heatmap rendering for 1000+ units.

## 7. Next Steps (Action Items)
1. **Approval**: Confirm entity names and relationship structure.
2. **Schema Migration**: Create TypeORM migrations for new entities.
3. **Core API**: Implement `ChecklistTemplate` CRUD.
