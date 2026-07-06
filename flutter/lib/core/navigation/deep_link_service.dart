import 'package:flutter/foundation.dart';

/// Encapsulates the navigation intent encoded inside a push notification payload.
class PendingDeepLink {
  final String type;
  final String? sourceType;   // QUALITY_CHECKLIST_OBSERVATION | QUALITY_SITE_OBSERVATION | EHS_SITE_OBSERVATION
  final int? projectId;
  final int? observationId;   // primary observation ID from payload
  final int? inspectionId;    // for checklist observations — opens InspectionDetailPage
  final int? epsNodeId;
  final int? activityId;
  final String? resourceId;   // kept for backward compat with older notification types

  const PendingDeepLink({
    required this.type,
    this.sourceType,
    this.projectId,
    this.observationId,
    this.inspectionId,
    this.epsNodeId,
    this.activityId,
    this.resourceId,
  });

  String? get targetModule {
    switch (type) {
      // ── New observation lifecycle types (from web handoff) ──────────────────
      case 'QUALITY_CHECKLIST_OBS_RAISED':
      case 'QUALITY_CHECKLIST_OBS_RECTIFIED':
      case 'QUALITY_CHECKLIST_OBS_RECTIFICATION_REJECTED':
      case 'QUALITY_CHECKLIST_OBS_CLOSED':
        return 'quality_approvals';

      case 'QUALITY_SITE_OBS_RECTIFIED':
      case 'QUALITY_SITE_OBS_RECTIFICATION_REJECTED':
      case 'QUALITY_SITE_OBS_CLOSED':
        return 'quality_site_obs';

      case 'EHS_OBS_RAISED':
      case 'EHS_OBS_RECTIFIED':
      case 'EHS_OBS_RECTIFICATION_REJECTED':
      case 'EHS_OBS_CLOSED':
        return 'ehs_site_obs';

      // ── Legacy observation types ─────────────────────────────────────────────
      case 'QUALITY_OBS_RAISED':
      case 'OBS_RECTIFIED':
      case 'OBS_CLOSED':
        return 'quality_site_obs';

      case 'EHS_OBS_CRITICAL':
        return 'ehs_site_obs';

      case 'EHS_INCIDENT_CREATED':
        return 'ehs_incidents';

      // ── RFI workflow ─────────────────────────────────────────────────────────
      case 'PENDING_APPROVAL':
      case 'STAGE_LEVEL_PENDING':
      case 'RFI_RAISED':
      case 'INSPECTION_APPROVED':
      case 'APPROVED':
      case 'RFI_APPROVED':
      case 'RFI_FULLY_APPROVED':
      case 'STAGE_APPROVED':
      case 'INSPECTION_REJECTED':
      case 'REJECTED':
      case 'RFI_WORKFLOW_REJECTED':
      case 'RFI_APPROVAL_REVERSED':
      case 'WORKFLOW_STEP_ASSIGNED':
      case 'WORKFLOW_DELEGATED':
      case 'WORKFLOW_REVERSED':
        return 'quality_approvals';

      // ── Progress ─────────────────────────────────────────────────────────────
      case 'PROGRESS_SUBMITTED':
      case 'PROGRESS_APPROVED':
      case 'PROGRESS_REJECTED':
        return 'progress_approvals';

      default:
        return null;
    }
  }

  /// What the UI should do upon opening the deep-linked record:
  ///   'rectify'  — open the rectification/fix flow (maker/site engineer)
  ///   'review'   — open the close/verify flow (checker/QC)
  ///   'readonly' — open read-only detail
  ///   null       — open the record normally (raised = standard view)
  String? get targetAction {
    switch (type) {
      case 'QUALITY_CHECKLIST_OBS_RECTIFIED':
      case 'QUALITY_SITE_OBS_RECTIFIED':
      case 'EHS_OBS_RECTIFIED':
      case 'OBS_RECTIFIED':
      case 'EHS_OBS_RECTIFICATION_REVIEWED':
        return 'review';

      case 'QUALITY_CHECKLIST_OBS_RECTIFICATION_REJECTED':
      case 'QUALITY_SITE_OBS_RECTIFICATION_REJECTED':
      case 'EHS_OBS_RECTIFICATION_REJECTED':
        return 'rectify';

      case 'QUALITY_CHECKLIST_OBS_CLOSED':
      case 'QUALITY_SITE_OBS_CLOSED':
      case 'EHS_OBS_CLOSED':
      case 'OBS_CLOSED':
        return 'readonly';

      default:
        return null;
    }
  }

  bool get hasDirectTarget => observationId != null || inspectionId != null;
}

/// Application-wide singleton that holds at most one pending notification
/// deep-link at a time.
class DeepLinkService {
  DeepLinkService._();
  static final DeepLinkService instance = DeepLinkService._();

  final ValueNotifier<PendingDeepLink?> notifier = ValueNotifier(null);

  void set(PendingDeepLink link) => notifier.value = link;

  PendingDeepLink? consume() {
    final link = notifier.value;
    notifier.value = null;
    return link;
  }
}
