# Quality & EHS Flutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all missing Quality (Pour Card, Pre-Pour Clearance, Snag) and EHS (Dashboard, Performance, Manhours, Training, Legal, Machinery, Vehicles) features in Flutter, matching web app permissions and workflow exactly.

**Architecture:** Each sub-module follows the established BLoC pattern (Events → Handler → State), offline-first with SyncService queuing, permission-gated via PermissionService.of(context). New models extend Equatable with fromJson/copyWith. New pages use BlocConsumer with snackbar listener + builder UI.

**Tech Stack:** Flutter/Dart, flutter_bloc, equatable, dio (via SetuApiClient), open_file, path_provider, intl, shimmer

---

## PHASE 1: API Endpoints + Client Methods (all new endpoints)

### Task 1: Add all new API endpoints to api_endpoints.dart
- [ ] Add pour card endpoints (6 routes)
- [ ] Add pre-pour clearance endpoints (6 routes)
- [ ] Add snag endpoints (4 routes)
- [ ] Add EHS sub-module endpoints (manhours, training, legal, machinery, vehicles, performance, summary)

### Task 2: Add all new API client methods to setu_api_client.dart
- [ ] Pour card: get, save, submit, approve, reject, downloadPdf
- [ ] Clearance card: get, save, submit, approve, reject, downloadPdf
- [ ] Snags: list, create, update, delete
- [ ] EHS: getSummary, getPerformance, getManhours, saveManhours, getTraining, createTraining, getLegal, createLegal, updateLegal, getMachinery, createMachinery, getVehicles, createVehicle

---

## PHASE 2: Pour Card

### Task 3: Pour card models
- [ ] Add QualityCardStatus enum, QualityPourCard, PourCardEntry to quality_models.dart

### Task 4: PourCardBloc
- [ ] Create flutter/lib/features/quality/presentation/bloc/pour_card_bloc.dart
- [ ] Events: LoadPourCard, SavePourCard, SubmitPourCard, ApprovePourCard, RejectPourCard, AddPourEntry, RemovePourEntry
- [ ] States: PourCardInitial, PourCardLoading, PourCardLoaded, PourCardSaving, PourCardActionSuccess, PourCardError

### Task 5: PourCardPage
- [ ] Create flutter/lib/features/quality/presentation/pages/pour_card_page.dart
- [ ] Header with status banner
- [ ] Concrete info form section
- [ ] Dynamic entries table (add/remove rows)
- [ ] Save Draft / Submit / Approve / Reject buttons (permission-gated)

### Task 6: Wire pour card into InspectionDetailPage
- [ ] Add "Pour Card" action button when inspection.activity.requiresPourCard == true
- [ ] Navigate to PourCardPage with inspectionId

---

## PHASE 3: Pre-Pour Clearance Card

### Task 7: Clearance card models
- [ ] Add QualityPrePourClearanceCard, ClearanceSignoff, ClearanceAttachments to quality_models.dart

### Task 8: ClearanceCardBloc
- [ ] Create flutter/lib/features/quality/presentation/bloc/clearance_card_bloc.dart
- [ ] Events: LoadClearanceCard, SaveClearanceCard, SubmitClearanceCard, ApproveClearanceCard, RejectClearanceCard, AddSignoff, UpdateSignoff, MarkSignoffSigned, MarkSignoffWaived, RemoveSignoff, UpdateAttachment
- [ ] States: ClearanceCardInitial, ClearanceCardLoading, ClearanceCardLoaded, ClearanceCardSaving, ClearanceCardActionSuccess, ClearanceCardError

### Task 9: PrePourClearancePage
- [ ] Create flutter/lib/features/quality/presentation/pages/pre_pour_clearance_page.dart
- [ ] Activation banner (locked until trigger stage approved)
- [ ] Concrete info form
- [ ] 7 attachment YES/NO/NA selectors
- [ ] Signatories panel (add/mark-signed/waive/remove)
- [ ] Save / Submit / Approve / Reject buttons

### Task 10: Wire clearance into InspectionDetailPage
- [ ] Add "Pre-Pour Clearance" button when requiresPourClearanceCard == true

---

## PHASE 4: Snag Management

### Task 11: Snag models
- [ ] Add SnagStatus enum, QualitySnag model to quality_models.dart

### Task 12: SnagBloc
- [ ] Create flutter/lib/features/quality/presentation/bloc/snag_bloc.dart
- [ ] Events: LoadSnags, CreateSnag, UpdateSnagStatus, DeleteSnag
- [ ] States: SnagInitial, SnagLoading, SnagLoaded, SnagActionSuccess, SnagError

### Task 13: SnagListPage + SnagDetailPage
- [ ] Create flutter/lib/features/quality/presentation/pages/snag_list_page.dart (list with Open/Rectified/Verified tabs)
- [ ] Create flutter/lib/features/quality/presentation/pages/snag_detail_page.dart (detail + status actions)
- [ ] Add "Snag List" tile to project dashboard

---

## PHASE 5: EHS Hub Dashboard

### Task 14: EHS Dashboard models
- [ ] Create flutter/lib/features/ehs/data/models/ehs_dashboard_models.dart
- [ ] EhsSummary, EhsPerformanceData, EhsManhoursRecord, EhsTrainingRecord, EhsLegalItem, EhsMachineryRecord, EhsVehicleRecord

### Task 15: EhsDashboardBloc
- [ ] Create flutter/lib/features/ehs/presentation/bloc/ehs_dashboard_bloc.dart
- [ ] Events: LoadEhsDashboard
- [ ] States: EhsDashboardLoading, EhsDashboardLoaded, EhsDashboardError

### Task 16: EhsHubPage (tabbed hub)
- [ ] Create flutter/lib/features/ehs/presentation/pages/ehs_hub_page.dart
- [ ] Tabs: Overview, Performance, Manhours, Training, Legal, Machinery, Vehicles
- [ ] Each tab as a separate StatelessWidget section
- [ ] Replace direct navigation to site-obs/incidents with hub

---

## PHASE 6: EHS Sub-module Pages

### Task 17: EHS Overview tab
- [ ] KPI summary cards (incident count, near-miss, training %, legal compliance %)
- [ ] Load from GET /ehs/:projectId/summary

### Task 18: EHS Performance tab
- [ ] TRIFR, near-miss rate, incident trend
- [ ] Load from GET /ehs/:projectId/performance

### Task 19: EHS Manhours tab
- [ ] Monthly manhours table + TBM records
- [ ] Load from GET /ehs/:projectId/manhours
- [ ] Create form (POST)

### Task 20: EHS Training tab
- [ ] Training record list (induction, skills, certs)
- [ ] Load from GET /ehs/:projectId/training
- [ ] Create form (POST)

### Task 21: EHS Legal Compliance tab
- [ ] Compliance register with expiry alerts
- [ ] Load from GET /ehs/:projectId/legal
- [ ] Create/update forms

### Task 22: EHS Machinery tab
- [ ] Machinery inspection log
- [ ] Load from GET /ehs/:projectId/machinery
- [ ] Create form (POST)

### Task 23: EHS Vehicles tab
- [ ] Vehicle movement log
- [ ] Load from GET /ehs/:projectId/vehicles
- [ ] Create form (POST)

### Task 24: Wire EHS Hub into project dashboard
- [ ] Replace existing EHS observations tile with EHS Hub tile
- [ ] Keep direct Incidents tile

---
