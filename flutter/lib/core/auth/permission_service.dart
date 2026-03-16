import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';

/// Provides boolean permission checks derived from the authenticated user's
/// server-assigned permission set.
///
/// Permissions are strings defined on the backend (e.g. `'QUALITY.INSPECTION.READ'`)
/// and stored in [User.permissions].  This service converts that flat list into
/// typed Dart getters so widgets and BLoCs never hard-code raw permission strings.
///
/// **Usage patterns:**
/// - Inside a widget tree: `PermissionService.of(context)` — reads the current
///   [AuthBloc] state and builds an instance with no extra work.
/// - Inside a BLoC that already has a [User]: `PermissionService.fromUser(user)`.
/// - As a safe default when no user is authenticated: `PermissionService.empty()`.
///
/// Instances are cheap value objects — create them on demand rather than caching.
class PermissionService {
  // Backed by a Set for O(1) lookup on every [can] call.
  final Set<String> _permissions;

  PermissionService._(this._permissions);

  /// Creates a service loaded with all permissions granted to [user].
  factory PermissionService.fromUser(User user) =>
      PermissionService._(user.permissions.toSet());

  /// Creates a service where every permission check returns false.
  ///
  /// Used as a safe fallback when the auth state is unauthenticated so
  /// callers never need to null-check the service itself.
  factory PermissionService.empty() => PermissionService._(const {});

  /// Build from the current [AuthBloc] state in the widget tree.
  ///
  /// Reads the [AuthBloc] synchronously — does not subscribe to changes.
  /// Widgets that need to react to permission changes should call this
  /// inside a [BlocBuilder] or [BlocConsumer] rebuild.
  static PermissionService of(BuildContext context) {
    final state = context.read<AuthBloc>().state;
    if (state is AuthAuthenticated) {
      return PermissionService.fromUser(state.user);
    }
    // Return empty permissions if the user is not authenticated yet,
    // so callers get safe false values rather than a null reference.
    return PermissionService.empty();
  }

  /// Returns true if [permission] exists in this user's granted permission set.
  ///
  /// All named getters below delegate to this method — it is the single
  /// point of truth so the string-to-bool mapping stays consistent.
  bool can(String permission) => _permissions.contains(permission);

  // ── Execution / Progress ─────────────────────────────────────────────────
  // Progress entry permissions control who can submit and who can approve
  // daily execution quantities on the EPS (Execution Progress Sheet).

  /// Whether this user may submit new progress entries.
  bool get canEntryProgress       => can('EXECUTION.ENTRY.CREATE');

  /// Whether this user may approve progress entries submitted by others.
  bool get canApproveProgress     => can('EXECUTION.ENTRY.APPROVE');

  // ── Quality Inspection ───────────────────────────────────────────────────
  // Inspection permissions follow the RFI workflow: raise → stage approve
  // → final approve.  Separate permissions exist for reverse and delegate
  // actions that can unwind or reassign a step in the workflow.

  /// Whether this user may view quality inspections (RFIs).
  bool get canReadInspection      => can('QUALITY.INSPECTION.READ');

  /// Whether this user may raise a new RFI (Request for Inspection).
  bool get canRaiseRfi            => can('QUALITY.INSPECTION.RAISE');

  /// Whether this user may approve inspections at any workflow step.
  bool get canApproveInspection   => can('QUALITY.INSPECTION.APPROVE');

  /// Whether this user may perform intermediate (stage) approvals.
  bool get canStageApprove        => can('QUALITY.INSPECTION.STAGE_APPROVE');

  /// Whether this user may perform the final approval that closes an RFI.
  bool get canFinalApprove        => can('QUALITY.INSPECTION.FINAL_APPROVE');

  /// Whether this user may reverse (undo) a previously approved inspection.
  bool get canReverseInspection   => can('QUALITY.INSPECTION.REVERSE');

  /// Whether this user may delegate their approval step to another user.
  bool get canDelegateInspection  => can('QUALITY.INSPECTION.DELEGATE');

  /// Whether this user may permanently delete an inspection record.
  bool get canDeleteInspection    => can('QUALITY.INSPECTION.DELETE');

  // ── Quality Observations ─────────────────────────────────────────────────
  // Site quality observations (punch-list items raised during site walks)
  // follow a raise → rectify → close lifecycle.

  /// Whether this user may view quality site observations.
  bool get canReadQualityObs      => can('QUALITY.SITE_OBS.READ');

  /// Whether this user may raise a new quality site observation.
  bool get canCreateQualityObs    => can('QUALITY.SITE_OBS.CREATE');

  /// Whether this user may mark a quality observation as rectified.
  bool get canRectifyQualityObs   => can('QUALITY.SITE_OBS.RECTIFY');

  /// Whether this user may close a rectified quality observation.
  bool get canCloseQualityObs     => can('QUALITY.SITE_OBS.CLOSE');

  /// Whether this user may delete a quality site observation.
  bool get canDeleteQualityObs    => can('QUALITY.SITE_OBS.DELETE');

  // ── Quality Activity Observations ────────────────────────────────────────
  // Activity-level observations are linked to specific checklist items
  // (as opposed to general site-walk observations above).

  /// Whether this user may create observations on checklist activity items.
  bool get canCreateActivityObs   => can('QUALITY.OBSERVATION.CREATE');

  /// Whether this user may mark activity observations as resolved.
  bool get canResolveActivityObs  => can('QUALITY.OBSERVATION.RESOLVE');

  /// Whether this user may delete activity-level observations.
  bool get canDeleteActivityObs   => can('QUALITY.OBSERVATION.DELETE');

  // ── EHS ──────────────────────────────────────────────────────────────────
  // EHS (Environment, Health & Safety) permissions mirror the quality
  // observation lifecycle but for safety-related findings on site.

  /// Whether this user may view the EHS dashboard (summary charts).
  bool get canReadEhsDashboard    => can('EHS.DASHBOARD.READ');

  /// Whether this user may view EHS site observations.
  bool get canReadEhsObs          => can('EHS.SITE_OBS.READ');

  /// Whether this user may raise new EHS site observations.
  bool get canCreateEhsObs        => can('EHS.SITE_OBS.CREATE');

  /// Whether this user may mark EHS observations as rectified.
  bool get canRectifyEhsObs       => can('EHS.SITE_OBS.RECTIFY');

  /// Whether this user may close rectified EHS observations.
  bool get canCloseEhsObs         => can('EHS.SITE_OBS.CLOSE');

  /// Whether this user may delete EHS observations.
  bool get canDeleteEhsObs        => can('EHS.SITE_OBS.DELETE');

  /// True if the user has at least one EHS permission, used to decide
  /// whether to show the EHS module tile on the module selection screen.
  bool get hasAnyEhsAccess =>
      canReadEhsDashboard || canReadEhsObs || canCreateEhsObs;

  /// True if the user can read or create quality observations.
  ///
  /// Used to control visibility of the quality site observations panel
  /// without needing to check individual sub-permissions.
  bool get hasAnyQualityObsAccess => canReadQualityObs || canCreateQualityObs;

  // ── Labor ─────────────────────────────────────────────────────────────────
  // Labor entry permissions control daily manpower/headcount tracking.

  /// Whether this user may view labor entries.
  bool get canReadLabor        => can('LABOR.ENTRY.READ');

  /// Whether this user may create new labor entries.
  bool get canCreateLabor      => can('LABOR.ENTRY.CREATE');

  /// True if the user has any labor access, used to show/hide the Labor module tile.
  bool get hasAnyLaborAccess => canReadLabor || canCreateLabor;

  // ── EHS Incidents ─────────────────────────────────────────────────────────
  // EHS incidents (accidents, near-misses) are a separate flow from
  // EHS observations and require their own permissions.

  /// Whether this user may view EHS incident records.
  bool get canReadEhsIncident   => can('EHS.INCIDENT.READ');

  /// Whether this user may log new EHS incidents.
  bool get canCreateEhsIncident => can('EHS.INCIDENT.CREATE');

  /// True if the user has any EHS incident access, used to show/hide the
  /// EHS Incidents section within the EHS module.
  bool get hasAnyEhsIncidentAccess => canReadEhsIncident || canCreateEhsIncident;
}
