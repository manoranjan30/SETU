# Implementation Plan: Micro Schedule Integration into Progress Module

**Created:** 2026-02-18  
**Status:** Draft  
**Type:** Feature Enhancement  
**Complexity:** High  
**Risk:** Medium (Backward Compatibility Critical)

---

## Executive Summary

Enhance the **Progress (Site Execution) Module** to support granular progress reporting via Micro Schedule activities while maintaining backward compatibility with the existing "Master Activity Only" flow.

**Key Objective:** Allow Site Engineers to report progress against specific Micro Activities OR a computed "Balance/Direct Execution" item, ensuring robust quantity balancing across the entire project hierarchy.

---

## Architecture Decision

**Chosen Approach:** **Unified Execution List (Option A)**

- **Why:** Best UX + Flexibility + Data Integrity
- **Risk Mitigation:** Implement as an additive feature. Existing "Master Activity" flow remains intact.
- **Rollback:** If issues arise, feature can be disabled via feature flag without data loss.

---

## System Impact Analysis

### Modules Affected

| Module | Impact | Risk | Mitigation |
|--------|--------|------|------------|
| **Progress (Execution)** | High - Core Logic Change | Medium | Additive only. Existing API remains unchanged. |
| **Micro Schedule** | Medium - New Query Patterns | Low | Read-only access from Progress. |
| **Planning (Ledger)** | Low - Referenced for Balance Calc | Low | No schema changes. |
| **BOQ** | None | None | - |

### Backward Compatibility Strategy

1. **Existing API Preserved**: `POST /progress/update` remains unchanged.
2. **New API**: `GET /execution/breakdown` (additive).
3. **Frontend**: New modal component. Existing "Quick Update" remains.
4. **Data**: Zero schema changes to existing `SiteProgress` table.

---

## Phase 1: Backend Foundation (Days 1-3)

### Task 1.1: Create Execution Breakdown Service
**File:** `backend/src/execution/execution-breakdown.service.ts`

**Responsibilities:**
- Fetch `MicroQuantityLedger` for Activity-BOQ pairs.
- Fetch `MicroScheduleActivity` list for target Activity.
- Compute `Balance Qty = Ledger.Total - Ledger.Allocated`.
- Return unified list with types: `MICRO` | `BALANCE`.

**Pseudo Logic:**
```typescript
async getBreakdown(activityId: number, epsNodeId: number) {
  // 1. Get Ledger Status
  const ledgers = await microLedgerService.getLedgerStatus(activityId);
  
  // 2. Get Micro Activities
  const microActivities = await microActivityRepo.find({
    where: { microSchedule: { parentActivityId: activityId }, epsNodeId }
  });
  
  // 3. Build Response
  return ledgers.map(ledger => ({
    boqItem: ledger.boqItem,
    scope: {
      total: ledger.totalParentQty,
      allocated: ledger.allocatedQty,
      balance: ledger.balanceQty
    },
    items: [
      ...microActivities.filter(ma => ma.boqItemId === ledger.boqItemId).map(ma => ({
        type: 'MICRO',
        id: ma.id,
        name: ma.activityName,
        allocatedQty: ma.allocatedQty,
        executedQty: await getDailyLogSum(ma.id)
      })),
      {
        type: 'BALANCE',
        id: null,
        name: 'Direct Execution (Non-Micro)',
        allocatedQty: ledger.balanceQty,
        executedQty: await getDirectProgressSum(activityId, ledger.boqItemId, epsNodeId)
      }
    ]
  }));
}
```

**Dependencies:**
- `MicroLedgerService` (exists)
- `MicroScheduleActivity` entity (exists)
- `MicroDailyLog` entity (exists)
- `SiteProgress` entity (exists)

**Verification:**
```bash
# Test API manually
curl GET /execution/breakdown?activityId=4&epsNodeId=10
# Expected: JSON with scope + items array
```

---

### Task 1.2: Create Execution Breakdown Controller
**File:** `backend/src/execution/execution.controller.ts`

**Route:** `GET /execution/breakdown`

**Query Params:**
- `activityId` (required)
- `epsNodeId` (required)

**Response:**
```json
{
  "activityId": 4,
  "epsNodeId": 10,
  "boqBreakdown": [
    {
      "boqItem": { "id": 25, "itemCode": "ABC-100", "description": "M25 Concrete", "uom": "Cum" },
      "scope": {
        "total": 100,
        "allocated": 60,
        "balance": 40
      },
      "items": [
        {
          "type": "MICRO",
          "id": 101,
          "name": "Rebar Fixing - 1st Floor",
          "allocatedQty": 30,
          "executedQty": 10,
          "balanceQty": 20
        },
        {
          "type": "MICRO",
          "id": 102,
          "name": "Shuttering - 1st Floor",
          "allocatedQty": 30,
          "executedQty": 5,
          "balanceQty": 25
        },
        {
          "type": "BALANCE",
          "id": null,
          "name": "Direct Execution (Non-Micro)",
          "allocatedQty": 40,
          "executedQty": 0,
          "balanceQty": 40
        }
      ]
    }
  ]
}
```

**Verification:**
- Call endpoint with test data.
- Verify totals match ledger.

---

### Task 1.3: Progress Logging Logic Update
**File:** `backend/src/execution/site-progress.service.ts`

**New Field:** Add `microActivityId` (nullable) to `SiteProgress` entity.

**Migration:**
```sql
ALTER TABLE site_progress 
ADD COLUMN microActivityId INTEGER NULL,
ADD FOREIGN KEY (microActivityId) REFERENCES micro_schedule_activity(id);
```

**Logic:**
- If `microActivityId` is provided, validate against `MicroActivityLedger`.
- If `microActivityId` is NULL, treat as "Direct/Balance" execution.
- Auto-rollup to Master Activity status.

**Verification:**
- Insert test progress records.
- Verify constraint: `Sum(Progress) <= Scope`.

---

## Phase 2: Frontend UI (Days 4-6)

### Task 2.1: Create Execution Breakdown Modal
**File:** `frontend/src/components/execution/ExecutionBreakdownModal.tsx`

**Props:**
- `activityId: number`
- `epsNodeId: number`
- `onClose: () => void`

**UI Design:**
```
┌─────────────────────────────────────────────────────┐
│ Progress Entry: Aluminium Typical - 1st Floor      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ BOQ ITEM: M25 Concrete (ABC-100)                   │
│ Total Scope: 100.00 Cum                            │
│ Allocated (Micro): 60.00 Cum                       │
│ Balance (Direct): 40.00 Cum                        │
│                                                     │
├─────────────────────────────────────────────────────┤
│ TASK NAME               | SCOPE | DONE | BALANCE   │
├─────────────────────────────────────────────────────┤
│ 🔹 Rebar Fixing         | 30.00 | 10.00 | 20.00    │  [+ Log Progress]
│ 🔹 Shuttering           | 30.00 |  5.00 | 25.00    │  [+ Log Progress]
│ 🔸 Direct Execution     | 40.00 |  0.00 | 40.00    │  [+ Log Progress]
└─────────────────────────────────────────────────────┘
```

**Interaction:**
- Click `[+ Log Progress]` → Opens inline input.
- Enter quantity → Validate `<= Balance`.
- Submit → Call `POST /execution/progress`.

**State Management:**
```typescript
const [breakdown, setBreakdown] = useState<ExecutionBreakdown | null>(null);
const [selectedItem, setSelectedItem] = useState<BreakdownItem | null>(null);

useEffect(() => {
  fetchBreakdown(activityId, epsNodeId);
}, [activityId, epsNodeId]);
```

**Verification:**
- Load modal with test data.
- Verify all items display correctly.
- Test validation (over-quantity).

---

### Task 2.2: Integrate with Progress View
**File:** `frontend/src/views/progress/ProgressUpdateView.tsx`

**Change:**
- Detect if Activity has Micro Schedule.
- If YES → Open `ExecutionBreakdownModal`.
- If NO → Use existing "Quick Update" flow.

**Detection Logic:**
```typescript
const hasMicroSchedule = await checkMicroSchedule(activityId);
if (hasMicroSchedule) {
  setShowBreakdownModal(true);
} else {
  setShowQuickUpdate(true);
}
```

**Verification:**
- Click Activity with Micro Schedule → Breakdown modal opens.
- Click Activity without Micro Schedule → Quick update opens.

---

### Task 2.3: Progress Entry Form Enhancement
**File:** `frontend/src/components/execution/ProgressEntryForm.tsx`

**New Props:**
- `microActivityId?: number`
- `maxQty: number` (for validation)

**Submission:**
```typescript
const submitProgress = async () => {
  await progressService.logProgress({
    activityId,
    epsNodeId,
    boqItemId,
    microActivityId, // NEW: nullable
    quantity,
    date,
    remarks
  });
};
```

**Verification:**
- Submit progress for Micro Activity.
- Submit progress for Balance item.
- Verify backend logs correctly.

---

## Phase 3: Data Integrity & Rollup (Days 7-8)

### Task 3.1: Progress Rollup to Master
**File:** `backend/src/execution/rollup.service.ts`

**Logic:**
- After any progress update (Micro or Direct), recalculate Master Activity %.
- Formula: `Master % = Sum(All Progress) / Master.TotalScope * 100`.

**Trigger:** After `POST /execution/progress` completes.

**Verification:**
- Log 10 Cum progress on Micro Activity.
- Check Master Activity % updated.

---

### Task 3.2: Quantity Constraint Enforcement
**File:** `backend/src/execution/site-progress.service.ts`

**Validation:**
```typescript
async validateProgress(dto: CreateProgressDto) {
  if (dto.microActivityId) {
    // Validate against Micro Activity allocation
    const activity = await microActivityRepo.findOne(dto.microActivityId);
    const executed = await dailyLogRepo.sum({ microActivityId: dto.microActivityId });
    if (executed + dto.quantity > activity.allocatedQty) {
      throw new BadRequestException('Exceeds micro activity scope');
    }
  } else {
    // Validate against Balance
    const ledger = await microLedgerService.getLedger(dto.activityId, dto.boqItemId);
    const directExecuted = await siteProgressRepo.sum({ 
      activityId: dto.activityId, 
      boqItemId: dto.boqItemId,
      microActivityId: IsNull()
    });
    if (directExecuted + dto.quantity > ledger.balanceQty) {
      throw new BadRequestException('Exceeds direct execution quota');
    }
  }
}
```

**Verification:**
- Try over-logging → Should fail.
- Log within limit → Should succeed.

---

## Phase 4: Testing & Validation (Days 9-10)

### Task 4.1: Unit Tests
**Files:**
- `backend/src/execution/execution-breakdown.service.spec.ts`
- `backend/src/execution/site-progress.service.spec.ts`

**Test Cases:**
1. Breakdown calculation correctness.
2. Balance quantity accuracy.
3. Over-quantity rejection.
4. Rollup calculation.

---

### Task 4.2: Integration Tests
**File:** `backend/test/execution-integration.spec.ts`

**Scenarios:**
1. E2E: Create Micro Activity → Log Progress → Verify Rollup.
2. E2E: Log Direct Progress → Verify Balance deduction.
3. E2E: Mixed (Micro + Direct) → Verify total consistency.

---

### Task 4.3: Manual QA Checklist
- [ ] Open Progress screen for activity with Micro Schedule.
- [ ] Verify breakdown modal displays correctly.
- [ ] Log progress on Micro Activity.
- [ ] Verify Master Activity % updated.
- [ ] Log progress on Balance item.
- [ ] Verify total scope constraint enforced.
- [ ] Open Progress screen for activity WITHOUT Micro Schedule.
- [ ] Verify old "Quick Update" flow still works.

---

## Phase 5: Deployment & Monitoring (Day 11)

### Task 5.1: Database Migration
**Run:**
```bash
cd backend
npm run migration:generate -- AddMicroActivityIdToSiteProgress
npm run migration:run
```

**Rollback Plan:**
```bash
npm run migration:revert
```

---

### Task 5.2: Feature Flag
**Config:** `backend/src/config/features.config.ts`

```typescript
export const FEATURES = {
  MICRO_PROGRESS_ENABLED: process.env.ENABLE_MICRO_PROGRESS === 'true'
};
```

**Usage:**
```typescript
if (FEATURES.MICRO_PROGRESS_ENABLED) {
  return await getBreakdown(...);
} else {
  return await getLegacyProgress(...);
}
```

---

### Task 5.3: Monitoring
**Metrics to Track:**
- API Response Time: `/execution/breakdown`
- Error Rate: Progress submission failures
- Usage: % of Progress via Micro vs Direct

**Tools:** Application Insights / Custom Logging

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Data Inconsistency** | Medium | High | Implement strict validation + transaction rollback |
| **Performance Degradation** | Low | Medium | Add indexes on `microActivityId`, `epsNodeId` |
| **User Confusion** | Medium | Low | Provide in-app tutorial + training session |
| **Breaking Existing Flow** | Low | High | Extensive regression testing + feature flag |

---

## Success Criteria

- [ ] Site Engineers can log progress against Micro Activities.
- [ ] Balance (Direct) execution is automatically computed and displayed.
- [ ] No progress over-reporting (enforced by backend).
- [ ] Master Activity % auto-updates from Micro logs.
- [ ] Existing "Master Only" flow remains functional.
- [ ] Zero breaking changes to current Progress API.
- [ ] Performance: Breakdown API responds < 500ms.

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Backend | 3 days | None |
| Phase 2: Frontend | 3 days | Phase 1 complete |
| Phase 3: Rollup | 2 days | Phase 1, 2 complete |
| Phase 4: Testing | 2 days | Phase 1-3 complete |
| Phase 5: Deployment | 1 day | All phases complete |
| **Total** | **11 days** | - |

---

## Next Steps

1. **Review Plan:** Get stakeholder approval.
2. **Start Phase 1:** Create `ExecutionBreakdownService`.
3. **Daily Standups:** Track progress against plan.
4. **Iterate:** Adjust based on findings during implementation.

---

**Document Owner:** AI Assistant  
**Last Updated:** 2026-02-18
