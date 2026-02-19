# Micro Schedule Module - Implementation Plan

**Status**: 🚧 In Progress  
**Started**: 2026-02-10  
**Target Completion**: Phase 1 by 2026-03-10

---

## 📋 Overview

Implementing a **Micro Schedule Module** - a quantity-driven lookahead planning and execution control system that bridges the gap between master schedule and daily execution.

**Architecture Position:**
```
EPS → Master Schedule → Micro Schedule → Daily Execution → Analytics
```

---

## 🎯 Phase 1: Core Foundation (Weeks 1-4)

### Database Schema

#### 1. `micro_schedule` Entity
```typescript
- id: number (PK)
- projectId: number (FK)
- parentActivityId: number (FK → Activity)
- name: string
- description: text
- version: number (default: 1)
- baselineStart: date
- baselineFinish: date
- plannedStart: date
- plannedFinish: date
- forecastFinish: date (nullable)
- actualStart: date (nullable)
- actualFinish: date (nullable)
- status: enum (DRAFT, SUBMITTED, APPROVED, ACTIVE, SUSPENDED, COMPLETED, ARCHIVED)
- overshootFlag: boolean (default: false)
- overshootDays: number (default: 0)
- totalAllocatedQty: decimal(12,3) (default: 0)
- totalActualQty: decimal(12,3) (default: 0)
- createdBy: number (FK → User)
- approvedBy: number (FK → User, nullable)
- approvedAt: timestamp (nullable)
- createdAt: timestamp
- updatedAt: timestamp
```

#### 2. `micro_schedule_activity` Entity
```typescript
- id: number (PK)
- microScheduleId: number (FK → MicroSchedule)
- parentActivityId: number (FK → Activity)
- boqItemId: number (FK → BoqItem, nullable)
- workOrderId: number (FK → WorkOrder, nullable)
- epsNodeId: number (FK → EpsNode)
- name: string
- description: text
- allocatedQty: decimal(12,3)
- uom: string
- plannedStart: date
- plannedFinish: date
- forecastFinish: date (nullable)
- actualStart: date (nullable)
- actualFinish: date (nullable)
- progressPercent: decimal(5,2) (default: 0)
- varianceDays: number (default: 0)
- status: enum (PLANNED, IN_PROGRESS, DELAYED, COMPLETED, CANCELLED)
- createdAt: timestamp
- updatedAt: timestamp
```

#### 3. `micro_quantity_ledger` Entity
```typescript
- id: number (PK)
- parentActivityId: number (FK → Activity)
- workOrderId: number (FK → WorkOrder, nullable)
- boqItemId: number (FK → BoqItem)
- totalParentQty: decimal(12,3)
- allocatedQty: decimal(12,3) (sum of all micro activities)
- consumedQty: decimal(12,3) (sum of all daily logs)
- balanceQty: decimal(12,3) (computed: totalParentQty - allocatedQty)
- uom: string
- lastReconciled: timestamp
- createdAt: timestamp
- updatedAt: timestamp
```

#### 4. `micro_daily_log` Entity
```typescript
- id: number (PK)
- microActivityId: number (FK → MicroScheduleActivity)
- logDate: date
- qtyDone: decimal(12,3)
- manpowerCount: number (default: 0)
- equipmentHours: decimal(8,2) (default: 0)
- delayReasonId: number (FK → DelayReason, nullable)
- remarks: text (nullable)
- createdBy: number (FK → User)
- createdAt: timestamp
- updatedAt: timestamp
```

#### 5. `delay_reason` Entity (Reference)
```typescript
- id: number (PK)
- code: string (unique)
- name: string
- category: enum (WEATHER, MATERIAL, MANPOWER, EQUIPMENT, DESIGN, CLIENT, OTHER)
- isActive: boolean (default: true)
```

---

### Backend Implementation Tasks

#### ✅ Task 1.1: Create Entities
- [ ] Create `micro-schedule/entities/micro-schedule.entity.ts`
- [ ] Create `micro-schedule/entities/micro-schedule-activity.entity.ts`
- [ ] Create `micro-schedule/entities/micro-quantity-ledger.entity.ts`
- [ ] Create `micro-schedule/entities/micro-daily-log.entity.ts`
- [ ] Create `micro-schedule/entities/delay-reason.entity.ts`
- [ ] Add relationships to existing entities (Activity, BOQ, WorkOrder)

#### ✅ Task 1.2: Create DTOs
- [ ] `create-micro-schedule.dto.ts`
- [ ] `update-micro-schedule.dto.ts`
- [ ] `create-micro-activity.dto.ts`
- [ ] `create-daily-log.dto.ts`
- [ ] `quantity-allocation.dto.ts`

#### ✅ Task 1.3: Create Services
- [ ] `micro-schedule.service.ts` - CRUD + business logic
- [ ] `micro-ledger.service.ts` - Quantity validation & reconciliation
- [ ] `micro-activity.service.ts` - Activity management
- [ ] `micro-daily-log.service.ts` - Daily logging

#### ✅ Task 1.4: Create Controller
- [ ] `micro-schedule.controller.ts` with endpoints:
  - `POST /micro-schedules` - Create
  - `GET /micro-schedules/:id` - Get by ID
  - `GET /projects/:projectId/micro-schedules` - List by project
  - `PATCH /micro-schedules/:id` - Update
  - `DELETE /micro-schedules/:id` - Soft delete
  - `POST /micro-schedules/:id/activities` - Add activity
  - `POST /micro-activities/:id/logs` - Add daily log
  - `GET /micro-schedules/:id/ledger` - Get quantity ledger

#### ✅ Task 1.5: Validation Logic
- [ ] Quantity allocation validation (sum ≤ parent qty)
- [ ] Date range validation (within parent activity dates)
- [ ] UOM consistency check
- [ ] Prevent duplicate allocations
- [ ] Status transition rules

#### ✅ Task 1.6: Module Setup
- [ ] Create `micro-schedule.module.ts`
- [ ] Register in `app.module.ts`
- [ ] Add to TypeORM entities array

---

### Frontend Implementation Tasks

#### ✅ Task 2.1: Service Layer
- [ ] Create `frontend/src/services/micro-schedule.service.ts`
- [ ] API methods for all CRUD operations
- [ ] TypeScript interfaces matching backend DTOs

#### ✅ Task 2.2: Core Components
- [ ] `MicroScheduleList.tsx` - List view with filters
- [ ] `MicroScheduleForm.tsx` - Create/Edit modal
- [ ] `MicroActivityBreakdown.tsx` - Activity allocation UI
- [ ] `QuantityAllocationWidget.tsx` - Visual qty distribution

#### ✅ Task 2.3: Routing
- [ ] Add route `/projects/:projectId/micro-schedules`
- [ ] Add route `/projects/:projectId/micro-schedules/:id`
- [ ] Update navigation menu

---

## 🎯 Phase 2: Execution Layer (Weeks 5-8)

### Tasks

#### ✅ Task 3.1: Daily Logging UI
- [ ] `DailyLogEntry.tsx` - Mobile-friendly form
- [ ] `DailyLogCalendar.tsx` - Calendar view
- [ ] `ActivityProgressCard.tsx` - Progress visualization

#### ✅ Task 3.2: Progress Calculation
- [ ] Auto-calculate progress % on log entry
- [ ] Update micro activity status
- [ ] Trigger ledger reconciliation

#### ✅ Task 3.3: Basic Dashboard
- [ ] `MicroScheduleDashboard.tsx`
- [ ] Today's activities widget
- [ ] Progress summary
- [ ] Quantity consumption chart

---

## 🎯 Phase 3: Forecasting (Weeks 9-10)

### Tasks

#### ✅ Task 4.1: Forecast Engine
- [ ] `micro-forecast.service.ts`
- [ ] Calculate average daily productivity
- [ ] Compute forecast finish date
- [ ] Detect overshoot (forecast > parent finish)

#### ✅ Task 4.2: Alert System
- [ ] Overshoot detection
- [ ] Delay warnings
- [ ] Quantity over-allocation alerts

---

## 📊 Success Metrics

- [ ] Can create micro schedule from parent activity
- [ ] Quantity allocation prevents overshoot
- [ ] Daily logs update progress automatically
- [ ] Ledger reconciles correctly
- [ ] Forecast finish calculated accurately
- [ ] Overshoot flag triggers when forecast > parent

---

## 🔗 Integration Points

### Existing Entities to Link
1. **Activity** (from Planning module)
   - Add `microSchedules` relation
2. **BoqItem** (from BOQ module)
   - Reference for quantity validation
3. **WorkOrder** (from WorkDoc module)
   - Link vendor commitments
4. **EpsNode** (from EPS module)
   - Location-based breakdown

---

## 🚨 Critical Decisions

### 1. Quantity Allocation Strategy
**Decision**: Hard validation (sum must equal parent qty)
**Rationale**: Prevents data integrity issues, forces conscious planning

### 2. Overshoot Definition
**Decision**: `forecastFinish > parentActivity.endDate`
**Rationale**: Based on realistic forecast, not just planned dates

### 3. Status Lifecycle
**Decision**: DRAFT → SUBMITTED → APPROVED → ACTIVE → COMPLETED
**Rationale**: Enforces review before execution

---

## 📝 Notes

- All timestamps in UTC
- Soft deletes for audit trail
- Quantity precision: 3 decimal places
- Progress precision: 2 decimal places
- All financial calculations use Decimal type

---

## 🔄 Next Actions

1. ✅ Create implementation plan (this file)
2. ⏳ Create database entities
3. ⏳ Implement core services
4. ⏳ Build API endpoints
5. ⏳ Create frontend service layer
6. ⏳ Build UI components

---

**Last Updated**: 2026-02-10 23:17 IST
