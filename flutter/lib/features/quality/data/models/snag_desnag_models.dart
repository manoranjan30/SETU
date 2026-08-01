import 'package:equatable/equatable.dart';

/// Data models for the process-step/round/unit-workspace Snag/Desnag
/// module (`/api/snag/...`). Unrelated to the older flat `QualitySnag`
/// model in `quality_models.dart` (`/api/quality/:projectId/snags`) — that
/// is a separate, legacy punch-list feature this module does not replace.
///
/// Shapes verified directly against `backend/src/snag/**` (entities,
/// service, DTOs) rather than taken solely from handoff documentation.

// ============================================================
// ENUMS
// ============================================================

enum SnagListStatus {
  /// Synthetic, client-facing only — the backend has no `unready` member in
  /// its persisted `SnagListStatus` enum. `GET /snag/:projectId/units`
  /// returns the literal string `'unready'` for a unit with no snag list
  /// yet (see `snag.service.ts:listUnits`), so it must still be parsed here
  /// even though it's never actually stored.
  unready,
  readyForSnag, snagging, desnagging, released, handoverReady;

  static SnagListStatus fromString(String s) => switch (s) {
    'unready' => SnagListStatus.unready,
    'ready_for_snag' => SnagListStatus.readyForSnag,
    'desnagging' => SnagListStatus.desnagging,
    'released' => SnagListStatus.released,
    'handover_ready' => SnagListStatus.handoverReady,
    _ => SnagListStatus.snagging,
  };

  String get label => switch (this) {
    SnagListStatus.unready => 'Not Started',
    SnagListStatus.readyForSnag => 'Ready for Snagging',
    SnagListStatus.snagging => 'Snagging',
    SnagListStatus.desnagging => 'Desnagging',
    SnagListStatus.released => 'Released',
    SnagListStatus.handoverReady => 'Ready for Customer Inspection',
  };
}

enum SnagRoundSnagPhaseStatus {
  open, submitted;

  static SnagRoundSnagPhaseStatus fromString(String s) =>
      s == 'submitted' ? SnagRoundSnagPhaseStatus.submitted : SnagRoundSnagPhaseStatus.open;
}

enum SnagRoundDesnagPhaseStatus {
  locked, open, approvalPending, approved, rejected;

  static SnagRoundDesnagPhaseStatus fromString(String s) => switch (s) {
    'open' => SnagRoundDesnagPhaseStatus.open,
    'approval_pending' => SnagRoundDesnagPhaseStatus.approvalPending,
    'approved' => SnagRoundDesnagPhaseStatus.approved,
    'rejected' => SnagRoundDesnagPhaseStatus.rejected,
    _ => SnagRoundDesnagPhaseStatus.locked,
  };
}

enum SnagItemStatus {
  open, rectified, closed, onHold;

  static SnagItemStatus fromString(String s) => switch (s) {
    'rectified' => SnagItemStatus.rectified,
    'closed' => SnagItemStatus.closed,
    'on_hold' => SnagItemStatus.onHold,
    _ => SnagItemStatus.open,
  };

  String get label => switch (this) {
    SnagItemStatus.open => 'Open',
    SnagItemStatus.rectified => 'Rectified',
    SnagItemStatus.closed => 'Closed',
    SnagItemStatus.onHold => 'On Hold',
  };
}

enum SnagPhotoType {
  before, after, closure;

  static SnagPhotoType fromString(String s) => switch (s) {
    'after' => SnagPhotoType.after,
    'closure' => SnagPhotoType.closure,
    _ => SnagPhotoType.before,
  };
}

enum SnagApprovalStatus {
  pending, approved, rejected;

  static SnagApprovalStatus fromString(String s) => switch (s) {
    'approved' => SnagApprovalStatus.approved,
    'rejected' => SnagApprovalStatus.rejected,
    _ => SnagApprovalStatus.pending,
  };
}

enum SnagApprovalStepStatus {
  waiting, pending, approved, rejected;

  static SnagApprovalStepStatus fromString(String s) => switch (s) {
    'pending' => SnagApprovalStepStatus.pending,
    'approved' => SnagApprovalStepStatus.approved,
    'rejected' => SnagApprovalStepStatus.rejected,
    _ => SnagApprovalStepStatus.waiting,
  };
}

// ============================================================
// CONFIGURATION (read-only on mobile — never created/edited here)
// ============================================================

class SnagCommonPoint extends Equatable {
  final int id;
  final String title;
  final String? description;
  final String severity;
  final bool requiresEvidence;

  const SnagCommonPoint({
    required this.id,
    required this.title,
    this.description,
    this.severity = 'medium',
    this.requiresEvidence = false,
  });

  factory SnagCommonPoint.fromJson(Map<String, dynamic> j) => SnagCommonPoint(
    id: j['id'] as int? ?? 0,
    title: j['title'] as String? ?? '',
    description: j['description'] as String?,
    severity: j['severity'] as String? ?? 'medium',
    requiresEvidence: j['requiresEvidence'] as bool? ?? false,
  );

  @override
  List<Object?> get props => [id, title, description, severity, requiresEvidence];
}

class SnagProcessActivity extends Equatable {
  final int id;
  final int activityId;
  final String activityName;
  final List<SnagCommonPoint> commonPoints;

  const SnagProcessActivity({
    required this.id,
    required this.activityId,
    required this.activityName,
    this.commonPoints = const [],
  });

  factory SnagProcessActivity.fromJson(Map<String, dynamic> j) {
    final activity = j['activity'] as Map<String, dynamic>?;
    return SnagProcessActivity(
      id: j['id'] as int? ?? 0,
      activityId: j['activityId'] as int? ?? 0,
      activityName: (activity?['name'] ?? activity?['activityName'] ?? 'Activity') as String,
      commonPoints: (j['commonPoints'] as List<dynamic>?)
              ?.map((e) => SnagCommonPoint.fromJson(e as Map<String, dynamic>))
              .where((p) => p.title.isNotEmpty)
              .toList() ??
          [],
    );
  }

  @override
  List<Object?> get props => [id, activityId, activityName, commonPoints];
}

class SnagProcessStep extends Equatable {
  final int id;
  final String name;
  final String? description;
  final int workflowSerialNo;
  final bool isActive;
  final List<SnagProcessActivity> activities;

  /// Per-step, admin-configured photo requirements — all default `false`
  /// (optional) on the backend. Mobile must check these rather than
  /// hard-coding photos as mandatory for any of the three stages.
  final bool raisePhotoRequired;
  final bool rectificationPhotoRequired;
  final bool desnagCompletionPhotoRequired;

  const SnagProcessStep({
    required this.id,
    required this.name,
    this.description,
    required this.workflowSerialNo,
    this.isActive = true,
    this.activities = const [],
    this.raisePhotoRequired = false,
    this.rectificationPhotoRequired = false,
    this.desnagCompletionPhotoRequired = false,
  });

  factory SnagProcessStep.fromJson(Map<String, dynamic> j) => SnagProcessStep(
    id: j['id'] as int? ?? 0,
    name: j['name'] as String? ?? '',
    description: j['description'] as String?,
    workflowSerialNo: j['workflowSerialNo'] as int? ?? 0,
    isActive: j['isActive'] as bool? ?? true,
    activities: (j['activities'] as List<dynamic>?)
            ?.map((e) => SnagProcessActivity.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [],
    raisePhotoRequired: j['raisePhotoRequired'] as bool? ?? false,
    rectificationPhotoRequired: j['rectificationPhotoRequired'] as bool? ?? false,
    desnagCompletionPhotoRequired: j['desnagCompletionPhotoRequired'] as bool? ?? false,
  );

  @override
  List<Object?> get props => [
    id, name, description, workflowSerialNo, isActive, activities,
    raisePhotoRequired, rectificationPhotoRequired, desnagCompletionPhotoRequired,
  ];
}

// ============================================================
// UNIT EXPLORER
// ============================================================

/// One row from `GET /snag/:projectId/units` — a unit's snag/desnag status
/// pre-joined with its block/tower/floor labels. This is the only endpoint
/// cheap enough to call for every unit in a project; anything not present
/// here (item-level counts, aging) is not available without opening that
/// unit's own list detail.
class SnagUnitSummary extends Equatable {
  final int qualityUnitId;
  final String unitLabel;
  final int floorId;
  final String floorLabel;
  final int towerId;
  final String towerLabel;
  final int? blockId;
  final String? blockLabel;
  final int roomCount;
  final int? snagListId;
  final int currentRound;
  final SnagListStatus overallStatus;
  final int commonChecklistCount;

  const SnagUnitSummary({
    required this.qualityUnitId,
    required this.unitLabel,
    required this.floorId,
    required this.floorLabel,
    required this.towerId,
    required this.towerLabel,
    this.blockId,
    this.blockLabel,
    this.roomCount = 0,
    this.snagListId,
    this.currentRound = 1,
    this.overallStatus = SnagListStatus.snagging,
    this.commonChecklistCount = 0,
  });

  /// True until the unit's first snag list has been created (i.e. nobody
  /// has opened its workspace yet). The backend sends the synthetic status
  /// string `'unready'` for exactly this case (see [SnagListStatus.unready]);
  /// `snagListId == null` is kept as a defensive fallback in case that ever
  /// diverges.
  bool get isNotStarted => overallStatus == SnagListStatus.unready || snagListId == null;

  factory SnagUnitSummary.fromJson(Map<String, dynamic> j) => SnagUnitSummary(
    qualityUnitId: j['qualityUnitId'] as int? ?? 0,
    unitLabel: j['unitLabel'] as String? ?? '',
    floorId: j['floorId'] as int? ?? 0,
    floorLabel: j['floorLabel'] as String? ?? '',
    towerId: j['towerId'] as int? ?? 0,
    towerLabel: j['towerLabel'] as String? ?? '',
    blockId: j['blockId'] as int?,
    blockLabel: j['blockLabel'] as String?,
    roomCount: j['roomCount'] as int? ?? 0,
    snagListId: j['snagListId'] as int?,
    currentRound: j['currentRound'] as int? ?? 1,
    overallStatus: SnagListStatus.fromString(j['overallStatus'] as String? ?? 'snagging'),
    commonChecklistCount: j['commonChecklistCount'] as int? ?? 0,
  );

  @override
  List<Object?> get props => [
    qualityUnitId, unitLabel, floorId, towerId, blockId, snagListId,
    currentRound, overallStatus, commonChecklistCount,
  ];
}

/// A unit's status *relative to a specific process step being viewed* —
/// distinct from [SnagUnitSummary.overallStatus], which only describes the
/// unit's actual current round. The Unit Explorer must be process-step
/// first (per the mobile handoff's "Required Mobile Workflow Hierarchy"):
/// the same unit shows a different status depending on which step tab is
/// selected — e.g. a unit on round 2 shows "Snag 1 Completed" under the
/// Step 1 tab but "Snag 2 Open" under the Step 2 tab.
enum SnagStepUnitStatus {
  /// No snag list yet and this is the very first configured step.
  notReady,

  /// Either no snag list yet and this isn't the first step, or the unit's
  /// current round is behind this step with no pending readiness request
  /// for it — not enterable from this step's board.
  locked,

  /// This is the unit's current round and it's ready for the Checker to
  /// start raising points.
  readyForStep,

  /// This is the unit's current round and points are being raised.
  open,

  /// This is the unit's current round and it's in de-snag review.
  desnagActive,

  /// This is the unit's current round and it was just finally closed —
  /// waiting on the Maker to start the *next* configured step.
  closedNextPending,

  /// The unit is one step behind this one and `released` — the Maker can
  /// press "Mark Ready and Start Snag N" to advance it onto this step.
  readyRequestPending,

  /// The unit has already moved past this step.
  stepCompleted,

  /// Every configured step is finally closed.
  customerInspectionReady;

  /// Only [locked] units are non-actionable from the board — every other
  /// status either opens the unit's real current workspace (which exposes
  /// whatever action, if any, that status allows) or is a terminal/read
  /// state that's still safe to open.
  bool get isLocked => this == SnagStepUnitStatus.locked;

  String label(int selectedWorkflowSerialNo) => switch (this) {
    SnagStepUnitStatus.notReady => 'Not Ready',
    SnagStepUnitStatus.locked => 'Locked',
    SnagStepUnitStatus.readyForStep => 'Ready for Snag $selectedWorkflowSerialNo',
    SnagStepUnitStatus.open => 'Snag $selectedWorkflowSerialNo Open',
    SnagStepUnitStatus.desnagActive => 'De-snag $selectedWorkflowSerialNo Active',
    SnagStepUnitStatus.closedNextPending => 'Snag $selectedWorkflowSerialNo Closed — Next Pending',
    SnagStepUnitStatus.readyRequestPending => 'Ready Request Pending',
    SnagStepUnitStatus.stepCompleted => 'Snag $selectedWorkflowSerialNo Completed',
    SnagStepUnitStatus.customerInspectionReady => 'Ready for Customer Inspection',
  };

  /// Which of the step-card counter buckets this status rolls up into.
  SnagStepCounterBucket get bucket => switch (this) {
    SnagStepUnitStatus.readyForStep ||
    SnagStepUnitStatus.open ||
    SnagStepUnitStatus.desnagActive => SnagStepCounterBucket.active,
    SnagStepUnitStatus.readyRequestPending => SnagStepCounterBucket.waiting,
    SnagStepUnitStatus.stepCompleted ||
    SnagStepUnitStatus.customerInspectionReady ||
    SnagStepUnitStatus.closedNextPending => SnagStepCounterBucket.done,
    SnagStepUnitStatus.notReady || SnagStepUnitStatus.locked => SnagStepCounterBucket.locked,
  };
}

enum SnagStepCounterBucket { active, waiting, done, locked }

/// Maps [unit] to its [SnagStepUnitStatus] for the step whose
/// `workflowSerialNo` is [selectedWorkflowSerialNo] — the exact table from
/// the mobile handoff's "Unit Status Mapping For Selected Step".
SnagStepUnitStatus computeSnagStepUnitStatus(SnagUnitSummary unit, int selectedWorkflowSerialNo) {
  if (unit.snagListId == null) {
    return selectedWorkflowSerialNo == 1 ? SnagStepUnitStatus.notReady : SnagStepUnitStatus.locked;
  }
  if (unit.overallStatus == SnagListStatus.handoverReady) {
    return SnagStepUnitStatus.customerInspectionReady;
  }
  if (unit.currentRound > selectedWorkflowSerialNo) {
    return SnagStepUnitStatus.stepCompleted;
  }
  if (unit.currentRound < selectedWorkflowSerialNo) {
    if (unit.overallStatus == SnagListStatus.released && unit.currentRound + 1 == selectedWorkflowSerialNo) {
      return SnagStepUnitStatus.readyRequestPending;
    }
    return SnagStepUnitStatus.locked;
  }
  // unit.currentRound == selectedWorkflowSerialNo
  return switch (unit.overallStatus) {
    SnagListStatus.readyForSnag => SnagStepUnitStatus.readyForStep,
    SnagListStatus.snagging => SnagStepUnitStatus.open,
    SnagListStatus.desnagging => SnagStepUnitStatus.desnagActive,
    SnagListStatus.released => SnagStepUnitStatus.closedNextPending,
    SnagListStatus.handoverReady => SnagStepUnitStatus.customerInspectionReady,
    // Defensive only — snagListId != null here, so the backend's synthetic
    // 'unready' string (see SnagListStatus.unready's doc) shouldn't occur.
    SnagListStatus.unready => SnagStepUnitStatus.notReady,
  };
}

// ============================================================
// UNIT WORKSPACE (snag list detail)
// ============================================================

class SnagPhoto extends Equatable {
  final int id;
  final SnagPhotoType type;
  final String fileUrl;

  const SnagPhoto({required this.id, required this.type, required this.fileUrl});

  factory SnagPhoto.fromJson(Map<String, dynamic> j) => SnagPhoto(
    id: j['id'] as int? ?? 0,
    type: SnagPhotoType.fromString(j['type'] as String? ?? 'before'),
    fileUrl: j['fileUrl'] as String? ?? '',
  );

  @override
  List<Object?> get props => [id, type, fileUrl];
}

class SnagItem extends Equatable {
  final int id;
  final int snagRoundId;
  final int? qualityRoomId;
  final String? roomLabel;
  final String defectTitle;
  final String? defectDescription;
  final String? trade;
  final String priority;
  final SnagItemStatus status;
  final String? holdReason;
  final String? rectificationNotes;
  final String? closureRemarks;
  final int notSatisfactoryCount;
  final String? lastNotSatisfactoryRemarks;
  final DateTime? lastNotSatisfactoryAt;
  final int? lastNotSatisfactoryByUserId;
  final DateTime? raisedAt;
  final DateTime? rectifiedAt;
  final DateTime? closedAt;
  final List<SnagPhoto> photos;

  /// True for an optimistic item/update applied locally while its mutation
  /// (raise/rectify/close) sits in the offline sync queue — never set by
  /// [fromJson], since anything the server returns is by definition synced.
  /// Cleared once [SnagDesnagBloc] re-fetches the real state after the
  /// queued action lands.
  final bool isPendingSync;

  const SnagItem({
    required this.id,
    required this.snagRoundId,
    this.qualityRoomId,
    this.roomLabel,
    required this.defectTitle,
    this.defectDescription,
    this.trade,
    this.priority = 'medium',
    this.status = SnagItemStatus.open,
    this.holdReason,
    this.rectificationNotes,
    this.closureRemarks,
    this.notSatisfactoryCount = 0,
    this.lastNotSatisfactoryRemarks,
    this.lastNotSatisfactoryAt,
    this.lastNotSatisfactoryByUserId,
    this.raisedAt,
    this.rectifiedAt,
    this.closedAt,
    this.photos = const [],
    this.isPendingSync = false,
  });

  SnagItem copyWith({
    SnagItemStatus? status,
    String? rectificationNotes,
    String? closureRemarks,
    DateTime? raisedAt,
    DateTime? rectifiedAt,
    DateTime? closedAt,
    bool? isPendingSync,
  }) {
    return SnagItem(
      id: id,
      snagRoundId: snagRoundId,
      qualityRoomId: qualityRoomId,
      roomLabel: roomLabel,
      defectTitle: defectTitle,
      defectDescription: defectDescription,
      trade: trade,
      priority: priority,
      status: status ?? this.status,
      holdReason: holdReason,
      rectificationNotes: rectificationNotes ?? this.rectificationNotes,
      closureRemarks: closureRemarks ?? this.closureRemarks,
      notSatisfactoryCount: notSatisfactoryCount,
      lastNotSatisfactoryRemarks: lastNotSatisfactoryRemarks,
      lastNotSatisfactoryAt: lastNotSatisfactoryAt,
      lastNotSatisfactoryByUserId: lastNotSatisfactoryByUserId,
      raisedAt: raisedAt ?? this.raisedAt,
      rectifiedAt: rectifiedAt ?? this.rectifiedAt,
      closedAt: closedAt ?? this.closedAt,
      photos: photos,
      isPendingSync: isPendingSync ?? this.isPendingSync,
    );
  }

  factory SnagItem.fromJson(Map<String, dynamic> j) {
    DateTime? dt(dynamic v) => v == null ? null : DateTime.tryParse(v.toString());
    return SnagItem(
      id: j['id'] as int? ?? 0,
      snagRoundId: j['snagRoundId'] as int? ?? 0,
      qualityRoomId: j['qualityRoomId'] as int?,
      roomLabel: j['roomLabel'] as String?,
      defectTitle: j['defectTitle'] as String? ?? '',
      defectDescription: j['defectDescription'] as String?,
      trade: j['trade'] as String?,
      priority: j['priority'] as String? ?? 'medium',
      status: SnagItemStatus.fromString(j['status'] as String? ?? 'open'),
      holdReason: j['holdReason'] as String?,
      rectificationNotes: j['rectificationNotes'] as String?,
      closureRemarks: j['closureRemarks'] as String?,
      notSatisfactoryCount: j['notSatisfactoryCount'] as int? ?? 0,
      lastNotSatisfactoryRemarks: j['lastNotSatisfactoryRemarks'] as String?,
      lastNotSatisfactoryAt: dt(j['lastNotSatisfactoryAt']),
      lastNotSatisfactoryByUserId: j['lastNotSatisfactoryById'] as int?,
      raisedAt: dt(j['raisedAt']),
      rectifiedAt: dt(j['rectifiedAt']),
      closedAt: dt(j['closedAt']),
      photos: (j['photos'] as List<dynamic>?)
              ?.map((e) => SnagPhoto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  @override
  List<Object?> get props => [id, snagRoundId, defectTitle, status, priority, photos, notSatisfactoryCount, isPendingSync];
}

class SnagApprovalStep extends Equatable {
  final int id;
  final int stepOrder;
  final String stepName;
  final int? assignedUserId;
  final List<int>? assignedUserIds;
  final SnagApprovalStepStatus status;
  final int? actedByUserId;
  final DateTime? actedAt;
  final String? comments;

  const SnagApprovalStep({
    required this.id,
    required this.stepOrder,
    required this.stepName,
    this.assignedUserId,
    this.assignedUserIds,
    this.status = SnagApprovalStepStatus.waiting,
    this.actedByUserId,
    this.actedAt,
    this.comments,
  });

  factory SnagApprovalStep.fromJson(Map<String, dynamic> j) => SnagApprovalStep(
    id: j['id'] as int? ?? 0,
    stepOrder: j['stepOrder'] as int? ?? 0,
    stepName: j['stepName'] as String? ?? '',
    assignedUserId: j['assignedUserId'] as int?,
    assignedUserIds: (j['assignedUserIds'] as List<dynamic>?)?.cast<int>(),
    status: SnagApprovalStepStatus.fromString(j['status'] as String? ?? 'waiting'),
    actedByUserId: j['actedByUserId'] as int?,
    actedAt: j['actedAt'] == null ? null : DateTime.tryParse(j['actedAt'].toString()),
    comments: j['comments'] as String?,
  );

  @override
  List<Object?> get props => [id, stepOrder, stepName, status];
}

class SnagApproval extends Equatable {
  final int id;
  final int currentStepOrder;
  final SnagApprovalStatus status;
  final List<SnagApprovalStep> steps;

  const SnagApproval({
    required this.id,
    required this.currentStepOrder,
    this.status = SnagApprovalStatus.pending,
    this.steps = const [],
  });

  factory SnagApproval.fromJson(Map<String, dynamic> j) => SnagApproval(
    id: j['id'] as int? ?? 0,
    currentStepOrder: j['currentStepOrder'] as int? ?? 1,
    status: SnagApprovalStatus.fromString(j['status'] as String? ?? 'pending'),
    steps: (j['steps'] as List<dynamic>?)
            ?.map((e) => SnagApprovalStep.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [],
  );

  @override
  List<Object?> get props => [id, currentStepOrder, status, steps];
}

class SnagRound extends Equatable {
  final int id;
  final int roundNumber;
  final SnagRoundSnagPhaseStatus snagPhaseStatus;
  final DateTime? snagSubmittedAt;
  final SnagRoundDesnagPhaseStatus desnagPhaseStatus;
  final DateTime? desnagReleasedAt;
  final bool isSkipped;
  final String? skipReason;
  final List<SnagItem> items;
  final List<SnagApproval> approvals;
  final DateTime? finalClosureSignedAt;
  final int? finalClosureSignedByUserId;
  final String? finalClosureSignatureData;
  final String? finalClosureRemarks;

  const SnagRound({
    required this.id,
    required this.roundNumber,
    this.snagPhaseStatus = SnagRoundSnagPhaseStatus.open,
    this.snagSubmittedAt,
    this.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.locked,
    this.desnagReleasedAt,
    this.isSkipped = false,
    this.skipReason,
    this.items = const [],
    this.approvals = const [],
    this.finalClosureSignedAt,
    this.finalClosureSignedByUserId,
    this.finalClosureSignatureData,
    this.finalClosureRemarks,
  });

  SnagRound copyWith({List<SnagItem>? items}) {
    return SnagRound(
      id: id,
      roundNumber: roundNumber,
      snagPhaseStatus: snagPhaseStatus,
      snagSubmittedAt: snagSubmittedAt,
      desnagPhaseStatus: desnagPhaseStatus,
      desnagReleasedAt: desnagReleasedAt,
      isSkipped: isSkipped,
      skipReason: skipReason,
      items: items ?? this.items,
      approvals: approvals,
      finalClosureSignedAt: finalClosureSignedAt,
      finalClosureSignedByUserId: finalClosureSignedByUserId,
      finalClosureSignatureData: finalClosureSignatureData,
      finalClosureRemarks: finalClosureRemarks,
    );
  }

  int get openCount => items.where((i) => i.status == SnagItemStatus.open).length;
  int get rectifiedCount => items.where((i) => i.status == SnagItemStatus.rectified).length;
  int get closedCount => items.where((i) => i.status == SnagItemStatus.closed).length;

  bool get isFinallyClosed => finalClosureSignedAt != null;

  /// Desnag ready is enabled only when every non-cancelled item is
  /// rectified/closed/held — mirrors the `submit-release` backend rule so
  /// the button can be disabled locally without waiting on a round trip.
  bool get allItemsResolved =>
      items.isNotEmpty && items.every((i) => i.status != SnagItemStatus.open);

  /// Final closure is stricter than [allItemsResolved]: the backend
  /// requires *every* item to be exactly `closed` — an item left `on_hold`
  /// blocks it (`snag.service.ts:finalClosureRound`).
  bool get allItemsClosed =>
      items.isNotEmpty && items.every((i) => i.status == SnagItemStatus.closed);

  factory SnagRound.fromJson(Map<String, dynamic> j) {
    DateTime? dt(dynamic v) => v == null ? null : DateTime.tryParse(v.toString());
    return SnagRound(
      id: j['id'] as int? ?? 0,
      roundNumber: j['roundNumber'] as int? ?? 1,
      snagPhaseStatus: SnagRoundSnagPhaseStatus.fromString(j['snagPhaseStatus'] as String? ?? 'open'),
      snagSubmittedAt: dt(j['snagSubmittedAt']),
      desnagPhaseStatus: SnagRoundDesnagPhaseStatus.fromString(j['desnagPhaseStatus'] as String? ?? 'locked'),
      desnagReleasedAt: dt(j['desnagReleasedAt']),
      isSkipped: j['isSkipped'] as bool? ?? false,
      skipReason: j['skipReason'] as String?,
      items: (j['items'] as List<dynamic>?)
              ?.map((e) => SnagItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      approvals: (j['approvals'] as List<dynamic>?)
              ?.map((e) => SnagApproval.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      finalClosureSignedAt: dt(j['finalClosureSignedAt']),
      finalClosureSignedByUserId: j['finalClosureSignedById'] as int?,
      finalClosureSignatureData: j['finalClosureSignatureData'] as String?,
      finalClosureRemarks: j['finalClosureRemarks'] as String?,
    );
  }

  @override
  List<Object?> get props => [
    id, roundNumber, snagPhaseStatus, desnagPhaseStatus, isSkipped, items, approvals, finalClosureSignedAt,
  ];
}

class SnagRoom extends Equatable {
  final int id;
  final String name;
  const SnagRoom({required this.id, required this.name});

  factory SnagRoom.fromJson(Map<String, dynamic> j) =>
      SnagRoom(id: j['id'] as int? ?? 0, name: j['name'] as String? ?? '');

  @override
  List<Object?> get props => [id, name];
}

/// Full detail from `GET /snag/:projectId/lists/:listId` — everything
/// needed to render the unit workspace: current round, all rounds'
/// history, the project's configured process steps (for step labels), and
/// the unit's room list (for the room-selection step when raising a snag).
class SnagList extends Equatable {
  final int id;
  final int qualityUnitId;
  final String unitLabel;
  final int currentRound;
  final SnagListStatus overallStatus;
  final List<SnagProcessStep> processSteps;
  final List<SnagRound> rounds;
  final List<SnagRoom> rooms;

  const SnagList({
    required this.id,
    required this.qualityUnitId,
    required this.unitLabel,
    this.currentRound = 1,
    this.overallStatus = SnagListStatus.snagging,
    this.processSteps = const [],
    this.rounds = const [],
    this.rooms = const [],
  });

  SnagList copyWith({List<SnagRound>? rounds}) {
    return SnagList(
      id: id,
      qualityUnitId: qualityUnitId,
      unitLabel: unitLabel,
      currentRound: currentRound,
      overallStatus: overallStatus,
      processSteps: processSteps,
      rounds: rounds ?? this.rounds,
      rooms: rooms,
    );
  }

  /// The round matching [currentRound] — the one the workspace should
  /// default to showing. Falls back to the last round if not found.
  SnagRound? get activeRound {
    for (final r in rounds) {
      if (r.roundNumber == currentRound) return r;
    }
    return rounds.isEmpty ? null : rounds.last;
  }

  factory SnagList.fromJson(Map<String, dynamic> j) => SnagList(
    id: j['id'] as int? ?? 0,
    qualityUnitId: j['qualityUnitId'] as int? ?? 0,
    unitLabel: j['unitLabel'] as String? ?? '',
    currentRound: j['currentRound'] as int? ?? 1,
    overallStatus: SnagListStatus.fromString(j['overallStatus'] as String? ?? 'snagging'),
    processSteps: (j['processSteps'] as List<dynamic>?)
            ?.map((e) => SnagProcessStep.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [],
    rounds: (j['rounds'] as List<dynamic>?)
            ?.map((e) => SnagRound.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [],
    rooms: ((j['unit'] as Map<String, dynamic>?)?['rooms'] as List<dynamic>?)
            ?.map((e) => SnagRoom.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [],
  );

  @override
  List<Object?> get props => [id, qualityUnitId, currentRound, overallStatus, rounds, rooms];
}

// ============================================================
// PROJECT ANALYTICS
// ============================================================

/// A generic `{label, count}` row — used for every `byX` breakdown and for
/// `agingBuckets`/`recurringSnags` in the analytics response, all of which
/// share this exact shape.
class SnagCountRow extends Equatable {
  final String label;
  final int count;
  const SnagCountRow({required this.label, required this.count});

  factory SnagCountRow.fromJson(Map<String, dynamic> j) =>
      SnagCountRow(label: j['label'] as String? ?? '', count: j['count'] as int? ?? 0);

  @override
  List<Object?> get props => [label, count];
}

class SnagBlockedUnit extends Equatable {
  final int listId;
  final String unitLabel;
  final int currentRound;
  final String status;
  const SnagBlockedUnit({
    required this.listId,
    required this.unitLabel,
    required this.currentRound,
    required this.status,
  });

  factory SnagBlockedUnit.fromJson(Map<String, dynamic> j) => SnagBlockedUnit(
    listId: j['listId'] as int? ?? 0,
    unitLabel: j['unitLabel'] as String? ?? '',
    currentRound: j['currentRound'] as int? ?? 1,
    status: j['status'] as String? ?? '',
  );

  @override
  List<Object?> get props => [listId, unitLabel, currentRound, status];
}

class SnagAnalyticsSummary extends Equatable {
  final int totalUnits;
  final int notReadyUnits;
  final int readyUnits;
  final int snaggingUnits;
  final int desnaggingUnits;
  final int customerInspectionReadyUnits;
  final int totalSnagPoints;
  final int openSnagPoints;
  final int rectifiedPendingDesnag;
  final int closedSnagPoints;
  final int notSatisfactoryPoints;
  final double averageOpenAgeDays;

  const SnagAnalyticsSummary({
    this.totalUnits = 0,
    this.notReadyUnits = 0,
    this.readyUnits = 0,
    this.snaggingUnits = 0,
    this.desnaggingUnits = 0,
    this.customerInspectionReadyUnits = 0,
    this.totalSnagPoints = 0,
    this.openSnagPoints = 0,
    this.rectifiedPendingDesnag = 0,
    this.closedSnagPoints = 0,
    this.notSatisfactoryPoints = 0,
    this.averageOpenAgeDays = 0,
  });

  factory SnagAnalyticsSummary.fromJson(Map<String, dynamic> j) => SnagAnalyticsSummary(
    totalUnits: j['totalUnits'] as int? ?? 0,
    notReadyUnits: j['notReadyUnits'] as int? ?? 0,
    readyUnits: j['readyUnits'] as int? ?? 0,
    snaggingUnits: j['snaggingUnits'] as int? ?? 0,
    desnaggingUnits: j['desnaggingUnits'] as int? ?? 0,
    customerInspectionReadyUnits: j['customerInspectionReadyUnits'] as int? ?? 0,
    totalSnagPoints: j['totalSnagPoints'] as int? ?? 0,
    openSnagPoints: j['openSnagPoints'] as int? ?? 0,
    rectifiedPendingDesnag: j['rectifiedPendingDesnag'] as int? ?? 0,
    closedSnagPoints: j['closedSnagPoints'] as int? ?? 0,
    notSatisfactoryPoints: j['notSatisfactoryPoints'] as int? ?? 0,
    averageOpenAgeDays: (j['averageOpenAgeDays'] as num?)?.toDouble() ?? 0,
  );

  @override
  List<Object?> get props => [
    totalUnits, notReadyUnits, readyUnits, snaggingUnits, desnaggingUnits,
    customerInspectionReadyUnits, totalSnagPoints, openSnagPoints,
    rectifiedPendingDesnag, closedSnagPoints, notSatisfactoryPoints, averageOpenAgeDays,
  ];
}

/// `GET /snag/:projectId/analytics` — project-wide aggregation the
/// dashboard previously couldn't show (no endpoint existed for it). Verified
/// directly against `snag.service.ts:getProjectAnalytics`.
///
/// Note: `summary.notReadyUnits` is computed backend-side by filtering on
/// the literal string `'unready'`
/// (`units.filter((unit) => unit.overallStatus === 'unready')`), which
/// matches [SnagListStatus.unready] — consistent with how [SnagUnitSummary]
/// parses the same field.
class SnagAnalytics extends Equatable {
  final SnagAnalyticsSummary summary;
  final List<SnagCountRow> byStatus;
  final List<SnagCountRow> byProcessStep;
  final List<SnagCountRow> byTower;
  final List<SnagCountRow> byFloor;
  final List<SnagCountRow> byRoom;
  final List<SnagCountRow> byActivity;
  final List<SnagCountRow> byPriority;
  final List<SnagCountRow> agingBuckets;
  final List<SnagCountRow> recurringSnags;
  final List<SnagBlockedUnit> blockedUnits;

  const SnagAnalytics({
    this.summary = const SnagAnalyticsSummary(),
    this.byStatus = const [],
    this.byProcessStep = const [],
    this.byTower = const [],
    this.byFloor = const [],
    this.byRoom = const [],
    this.byActivity = const [],
    this.byPriority = const [],
    this.agingBuckets = const [],
    this.recurringSnags = const [],
    this.blockedUnits = const [],
  });

  factory SnagAnalytics.fromJson(Map<String, dynamic> j) {
    List<SnagCountRow> rows(String key) => (j[key] as List<dynamic>?)
            ?.map((e) => SnagCountRow.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    return SnagAnalytics(
      summary: SnagAnalyticsSummary.fromJson(j['summary'] as Map<String, dynamic>? ?? {}),
      byStatus: rows('byStatus'),
      byProcessStep: rows('byProcessStep'),
      byTower: rows('byTower'),
      byFloor: rows('byFloor'),
      byRoom: rows('byRoom'),
      byActivity: rows('byActivity'),
      byPriority: rows('byPriority'),
      agingBuckets: rows('agingBuckets'),
      recurringSnags: rows('recurringSnags'),
      blockedUnits: (j['blockedUnits'] as List<dynamic>?)
              ?.map((e) => SnagBlockedUnit.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  @override
  List<Object?> get props => [summary, byStatus, byProcessStep, byTower, byFloor, byRoom, byActivity, byPriority, agingBuckets, recurringSnags, blockedUnits];
}
