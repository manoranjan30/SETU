# Flutter Module Documentation Plan

**Target:** `flutter/DEVELOPER_DOCUMENTATION.md` (currently 1,286 lines, last substantively updated well before several modules below existed)
**App version at time of audit:** 1.0.1+25
**Scope:** Documentation only — no code changes. Flutter-side, per [[feedback_flutter_backend_separation]] this plan does not touch backend workflow/business logic, only describes what the mobile app already does.

---

## 1. Why this plan exists

`DEVELOPER_DOCUMENTATION.md` §5 "Feature Modules" covers 9 sub-sections (5.1–5.9): Auth, Projects/EPS, Progress Entry, Quality Inspections (RFI), Quality Site Observations, EHS Observations, EHS Incidents, Labor Register, Profile.

A file-level audit of `flutter/lib/features/` and `flutter/lib/core/` (2026-07-20) found the codebase has grown well past that list:

- **3 entire feature modules are undocumented**: `design/`, `planning/`, `tower_lens/`
- **`server_setup/`** (QR-based server onboarding) is undocumented
- **`quality/`** has ~9 sub-workflows beyond RFI/Site-Obs that aren't covered: Pour Card, Pre-Pour Clearance, Cube Register, NCR Register, Snag/Desnag, Materials Testing, QR Signature capture, Quality Dashboard, Block Tower/Floor navigation
- **4 `core/` subsystems** added since the last pass aren't in §4: `navigation/`, `config/`, `update/`, `widgets/`
- §13 "Known Issues & Technical Debt" is stale — e.g. it says token refresh is stubbed; needs re-verification against current `token_manager.dart`
- §8 (API Reference) and §9 (DB Schema) predate all of the above and will be missing endpoints/tables

This plan sequences the work to close those gaps without one unreviewable mega-edit.

---

## 2. Documentation template (apply to every module below)

To match the existing §5 style, each module write-up should include, only where applicable:

1. **BLoC(s)/Cubit(s)** — name + one-line responsibility
2. **Pages** — list with one-line purpose each
3. **Lifecycle/workflow** — state diagram in the `A → B → C` prose-arrow style already used for RFI (§5.4) and Progress Entry (§5.3)
4. **Key business rules** — table format where there's a decision matrix (see RFI's Activity Display Status table)
5. **Data models** — only non-obvious fields/enums, not a full schema dump
6. **Offline/sync behavior** — does it queue writes? optimistic UI? what SyncQueue operation type?
7. **Permissions** — which `PermissionService` getters gate it
8. **Known gaps** — anything half-built, stubbed, or with a TODO in code

Keep each module to roughly the depth of existing §5.4 (Quality Inspections) — that section is the calibration reference, not a floor to exceed.

---

## 3. Module-by-module plan

### Phase 1 — Quality: Pour Card Gate (matches current WIP)

The IDE currently has `.module_Plans/POUR_CARD_GATE_MOBILE_HANDOFF.md` open and `inspection_detail_page.dart` / `floor_activity_dashboard_page.dart` are in the uncommitted diff — do this phase first while context is warm.

| New §5.x | Module | Files |
|---|---|---|
| 5.10 | Pour Card | `quality/presentation/bloc/pour_card_bloc.dart`, `quality/presentation/pages/pour_card_page.dart` |
| 5.11 | Pre-Pour Clearance | `quality/presentation/bloc/clearance_card_bloc.dart`, `quality/presentation/pages/pre_pour_clearance_page.dart` |
| 5.12 | QR Signature Capture | `quality/presentation/pages/qr_signature_confirmation_page.dart`, `quality/presentation/pages/signature_qr_scanner_page.dart`, `quality/presentation/widgets/signature_approval_sheet.dart` |

Cross-check against `POUR_CARD_GATE_MOBILE_HANDOFF.md` for the intended gate logic (pour card blocks activity progress until clearance signed) so the doc reflects intent vs. what's actually implemented — flag any divergence as a known gap rather than silently documenting the handoff spec.

### Phase 2 — Quality: remaining sub-workflows

| New §5.x | Module | Files |
|---|---|---|
| 5.13 | Cube Register | `quality/data/models/cube_register_models.dart`, `quality/presentation/bloc/cube_register_bloc.dart`, `quality/presentation/pages/cube_register_page.dart` |
| 5.14 | NCR Register | `quality/data/models/ncr_register_item.dart`, `quality/presentation/pages/nc_register_page.dart` |
| 5.15 | Snag / Desnag | `quality/presentation/bloc/snag_bloc.dart`, `quality/presentation/pages/snag_list_page.dart`, `quality/presentation/pages/snag_detail_page.dart` |
| 5.16 | Materials Testing | `quality/presentation/pages/materials_testing_page.dart` |
| 5.17 | Quality Dashboard | `quality/data/models/dashboard_models.dart`, `quality/presentation/bloc/quality_dashboard_bloc.dart`, `quality/presentation/pages/quality_dashboard_page.dart` |
| — (fold into 5.2) | Block/Tower/Floor nav | `quality/presentation/pages/block_towers_page.dart`, `quality/presentation/pages/block_floors_page.dart` |

Update `observation_rating.dart` / `rfi_attachment*.dart` model notes under 5.4 if the RFI attachment flow changed since last write-up (`rfi_attachment_draft.dart` looks like newer local-draft-before-upload machinery worth a callout).

### Phase 3 — Planning module (entirely new, 8 sub-features)

| New §5.x | Module | Files |
|---|---|---|
| 5.18 | Planning Hub | `planning/presentation/pages/planning_hub_page.dart` |
| 5.19 | Issue Tracker | `planning/presentation/bloc/issue_tracker_bloc.dart`, `planning/presentation/pages/issue_tracker_page.dart`, `issue_detail_page.dart`, `widgets/raise_issue_sheet.dart` |
| 5.20 | Micro-Schedule | `planning/data/models/micro_schedule_models.dart`, `planning/presentation/bloc/micro_schedule_bloc.dart`, `planning/presentation/pages/micro_schedule_page.dart` (cross-ref §5.3 Progress Entry — micro-schedule vendor breakdown was previously mentioned there) |
| 5.21 | Schedule Viewer | `planning/presentation/bloc/schedule_viewer_bloc.dart`, `planning/presentation/pages/schedule_viewer_page.dart` |
| 5.22 | WO Schedule | `planning/presentation/pages/wo_schedule_page.dart` (in current uncommitted diff — verify doc matches latest edit) |
| 5.23 | Site Journal / Daily Log | `planning/presentation/pages/site_journal_page.dart`, `widgets/daily_log_sheet.dart` |
| 5.24 | Task Manager | `planning/presentation/pages/task_manager_page.dart`, `widgets/create_task_sheet.dart`, `widgets/assignee_picker.dart` |
| 5.25 | Followup Register | `planning/presentation/pages/followup_register_page.dart` |
| — | Phase2 model/bloc | `planning/data/models/phase2_models.dart`, `planning/presentation/bloc/planning_phase2_bloc.dart` — figure out which page(s) this backs before writing; may be shared infra for several pages above rather than its own section |

Reference `.module_Plans/PLANNING_PHASE2_MOBILE_HANDOFF.md` and `ISSUE_TRACKER_ENHANCED_PLAN.md` for original intent vs. shipped behavior.

### Phase 4 — Design, Tower Lens, EHS Dashboard, Server Setup

| New §5.x | Module | Files |
|---|---|---|
| 5.26 | Design Register | `design/data/models/design_models.dart`, `design/presentation/bloc/design_bloc.dart`, `design/presentation/pages/design_register_page.dart` |
| 5.27 | Tower Lens (3D/isometric progress viz) | `tower_lens/data/models/*.dart`, `tower_lens/data/repositories/tower_progress_repository.dart`, `tower_lens/presentation/bloc/tower_lens_bloc.dart`, `tower_lens/presentation/pages/tower_lens_page.dart`, widgets (`isometric_building_painter.dart`, `project_site_map.dart`, `floor_detail_sheet.dart`, `floor_legend_bar.dart`, `tower_mini_card.dart`, `view_mode_switcher.dart`) — cross-ref `.module_Plans/3D_TOWER_PROGRESS_VISUALIZATION_PLAN.md` |
| 5.28 (fold into 5.6/5.7) | EHS Dashboard/Hub | `ehs/data/models/ehs_dashboard_models.dart`, `ehs/presentation/bloc/ehs_dashboard_bloc.dart`, `ehs/presentation/pages/ehs_hub_page.dart` |
| 5.29 | Server Setup (QR onboarding) | `server_setup/presentation/pages/server_setup_page.dart`, `qr_scanner_page.dart`, `core/config/server_config_service.dart`, `core/navigation/pending_qr_service.dart` — this is likely the first-run flow that lets a device scan a QR code to configure `SETU_BASE_URL` at runtime instead of `--dart-define`; verify and document as the actual onboarding path since it supersedes the env-var-only story in §11 |

### Phase 5 — Sync/Settings pages + newer Core subsystems

| Section | Item | Files |
|---|---|---|
| 5.30 | Sync Log page | `sync/presentation/pages/sync_log_page.dart` (feature-level UI; core engine already in §4.6) |
| 5.31 | Offline Data / Settings | `settings/offline_data_page.dart` |
| New §4.11 | Navigation & Deep Linking | `core/navigation/app_routes.dart`, `deep_link_service.dart`, `notification_navigator.dart`, `pending_qr_service.dart` — this looks like it has grown past the "Simple MaterialApp, no GoRouter" description in current §2/§10; verify and correct if a routing table now exists |
| New §4.12 | Runtime Server Config | `core/config/server_config_service.dart` — document how this interacts with (or replaces) the `--dart-define SETU_BASE_URL` story in §11 |
| New §4.13 | In-App Update | `core/update/app_update_service.dart`, `android_apk_downloader.dart`, `update_dialog_helper.dart` (in current uncommitted diff) |
| New §4.14 | Shared Widgets | `core/widgets/offline_banner.dart` |

### Phase 6 — Maintenance pass (do last, after Phases 1–5 reveal the real gaps)

1. **§13 Known Issues & Technical Debt** — re-verify each existing row against current code (token refresh, `getCacheDirectory`, EHS incident offline queueing, pagination, WorkManager frequency); add newly discovered gaps flagged during Phases 1–5
2. **§8 API Reference Summary** — add endpoints touched by every module in Phases 1–5 (grep `setu_api_client.dart` + `api_endpoints.dart` for methods with no current doc reference)
3. **§9 Database Schema** — add Drift tables for pour card/clearance, cube register, NCR, snag, design register, planning entities, tower lens cache if any
4. **§3 Folder Structure** — update the tree to include `design/`, `labor/`, `planning/`, `server_setup/`, `tower_lens/` and the 4 new `core/` folders (currently missing from the memory-derived tree, likely missing from the doc's own §3 too — verify)
5. **§10 Navigation & Routing** and **§2 Architecture** — reconcile against Phase 5 navigation findings
6. **Table of Contents** — renumber to match final section list
7. **Module grid cross-check** — `project_dashboard_page.dart` tile list (currently documented under §5.2) almost certainly needs new tiles for Planning, Design, Tower Lens; update that table
8. Bump the doc's own "last updated" marker / version reference to 1.0.1+25 (or whatever version ships when this lands)

---

## 4. Suggested execution order & sizing

Each phase is sized to fit one focused session without ballooning into an unreviewable diff:

1. Phase 1 (3 sections) — small, do first while Pour Card context is warm
2. Phase 2 (5 sections) — medium
3. Phase 3 (8 sections) — largest, consider splitting into 3a (Issue Tracker + Site Journal + Task Manager + Followup, the "field ops" cluster) and 3b (Micro-Schedule + Schedule Viewer + WO Schedule + Phase2, the "scheduling" cluster)
4. Phase 4 (4 sections) — medium, Tower Lens is the heaviest single item (6 widget files)
5. Phase 5 (6 sections) — mostly small, but Navigation needs careful verification since it may contradict existing §2/§10 claims
6. Phase 6 — cleanup/reconciliation pass, cannot start meaningfully before at least Phases 1–4 are done

## 5. Ground rules while executing

- Write only what's verifiable from the code being read that session — no speculative behavior descriptions (matches the calibration already used in §13's "Known Issues" table, which cites file:line for every claim)
- Where a `.module_Plans/*_HANDOFF.md` or `*_PLAN.md` exists for a module, treat it as *intent*, not *fact* — note explicitly if shipped behavior diverges
- Don't touch backend/API code to "fill in" documentation gaps — if a module's server-side behavior is unclear from the Flutter client alone, note it as an open question rather than guessing ([[feedback_flutter_backend_separation]])
- Keep new sections at the same prose-diagram + table depth as existing §5.3/§5.4 — avoid both over-terse stubs and full API-dump verbosity
