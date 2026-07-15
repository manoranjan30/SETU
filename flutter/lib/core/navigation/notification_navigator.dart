import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/navigation/deep_link_service.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';
import 'package:setu_mobile/features/ehs/presentation/pages/ehs_site_obs_detail_page.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/pages/inspection_detail_page.dart';
import 'package:setu_mobile/features/quality/presentation/pages/quality_site_obs_detail_page.dart';
import 'package:setu_mobile/injection_container.dart';

/// Routes the user directly to a specific observation or inspection record
/// from a push notification tap, bypassing the module list entirely.
///
/// Flow:
///   1. Fetch the target record by ID from the API.
///   2. Push the appropriate detail page onto the navigator stack.
///   3. On any fetch error, fall back silently — the user is already on the
///      module list page (the targetModule routing still fires), so they just
///      need to tap the record manually rather than seeing a crash.
///
/// Called by [ProjectsListPage._onDeepLink] after the project navigation
/// settles, via [WidgetsBinding.addPostFrameCallback] to avoid pushing routes
/// during a build frame.
class NotificationNavigator {
  NotificationNavigator._();

  static Future<void> openFromDeepLink(
    BuildContext context,
    PendingDeepLink link,
    Project project,
  ) async {
    if (!link.hasDirectTarget) return;

    final inferredSource = _inferSourceType(link.type, link.sourceType);
    switch (inferredSource) {
      case 'QUALITY_CHECKLIST_OBSERVATION':
        await _openChecklistObservation(context, link, project);
        break;
      case 'RFI_WORKFLOW':
        await _openRfiInspection(context, link, project);
        break;
      case 'QUALITY_SITE_OBSERVATION':
        await _openQualitySiteObs(context, link, project);
        break;
      case 'EHS_SITE_OBSERVATION':
        await _openEhsSiteObs(context, link, project);
        break;
    }
  }

  // ── Checklist observation ─────────────────────────────────────────────────

  static Future<void> _openChecklistObservation(
    BuildContext context,
    PendingDeepLink link,
    Project project,
  ) async {
    if (link.inspectionId == null) return;
    try {
      final raw =
          await sl<SetuApiClient>().getQualityInspectionDetail(link.inspectionId!);
      final inspection = QualityInspection.fromJson(raw);
      if (!context.mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => BlocProvider(
            create: (_) => sl<QualityApprovalBloc>()
              ..add(LoadInspectionDetail(inspection)),
            child: InspectionDetailPage(
              inspection: inspection,
              highlightObservationId: link.observationId,
              initialObsAction: link.targetAction,
            ),
          ),
        ),
      );
    } catch (_) {
      // Fetch failed — user is already on the quality approvals list, no crash.
    }
  }

  // ── Quality site observation ───────────────────────────────────────────────

  static Future<void> _openQualitySiteObs(
    BuildContext context,
    PendingDeepLink link,
    Project project,
  ) async {
    if (link.observationId == null) return;
    try {
      final raw =
          await sl<SetuApiClient>().getQualitySiteObsById(link.observationId!);
      final obs = QualitySiteObservation.fromJson(raw);
      if (!context.mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => QualitySiteObsDetailPage(
            obs: obs,
            projectId: project.id,
          ),
        ),
      );
    } catch (_) {
      // Fetch failed — user is already on the quality site obs list.
    }
  }

  // ── RFI workflow (raised / approved / rejected) ───────────────────────────

  static Future<void> _openRfiInspection(
    BuildContext context,
    PendingDeepLink link,
    Project project,
  ) async {
    if (link.inspectionId == null) return;
    try {
      final raw =
          await sl<SetuApiClient>().getQualityInspectionDetail(link.inspectionId!);
      final inspection = QualityInspection.fromJson(raw);
      if (!context.mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => BlocProvider(
            create: (_) => sl<QualityApprovalBloc>()
              ..add(LoadInspectionDetail(inspection)),
            child: InspectionDetailPage(inspection: inspection),
          ),
        ),
      );
    } catch (_) {
      // Fetch failed — user is already on the quality approvals list.
    }
  }

  // ── EHS site observation ───────────────────────────────────────────────────

  static Future<void> _openEhsSiteObs(
    BuildContext context,
    PendingDeepLink link,
    Project project,
  ) async {
    if (link.observationId == null) return;
    try {
      final raw =
          await sl<SetuApiClient>().getEhsSiteObsById(link.observationId!);
      final obs = EhsSiteObservation.fromJson(raw);
      if (!context.mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => EhsSiteObsDetailPage(
            obs: obs,
            projectId: project.id,
          ),
        ),
      );
    } catch (_) {
      // Fetch failed — user is already on the EHS site obs list.
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// Infer the source type from the notification type string when the
  /// explicit [sourceType] field is absent (older payload format).
  static String? _inferSourceType(String type, String? explicit) {
    if (explicit != null && explicit.isNotEmpty) return explicit;
    if (type.startsWith('QUALITY_CHECKLIST_OBS_')) {
      return 'QUALITY_CHECKLIST_OBSERVATION';
    }
    if (type == 'RFI_RAISED' ||
        type == 'RFI_APPROVED' ||
        type == 'RFI_FULLY_APPROVED' ||
        type == 'RFI_WORKFLOW_REJECTED' ||
        type == 'RFI_APPROVAL_REVERSED' ||
        type == 'PENDING_APPROVAL' ||
        type == 'STAGE_LEVEL_PENDING' ||
        type == 'STAGE_APPROVED' ||
        type == 'INSPECTION_APPROVED' ||
        type == 'APPROVED' ||
        type == 'INSPECTION_REJECTED' ||
        type == 'REJECTED' ||
        type == 'WORKFLOW_STEP_ASSIGNED' ||
        type == 'WORKFLOW_DELEGATED' ||
        type == 'WORKFLOW_REVERSED') {
      return 'RFI_WORKFLOW';
    }
    if (type.startsWith('QUALITY_SITE_OBS_') ||
        type == 'QUALITY_OBS_RAISED' ||
        type == 'OBS_RECTIFIED' ||
        type == 'OBS_CLOSED') {
      return 'QUALITY_SITE_OBSERVATION';
    }
    if (type.startsWith('EHS_OBS_')) {
      return 'EHS_SITE_OBSERVATION';
    }
    return null;
  }
}
