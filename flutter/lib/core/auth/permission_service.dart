import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';

/// Reads the authenticated user's permission set from the AuthBloc state.
/// Use [PermissionService.of(context)] to get an instance inside widget trees.
/// Use [PermissionService.fromUser(user)] for blocs that have direct User access.
class PermissionService {
  final Set<String> _permissions;

  PermissionService._(this._permissions);

  factory PermissionService.fromUser(User user) =>
      PermissionService._(user.permissions.toSet());

  factory PermissionService.empty() => PermissionService._(const {});

  /// Build from the current [AuthBloc] state in the widget tree.
  static PermissionService of(BuildContext context) {
    final state = context.read<AuthBloc>().state;
    if (state is AuthAuthenticated) {
      return PermissionService.fromUser(state.user);
    }
    return PermissionService.empty();
  }

  bool can(String permission) => _permissions.contains(permission);

  // ── Quality Inspection ───────────────────────────────────────────────────
  bool get canReadInspection      => can('QUALITY.INSPECTION.READ');
  bool get canRaiseRfi            => can('QUALITY.INSPECTION.RAISE');
  bool get canApproveInspection   => can('QUALITY.INSPECTION.APPROVE');
  bool get canStageApprove        => can('QUALITY.INSPECTION.STAGE_APPROVE');
  bool get canFinalApprove        => can('QUALITY.INSPECTION.FINAL_APPROVE');
  bool get canReverseInspection   => can('QUALITY.INSPECTION.REVERSE');
  bool get canDeleteInspection    => can('QUALITY.INSPECTION.DELETE');

  // ── Quality Observations ─────────────────────────────────────────────────
  bool get canReadQualityObs      => can('QUALITY.SITE_OBS.READ');
  bool get canCreateQualityObs    => can('QUALITY.SITE_OBS.CREATE');
  bool get canRectifyQualityObs   => can('QUALITY.SITE_OBS.RECTIFY');
  bool get canCloseQualityObs     => can('QUALITY.SITE_OBS.CLOSE');
  bool get canDeleteQualityObs    => can('QUALITY.SITE_OBS.DELETE');

  // ── Quality Activity Observations ────────────────────────────────────────
  bool get canCreateActivityObs   => can('QUALITY.OBSERVATION.CREATE');
  bool get canResolveActivityObs  => can('QUALITY.OBSERVATION.RESOLVE');

  // ── EHS ──────────────────────────────────────────────────────────────────
  bool get canReadEhsDashboard    => can('EHS.DASHBOARD.READ');
  bool get canReadEhsObs          => can('EHS.SITE_OBS.READ');
  bool get canCreateEhsObs        => can('EHS.SITE_OBS.CREATE');
  bool get canRectifyEhsObs       => can('EHS.SITE_OBS.RECTIFY');
  bool get canCloseEhsObs         => can('EHS.SITE_OBS.CLOSE');
  bool get canDeleteEhsObs        => can('EHS.SITE_OBS.DELETE');

  bool get hasAnyEhsAccess =>
      canReadEhsDashboard || canReadEhsObs || canCreateEhsObs;

  bool get hasAnyQualityObsAccess => canReadQualityObs || canCreateQualityObs;
}
