import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/injection_container.dart';

// ─────────────────────────────────────── Cubit ──────────────────────────────
// The approvals feature is self-contained in this file — it owns its own
// Cubit + states so it can be pushed anywhere without extra DI wiring.

/// Base class for the approvals cubit state machine.
abstract class _ApprovalsState {}

/// Shown while the pending approvals list is being fetched.
class _ApprovalsLoading extends _ApprovalsState {}

/// Loaded successfully — holds the list of items and the set of selected IDs.
class _ApprovalsLoaded extends _ApprovalsState {
  final List<Map<String, dynamic>> items;

  /// IDs of entries the approver has ticked; drives bulk approve/reject.
  final Set<int> selected;
  _ApprovalsLoaded({required this.items, this.selected = const {}});

  /// Returns a new instance with optional overrides (immutable update pattern).
  _ApprovalsLoaded copyWith({List<Map<String, dynamic>>? items, Set<int>? selected}) =>
      _ApprovalsLoaded(
          items: items ?? this.items,
          selected: selected ?? this.selected);
}

/// Terminal error state — shows message + retry button.
class _ApprovalsError extends _ApprovalsState {
  final String message;
  _ApprovalsError(this.message);
}

/// Transient confirmation state — triggers a success snack then reloads.
class _ApprovalsDone extends _ApprovalsState {
  final String message;
  _ApprovalsDone(this.message);
}

/// Manages loading, selection, approval, and rejection of pending progress
/// entries for a given project. Scoped to [ProgressApprovalsPage].
class _ApprovalsCubit extends Cubit<_ApprovalsState> {
  final SetuApiClient _api;
  final int projectId;

  _ApprovalsCubit(this._api, this.projectId) : super(_ApprovalsLoading()) {
    // Load immediately on construction
    load();
  }

  /// Fetch pending approvals from the API and emit the loaded state.
  Future<void> load() async {
    emit(_ApprovalsLoading());
    try {
      final raw = await _api.getPendingApprovals(projectId);
      final items = raw.map((e) => e as Map<String, dynamic>).toList();
      emit(_ApprovalsLoaded(items: items));
    } catch (e) {
      emit(_ApprovalsError('Failed to load pending approvals: $e'));
    }
  }

  /// Toggle a single item in the selection set.
  void toggle(int logId) {
    final current = state;
    if (current is! _ApprovalsLoaded) return;
    final selected = Set<int>.from(current.selected);
    if (selected.contains(logId)) {
      selected.remove(logId);
    } else {
      selected.add(logId);
    }
    emit(current.copyWith(selected: selected));
  }

  /// Select all when none or some are selected; deselect all when all selected.
  void toggleAll() {
    final current = state;
    if (current is! _ApprovalsLoaded) return;
    final all = current.items.map((e) => e['id'] as int).toSet();
    // If everything is already selected, clear; otherwise select all
    final selected = current.selected.length == all.length
        ? <int>{}
        : all;
    emit(current.copyWith(selected: selected));
  }

  /// Approve the currently-selected entries via the API.
  Future<void> approve() async {
    final current = state;
    if (current is! _ApprovalsLoaded || current.selected.isEmpty) return;
    try {
      await _api.approveMeasurements(current.selected.toList());
      emit(_ApprovalsDone('${current.selected.length} entry(s) approved'));
    } catch (e) {
      emit(_ApprovalsError('Approval failed: $e'));
    }
  }

  /// Reject the currently-selected entries with a mandatory [reason] string.
  Future<void> reject(String reason) async {
    final current = state;
    if (current is! _ApprovalsLoaded || current.selected.isEmpty) return;
    try {
      await _api.rejectMeasurements(
          logIds: current.selected.toList(), reason: reason);
      emit(_ApprovalsDone('${current.selected.length} entry(s) rejected'));
    } catch (e) {
      emit(_ApprovalsError('Rejection failed: $e'));
    }
  }
}

// ─────────────────────────────────────── Page ───────────────────────────────

/// Progress Approvals page — queue of submitted progress logs that an approver
/// can bulk approve or reject.
///
/// Provides its own [_ApprovalsCubit] so the page can be pushed from anywhere.
class ProgressApprovalsPage extends StatelessWidget {
  final int projectId;
  final String projectName;

  const ProgressApprovalsPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      // Provision the cubit and kick off the load
      create: (_) => _ApprovalsCubit(sl<SetuApiClient>(), projectId),
      child: _ProgressApprovalsView(projectName: projectName),
    );
  }
}

/// Inner stateless view — consumes [_ApprovalsCubit] to render the list.
class _ProgressApprovalsView extends StatelessWidget {
  final String projectName;

  const _ProgressApprovalsView({required this.projectName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Progress Approvals',
                style:
                    TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            // Project name as subtitle for context
            Text(projectName,
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          // Manual refresh button
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<_ApprovalsCubit>().load(),
          ),
        ],
      ),
      body: BlocConsumer<_ApprovalsCubit, _ApprovalsState>(
        listener: (context, state) {
          // On success: show snack and reload the list
          if (state is _ApprovalsDone) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.green.shade700,
            ));
            // Reload the list so processed entries disappear
            context.read<_ApprovalsCubit>().load();
          }
          // On error: show a red snack with the message
          if (state is _ApprovalsError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red.shade700,
            ));
          }
        },
        builder: (context, state) {
          // Full-page spinner on initial load
          if (state is _ApprovalsLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          // Full-page error with retry
          if (state is _ApprovalsError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 12),
                  Text(state.message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () =>
                        context.read<_ApprovalsCubit>().load(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }
          // Guard: should not occur but prevents a blank screen
          if (state is! _ApprovalsLoaded) {
            return const SizedBox.shrink();
          }

          final items = state.items;
          final selected = state.selected;

          // All-clear empty state
          if (items.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 64,
                      color: Colors.green.shade300),
                  const SizedBox(height: 12),
                  const Text('No pending approvals',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }

          return Column(
            children: [
              // ── Bulk selection bar ───────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 10),
                color: Theme.of(context).colorScheme.surfaceContainerLow,
                child: Row(
                  children: [
                    // "Select all" checkbox — tristate when partially selected
                    Checkbox(
                      value: selected.length == items.length &&
                          items.isNotEmpty,
                      tristate: selected.isNotEmpty &&
                          selected.length < items.length,
                      onChanged: (_) =>
                          context.read<_ApprovalsCubit>().toggleAll(),
                    ),
                    // Shows pending count or selection count
                    Text(
                      selected.isEmpty
                          ? '${items.length} pending'
                          : '${selected.length} selected',
                      style: const TextStyle(fontSize: 13),
                    ),
                    const Spacer(),
                    // Bulk action buttons — only visible when items are selected
                    if (selected.isNotEmpty) ...[
                      // Reject button — opens dialog to capture reason
                      OutlinedButton(
                        onPressed: () =>
                            _showRejectDialog(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red.shade700,
                          side: BorderSide(
                              color: Colors.red.shade400),
                          textStyle: const TextStyle(fontSize: 12),
                        ),
                        child: const Text('Reject'),
                      ),
                      const SizedBox(width: 8),
                      // Approve button — dispatches approval immediately
                      FilledButton(
                        onPressed: () =>
                            context.read<_ApprovalsCubit>().approve(),
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.green.shade700,
                          textStyle: const TextStyle(fontSize: 12),
                        ),
                        child: Text('Approve (${selected.length})'),
                      ),
                    ],
                  ],
                ),
              ),
              // ── Pending approval list ────────────────────────────────────
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final item = items[i];
                    final id = item['id'] as int;
                    final isSelected = selected.contains(id);
                    return _PendingApprovalTile(
                      item: item,
                      isSelected: isSelected,
                      // Tapping the row toggles its selection
                      onToggle: () =>
                          context.read<_ApprovalsCubit>().toggle(id),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Shows an [AlertDialog] requiring the approver to enter a rejection reason
  /// before the cubit dispatches the reject call.
  void _showRejectDialog(BuildContext context) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Progress Entry'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Reason *',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              // Prevent submission without a reason
              if (ctrl.text.trim().isEmpty) return;
              context
                  .read<_ApprovalsCubit>()
                  .reject(ctrl.text.trim());
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade700),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────── Tile ───────────────────────────────

/// Single row in the pending approvals list.
/// Shows a checkbox, activity name, date, quantity, and submitter name.
/// Highlighted with a tinted background when selected.
class _PendingApprovalTile extends StatelessWidget {
  final Map<String, dynamic> item;
  final bool isSelected;
  final VoidCallback onToggle;

  const _PendingApprovalTile({
    required this.item,
    required this.isSelected,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Support both flat and nested API response shapes
    // The backend returns MeasurementProgress with nested relations:
    //   item.measurementElement.activity.activityName
    //   item.measurementElement.boqItem.uom
    //   item.measurementElement.epsNode.label
    final me = item['measurementElement'] as Map<String, dynamic>?;
    final meAct = me?['activity'] as Map<String, dynamic>?;
    final meBoq = me?['boqItem'] as Map<String, dynamic>?;
    final meLoc = me?['epsNode'] as Map<String, dynamic>?;

    final activityName =
        item['activityName'] as String? ??
        item['activity']?['name'] as String? ??
        meAct?['activityName'] as String? ??
        meAct?['name'] as String? ??
        me?['elementName'] as String? ??
        '—';
    final activityCode =
        item['activityCode'] as String? ??
        item['activity']?['activityCode'] as String? ??
        meAct?['activityCode'] as String?;
    final date = item['date'] as String? ?? item['logDate'] as String? ?? '—';
    final qtyRaw = item['quantity'] ?? item['executedQty'] ?? item['qty'];
    final qty = qtyRaw != null ? qtyRaw.toString() : '—';
    // UOM: try flat fields first, then nested boqItem
    final rawUnit = item['unit'] ?? item['uom'] ?? meBoq?['uom'];
    final unit = (rawUnit != null && rawUnit.toString() != 'null')
        ? rawUnit.toString()
        : '';
    final submittedBy = item['submittedBy'] as String? ??
        item['user']?['username'] as String? ??
        item['submittedByName'] as String? ??
        item['updatedBy'] as String?;
    // Location / WBS context
    final location = item['epsNodeLabel'] as String? ??
        item['locationLabel'] as String? ??
        item['epsNode']?['label'] as String? ??
        meLoc?['label'] as String? ??
        meLoc?['name'] as String?;
    final wbsPath = item['wbsPath'] as String? ?? item['wbsCode'] as String?;
    final remarks = item['remarks'] as String? ?? item['notes'] as String?;
    // Cumulative progress if available
    final cumulative = item['cumulativeQuantity'] ?? item['cumulative'];
    final targetQty = item['targetQuantity'] ?? item['plannedQuantity'];

    return InkWell(
      onTap: onToggle,
      child: Container(
        color: isSelected
            ? theme.colorScheme.primaryContainer.withValues(alpha: 0.3)
            : null,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Individual selection checkbox
            Checkbox(value: isSelected, onChanged: (_) => onToggle()),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Activity name + optional code
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(activityName,
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600)),
                      ),
                      if (activityCode != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(activityCode,
                              style: const TextStyle(
                                  fontSize: 10, fontWeight: FontWeight.w500)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  // Location / WBS path
                  if (location != null || wbsPath != null) ...[
                    Row(
                      children: [
                        Icon(Icons.location_on_outlined,
                            size: 12,
                            color: theme.colorScheme.primary
                                .withValues(alpha: 0.7)),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            [if (wbsPath != null) wbsPath,
                             if (location != null) location]
                                .join(' · '),
                            style: theme.textTheme.bodySmall?.copyWith(
                                fontSize: 11,
                                color: theme.colorScheme.primary
                                    .withValues(alpha: 0.8)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                  ],
                  // Date + quantity row
                  Row(
                    children: [
                      Icon(Icons.calendar_today_outlined,
                          size: 12,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.5)),
                      const SizedBox(width: 4),
                      Text(date,
                          style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.6))),
                      const SizedBox(width: 12),
                      Icon(Icons.straighten_outlined,
                          size: 12,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.5)),
                      const SizedBox(width: 4),
                      Text(
                          unit.isNotEmpty ? '$qty $unit' : qty,
                          style: theme.textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w600)),
                      // Cumulative vs target if available
                      if (cumulative != null && targetQty != null) ...[
                        const SizedBox(width: 8),
                        Text(
                          '(cum: $cumulative / $targetQty $unit)',
                          style: theme.textTheme.bodySmall?.copyWith(
                              fontSize: 10,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5)),
                        ),
                      ],
                    ],
                  ),
                  // Submitted-by line
                  if (submittedBy != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'By: $submittedBy',
                      style: theme.textTheme.bodySmall?.copyWith(
                          fontSize: 11,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.5)),
                    ),
                  ],
                  // Remarks if present
                  if (remarks != null && remarks.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.notes_outlined,
                              size: 12,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5)),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              remarks,
                              style: theme.textTheme.bodySmall?.copyWith(
                                  fontSize: 11,
                                  color: theme.colorScheme.onSurface
                                      .withValues(alpha: 0.7)),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
