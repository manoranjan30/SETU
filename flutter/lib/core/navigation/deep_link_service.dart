import 'package:flutter/foundation.dart';

/// Encapsulates the navigation intent encoded inside a push notification payload.
///
/// When a user taps a notification, the FCM data payload is decoded in
/// [SETUMobileApp._handleNotificationTap] and converted into a [PendingDeepLink].
/// That link is then stored in [DeepLinkService] so that once the navigator
/// settles on [ProjectsListPage], it can auto-navigate to the correct
/// project and module without the user having to tap again.
class PendingDeepLink {
  /// The notification type string from the FCM `data.type` field.
  ///
  /// Maps to one of the `case` constants in [targetModule] (e.g. `'RFI_RAISED'`).
  final String type;

  /// The numeric project ID from the FCM payload, used to pre-select a project.
  final int? projectId;

  /// The specific resource ID (observation, inspection, or incident UUID/int)
  /// that the notification refers to, enabling deep navigation to that record.
  final String? resourceId;

  const PendingDeepLink({
    required this.type,
    this.projectId,
    this.resourceId,
  });

  /// Translates the raw notification [type] into the module key expected by
  /// [ModuleSelectionPage] to route the user directly to the correct feature.
  ///
  /// Returns null for unknown types so callers can fall back gracefully
  /// (e.g. land on the project list without opening a module).
  ///
  /// The module key strings must match the keys registered in
  /// [ModuleSelectionPage]'s route map — changing them here without
  /// updating that page will silently drop the navigation.
  String? get targetModule {
    switch (type) {
      // Quality site observations (punch-list items raised/resolved/closed)
      case 'QUALITY_OBS_RAISED':
      case 'OBS_RECTIFIED':
      case 'OBS_CLOSED':
        return 'quality_site_obs';

      // EHS site observations (safety findings on site)
      case 'EHS_OBS_CRITICAL':
      case 'EHS_OBS_RECTIFIED':
      case 'EHS_OBS_CLOSED':
        return 'ehs_site_obs';

      // EHS incidents (accidents and near-misses)
      case 'EHS_INCIDENT_CREATED':
        return 'ehs_incidents';

      // Quality inspection (RFI) workflow events — all land on the
      // approvals page because the user either needs to act or review.
      case 'PENDING_APPROVAL':
      case 'RFI_RAISED':
      case 'INSPECTION_APPROVED':
      case 'APPROVED':
      case 'INSPECTION_REJECTED':
      case 'REJECTED':
      case 'WORKFLOW_STEP_ASSIGNED':
      case 'WORKFLOW_DELEGATED':
      case 'WORKFLOW_REVERSED':
        return 'quality_approvals';

      // Progress entry submitted for approval
      case 'PROGRESS_SUBMITTED':
        return 'progress_approvals';

      default:
        return null;
    }
  }
}

/// Application-wide singleton that holds at most one pending notification
/// deep-link at a time.
///
/// **Flow:**
/// 1. User taps a push notification.
/// 2. [SETUMobileApp._handleNotificationTap] calls [set] to store the link.
/// 3. The navigator is popped to root ([ProjectsListPage]).
/// 4. [ProjectsListPage] listens to [notifier]; when the value becomes
///    non-null it calls [consume] to retrieve-and-clear the link, then
///    pushes the appropriate route.
///
/// Using [ValueNotifier] means widgets can subscribe reactively rather
/// than polling, and the automatic null-after-consume prevents double-navigation.
class DeepLinkService {
  // Private constructor enforces the singleton pattern.
  DeepLinkService._();

  /// The global singleton instance — use this everywhere rather than creating
  /// a new instance, since only one pending link can exist at a time.
  static final DeepLinkService instance = DeepLinkService._();

  /// Observable holder for the pending link.
  ///
  /// Null means no pending navigation.  Listeners on this notifier should
  /// call [consume] (not read [notifier.value] directly) so the link is
  /// cleared after use and won't trigger navigation a second time.
  final ValueNotifier<PendingDeepLink?> notifier = ValueNotifier(null);

  /// Stores [link] as the pending navigation target.
  ///
  /// Any previous unconsumed link is overwritten — only the most recent
  /// notification tap matters.
  void set(PendingDeepLink link) => notifier.value = link;

  /// Returns the current pending link and immediately clears it.
  ///
  /// The clear is synchronous so that a second listener call in the same
  /// frame cannot pick up the same link.  Returns null if there is no
  /// pending link (safe to call unconditionally).
  PendingDeepLink? consume() {
    final link = notifier.value;
    notifier.value = null; // Clear so the ValueNotifier does not re-fire
    return link;
  }
}
