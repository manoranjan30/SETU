import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/database/app_database.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/progress/data/models/execution_breakdown.dart';
// Prefixed to avoid clashing with Drift-generated ProgressEntry/SyncStatus
import 'package:setu_mobile/features/progress/data/models/progress_model.dart' as model;
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/widgets/breadcrumb_widget.dart'
    as widgets;
import 'package:setu_mobile/features/sync/presentation/pages/sync_log_page.dart';
import 'package:setu_mobile/injection_container.dart';

/// Progress Entry Page — the form a site engineer uses to record how much
/// work was completed today against a WBS activity.
///
/// The form operates in one of two modes:
///   • **Master schedule mode** — one text field per BOQ plan linked to the
///     activity. Data is saved offline-first via [ProgressBloc].
///   • **Micro schedule mode** — shows the execution breakdown table (vendor →
///     BOQ item → micro-activity) and submits directly to the API.
///
/// The mode is determined at startup by querying [SetuApiClient.hasMicroSchedule].
class ProgressEntryPage extends StatefulWidget {
  final Activity activity;
  final Project project;

  /// The EPS node the user was viewing when they tapped this activity.
  /// This is the correct node to pass to the execution breakdown endpoint
  /// (matches what the web frontend sends as selectedEpsIds[0]).
  final int currentEpsNodeId;

  const ProgressEntryPage({
    super.key,
    required this.activity,
    required this.project,
    required this.currentEpsNodeId,
  });

  @override
  State<ProgressEntryPage> createState() => _ProgressEntryPageState();
}

class _ProgressEntryPageState extends State<ProgressEntryPage> {
  // Form key used for validation before submitting master-schedule entries
  final _formKey = GlobalKey<FormState>();
  final _remarksController = TextEditingController();
  DateTime _selectedDate = DateTime.now();

  // Master schedule: one controller per plan, keyed by planId
  final Map<int, TextEditingController> _planControllers = {};

  // Micro schedule state
  bool? _hasMicro; // null=checking, false=master, true=micro
  ExecutionBreakdown? _breakdown;
  bool _microLoading = false;
  bool _microSubmitting = false;
  String? _microError;
  // Keyed by "${boqIdx}_${type}_${id|'balance'}" for each breakdown line item
  final Map<String, TextEditingController> _microControllers = {};

  // Local unsynced qty per boqItemId (pending/failed in Drift DB)
  final Map<int, double> _localPendingQty = {};

  // True while the "Mark as Complete" API call is in flight
  bool _markCompleteLoading = false;

  @override
  void initState() {
    super.initState();
    // Initialise one text controller per BOQ plan (master schedule mode)
    for (final plan in widget.activity.plans) {
      _planControllers[plan.planId] = TextEditingController();
    }
    // Query Drift for locally-saved unsynced quantities to warn the user
    _loadLocalPendingQty();
    // Determine whether to show master or micro mode
    _checkMicroSchedule();
  }

  /// Query Drift for any unsynced entries so we can warn the user that those
  /// quantities are not yet reflected in the server balance.
  Future<void> _loadLocalPendingQty() async {
    final db = sl<AppDatabase>();
    // Filter by activityId only in Drift, then filter syncStatus in Dart
    // (avoids relying on Expression<bool> & / | extension availability)
    final rows = await (db.select(db.progressEntries)
          ..where((t) => t.activityId.equals(widget.activity.id)))
        .get();
    if (!mounted) return;
    // Only count entries that are pending or failed (i.e. not yet synced)
    final pendingValues = {
      model.SyncStatus.pending.value,
      model.SyncStatus.failed.value,
    };
    final Map<int, double> map = {};
    for (final row in rows) {
      if (!pendingValues.contains(row.syncStatus)) continue;
      final key = row.boqItemId;
      map[key] = (map[key] ?? 0) + row.quantity;
    }
    setState(() => _localPendingQty.addAll(map));
  }

  /// Detect whether this activity has a micro schedule.
  /// On network error, silently fall back to master mode.
  Future<void> _checkMicroSchedule() async {
    try {
      final hasMicro =
          await sl<SetuApiClient>().hasMicroSchedule(widget.activity.id);
      if (!mounted) return;
      setState(() => _hasMicro = hasMicro);
      // Immediately fetch the breakdown if micro schedule is active
      if (hasMicro) _fetchBreakdown();
    } catch (_) {
      // Network error — fall back to master mode silently
      if (!mounted) return;
      setState(() => _hasMicro = false);
    }
  }

  /// Fetch the execution breakdown for this activity / EPS node.
  /// Populates [_breakdown] and creates one controller per breakdown line item.
  Future<void> _fetchBreakdown() async {
    setState(() {
      _microLoading = true;
      _microError = null;
    });
    try {
      final raw = await sl<SetuApiClient>().getExecutionBreakdown(
        activityId: widget.activity.id,
        epsNodeId: widget.currentEpsNodeId,
      );
      final bd = ExecutionBreakdown.fromJson(raw);
      if (!mounted) return;

      // Initialise one controller per line item (vendor_boq_type_id)
      final controllers = <String, TextEditingController>{};
      for (int vi = 0; vi < bd.vendorBreakdown.length; vi++) {
        final vb = bd.vendorBreakdown[vi];
        for (int bi = 0; bi < vb.boqBreakdown.length; bi++) {
          for (final item in vb.boqBreakdown[bi].items) {
            final key = '${vi}_${bi}_${item.type}_${item.id ?? 'balance'}';
            controllers[key] = TextEditingController();
          }
        }
      }
      setState(() {
        _breakdown = bd;
        _microControllers.addAll(controllers);
        _microLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _microLoading = false;
        _microError = 'Failed to load breakdown: $e';
      });
    }
  }

  @override
  void dispose() {
    // Dispose all dynamically created text controllers to prevent memory leaks
    for (final c in _planControllers.values) {
      c.dispose();
    }
    for (final c in _microControllers.values) {
      c.dispose();
    }
    _remarksController.dispose();
    super.dispose();
  }

  // ── Master schedule submit ───────────────────────────────────────────────────

  /// Validates the form and dispatches [SaveMultipleProgress] for all BOQ
  /// plans that have a positive quantity entered.
  /// Data is saved offline-first via the Drift database.
  void _handleSubmit() {
    if (!_formKey.currentState!.validate()) return;

    final entries = <model.ProgressEntry>[];
    for (final plan in widget.activity.plans) {
      final qty =
          double.tryParse(_planControllers[plan.planId]?.text ?? '') ?? 0;
      // Skip plans where the user left the field empty or entered 0
      if (qty <= 0) continue;
      // microActivityId column is repurposed to carry planId to the sync layer
      entries.add(model.ProgressEntry(
        projectId: widget.project.id,
        activityId: widget.activity.id,
        epsNodeId: widget.currentEpsNodeId,
        boqItemId: plan.boqItemId,
        microActivityId: plan.planId,
        quantity: qty,
        date: _selectedDate,
        remarks: _remarksController.text.isNotEmpty
            ? _remarksController.text
            : null,
        createdAt: DateTime.now(),
      ));
    }

    // At least one entry must have a positive quantity
    if (entries.isEmpty) {
      _showEmptySnack();
      return;
    }
    // Dispatch the offline-first save event
    context.read<ProgressBloc>().add(SaveMultipleProgress(entries));
  }

  // ── Micro schedule submit ────────────────────────────────────────────────────

  /// Validates the form, collects non-zero micro entries, and calls the API
  /// directly (micro progress bypasses the offline Drift queue).
  Future<void> _handleMicroSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final bd = _breakdown;
    if (bd == null) return;

    // Build the list of entries from controller values
    final entries = <Map<String, dynamic>>[];
    for (int vi = 0; vi < bd.vendorBreakdown.length; vi++) {
      final vb = bd.vendorBreakdown[vi];
      for (int bi = 0; bi < vb.boqBreakdown.length; bi++) {
        final boqBd = vb.boqBreakdown[bi];
        for (final item in boqBd.items) {
          final key = '${vi}_${bi}_${item.type}_${item.id ?? 'balance'}';
          final qty =
              double.tryParse(_microControllers[key]?.text ?? '') ?? 0;
          if (qty <= 0) continue;
          entries.add({
            // vendorId matches the web app's submission payload so the backend
            // can attribute progress to the correct vendor/work-order.
            if (vb.vendorId != null) 'vendorId': vb.vendorId,
            'boqItemId': boqBd.boqItemId,
            if (boqBd.workOrderItemId != null)
              'workOrderItemId': boqBd.workOrderItemId,
            // null for direct-balance items (no micro activity ID)
            'microActivityId': item.isMicro ? item.id : null,
            'quantity': qty,
          });
        }
      }
    }

    if (entries.isEmpty) {
      _showEmptySnack();
      return;
    }

    setState(() => _microSubmitting = true);
    try {
      // Micro progress is sent directly to the API — no offline queueing
      await sl<SetuApiClient>().saveMicroProgress(
        projectId: widget.project.id,
        activityId: widget.activity.id,
        epsNodeId: widget.currentEpsNodeId,
        entries: entries,
        date: DateFormat('yyyy-MM-dd').format(_selectedDate),
        remarks: _remarksController.text.isNotEmpty
            ? _remarksController.text
            : null,
      );
      if (!mounted) return;
      setState(() => _microSubmitting = false);
      _showMicroSuccessDialog();
    } catch (e) {
      if (!mounted) return;
      setState(() => _microSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Failed to save: $e'),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
      ));
    }
  }

  /// Snack shown when the user taps Submit without entering any quantity.
  void _showEmptySnack() {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Enter quantity for at least one item'),
      backgroundColor: AppColors.error,
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── Mark as Complete ─────────────────────────────────────────────────────────

  /// Confirms with the user, then calls [SetuApiClient.markActivityComplete].
  /// On success shows a snack and pops back (activity is done — no more entry).
  /// Mirrors the web app's "Mark Complete" action on activity cards.
  Future<void> _handleMarkComplete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Mark as Complete'),
        content: Text(
          'Are you sure you want to mark "${widget.activity.name}" as fully COMPLETED?\n\n'
          'This will set the actual finish date to today and lock further progress entries.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.success),
            child: const Text('Mark Complete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _markCompleteLoading = true);
    try {
      await sl<SetuApiClient>().markActivityComplete(widget.activity.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Activity marked as Complete'),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
      ));
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Failed to mark complete: $e'),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
      ));
    } finally {
      if (mounted) setState(() => _markCompleteLoading = false);
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Progress Entry'),
        actions: [
          // Mark as Complete — shown only when activity is not already COMPLETED.
          // Mirrors the web app's "Mark Complete" button on each activity card.
          if (widget.activity.status != 'COMPLETED')
            _markCompleteLoading
                ? const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton(
                    icon: const Icon(Icons.check_circle_outline_rounded),
                    tooltip: 'Mark as Complete',
                    color: AppColors.success,
                    onPressed: _handleMarkComplete,
                  ),
          // Live sync status indicator — tapping navigates to the sync log
          widgets.LiveSyncStatusIndicator(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SyncLogPage()),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: BlocConsumer<ProgressBloc, ProgressState>(
        listener: (context, state) {
          // Show success dialog when master-schedule data has been saved
          if (state is ProgressSaved) {
            _showSuccessDialog(state);
          // Show error snack if the save operation failed
          } else if (state is ProgressError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
            ));
          }
        },
        builder: (context, state) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(AppDimensions.paddingMD),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Activity info card with project name and current progress
                  _buildActivityInfoCard(),
                  const SizedBox(height: 20),
                  // Date picker field — defaults to today
                  _buildDatePicker(),
                  const SizedBox(height: 20),
                  // Routes to either micro breakdown or master plans UI
                  _buildContentSection(),
                  const SizedBox(height: 16),
                  // Optional remarks input
                  _buildRemarksInput(),
                  const SizedBox(height: 24),
                  // Primary submit button — adapts label and handler to the mode
                  _buildSubmitButton(state),
                  // Sync progress indicator shown while offline entries sync
                  if (state is ProgressSyncing) ...[
                    const SizedBox(height: 16),
                    _buildSyncProgress(state),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Route master vs micro ────────────────────────────────────────────────────

  /// Shows a spinner while [_hasMicro] is being determined, then delegates
  /// to either [_buildBreakdownSection] (micro) or [_buildPlansSection] (master).
  Widget _buildContentSection() {
    if (_hasMicro == null) {
      // Still checking — show a centred spinner
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 32),
          child: CircularProgressIndicator(),
        ),
      );
    }
    if (_hasMicro == true) return _buildBreakdownSection();
    return _buildPlansSection();
  }

  // ── Activity info card ───────────────────────────────────────────────────────

  /// Card at the top of the form showing the activity name, project name,
  /// completion percentage badge, and a linear progress bar.
  Widget _buildActivityInfoCard() {
    final progress = widget.activity.actualProgress ?? 0;
    final progressPercent = (progress * 100).toStringAsFixed(0);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withOpacity(0.1),
            AppColors.primary.withOpacity(0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Activity icon
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.assignment_rounded,
                    color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Activity name
                    Text(widget.activity.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 2),
                    // Project name as subtitle
                    Text(widget.project.name,
                        style: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 12)),
                  ],
                ),
              ),
              // Completion percentage badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text('$progressPercent%',
                    style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          // Progress bar — only shown when actual progress data exists
          if (widget.activity.actualProgress != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: AppColors.divider,
                // Green when complete, primary blue otherwise
                valueColor: AlwaysStoppedAnimation<Color>(
                    progress >= 1.0 ? AppColors.success : AppColors.primary),
                minHeight: 5,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Date picker ──────────────────────────────────────────────────────────────

  /// Tappable date field using [InputDecorator] for consistent form styling.
  Widget _buildDatePicker() {
    return InkWell(
      onTap: _selectDate,
      borderRadius: BorderRadius.circular(AppDimensions.inputRadius),
      child: InputDecorator(
        decoration: const InputDecoration(
          labelText: 'Date',
          prefixIcon: Icon(Icons.calendar_today_rounded),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Display the selected date in a human-readable format
            Text(DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate),
                style: Theme.of(context).textTheme.bodyLarge),
            const Icon(Icons.chevron_right_rounded,
                color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  /// Opens the system date picker constrained to the last 30 days.
  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  // ── Micro breakdown UI ───────────────────────────────────────────────────────

  /// Top-level widget for micro schedule mode.
  /// Shows a loading indicator, error state, or the vendor breakdown list.
  Widget _buildBreakdownSection() {
    // Show spinner while the breakdown API call is in-flight
    if (_microLoading) {
      return const Center(
        child:
            Padding(padding: EdgeInsets.symmetric(vertical: 32), child: CircularProgressIndicator()),
      );
    }

    // Show inline error with a Retry button
    if (_microError != null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.error.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.error.withOpacity(0.3)),
        ),
        child: Row(children: [
          const Icon(Icons.error_outline, color: AppColors.error),
          const SizedBox(width: 12),
          Expanded(
              child: Text(_microError!,
                  style:
                      const TextStyle(color: AppColors.error, fontSize: 13))),
          TextButton(onPressed: _fetchBreakdown, child: const Text('Retry')),
        ]),
      );
    }

    final bd = _breakdown;
    // No vendor breakdown — activity has a micro schedule but no Work Orders yet
    if (bd == null || !bd.hasVendors) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.warning.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.warning.withOpacity(0.3)),
        ),
        child: const Row(children: [
          Icon(Icons.info_outline_rounded, color: AppColors.warning, size: 20),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Micro schedule active — no Work Order assignments found yet. '
              'Link this activity to a Work Order to enable progress entry.',
              style: TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          ),
        ]),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Informational banner reminding the user they are in micro mode
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.blue.withOpacity(0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.blue.withOpacity(0.25)),
          ),
          child: const Row(children: [
            Icon(Icons.account_tree_rounded, color: Colors.blue, size: 16),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Micro Schedule active — enter progress per Work Order below.',
                style: TextStyle(color: Colors.blue, fontSize: 12),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        // One section per vendor / Work Order
        ...List.generate(
          bd.vendorBreakdown.length,
          (vi) => _buildVendorSection(vi, bd.vendorBreakdown[vi]),
        ),
      ],
    );
  }

  /// Section header + BOQ breakdown cards for a single vendor / Work Order.
  Widget _buildVendorSection(int vendorIdx, VendorBreakdown vb) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Vendor / WO header bar
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: theme.colorScheme.secondaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              // Different icon for direct vs sub-contracted work
              Icon(
                vb.isDirect
                    ? Icons.engineering_outlined
                    : Icons.handshake_outlined,
                size: 16,
                color: theme.colorScheme.onSecondaryContainer,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Vendor / contractor name
                    Text(
                      vb.vendorName,
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: theme.colorScheme.onSecondaryContainer,
                      ),
                    ),
                    // Work Order number if available
                    if (vb.workOrderNumber != null)
                      Text(
                        'WO: ${vb.workOrderNumber}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontSize: 11,
                          color: theme.colorScheme.onSecondaryContainer
                              .withOpacity(0.7),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // One card per BOQ item under this vendor
        ...List.generate(
          vb.boqBreakdown.length,
          (bi) => _buildBoqBreakdownCard(vendorIdx, bi, vb.boqBreakdown[bi]),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  /// Card for a single BOQ item within a vendor breakdown.
  /// Shows scope chips, an overall progress bar, and per-item input rows.
  Widget _buildBoqBreakdownCard(int vendorIdx, int boqIdx, BoqItemBreakdown boqBd) {
    // Compute how much has been executed across all items in this BOQ group
    final totalExec =
        boqBd.items.fold<double>(0, (s, item) => s + item.executedQty);
    final progressPct = boqBd.totalScope > 0
        ? (totalExec / boqBd.totalScope).clamp(0.0, 1.0)
        : 0.0;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.divider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // BOQ description + unit of measure badge
            Row(children: [
              Expanded(
                child: Text(boqBd.description,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
              ),
              if (boqBd.uom != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(boqBd.uom!,
                      style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ),
            ]),
            const SizedBox(height: 10),

            // Overall progress bar for this BOQ item
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progressPct,
                backgroundColor: AppColors.divider,
                valueColor: AlwaysStoppedAnimation<Color>(
                    progressPct >= 1.0
                        ? AppColors.success
                        : AppColors.primary),
                minHeight: 5,
              ),
            ),
            const SizedBox(height: 8),

            // Scope summary chips (Total / Micro / Direct / Done)
            Row(children: [
              _statChip('Total', boqBd.totalScope.toStringAsFixed(2)),
              const SizedBox(width: 5),
              _statChip('Micro', boqBd.allocatedToMicro.toStringAsFixed(2),
                  color: Colors.blue),
              const SizedBox(width: 5),
              _statChip('Direct', boqBd.balanceDirect.toStringAsFixed(2),
                  color: AppColors.warning),
              const SizedBox(width: 5),
              _statChip('Done', totalExec.toStringAsFixed(2),
                  color: AppColors.success),
            ]),
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 4),

            // One input row per micro-activity or direct-balance item
            ...List.generate(boqBd.items.length,
                (j) => _buildBreakdownItemRow(vendorIdx, boqIdx, boqBd.items[j], boqBd)),
          ],
        ),
      ),
    );
  }

  /// Row for a single micro or direct-balance breakdown item.
  /// Shows a colour-coded dot, name, type badge, qty chips, and an input field
  /// (or a "fully used" indicator when balance is zero).
  Widget _buildBreakdownItemRow(
      int vendorIdx, int boqIdx, BreakdownItem item, BoqItemBreakdown boqBd) {
    final key = '${vendorIdx}_${boqIdx}_${item.type}_${item.id ?? 'balance'}';
    final controller = _microControllers[key];
    // Clamp to 0 so we never show a negative balance to the user
    final balance = item.balanceQty.clamp(0.0, double.maxFinite);
    final fullyUsed = balance <= 0;
    // Blue dot for micro-activity items, amber dot for direct-balance items
    final dotColor =
        item.isMicro ? Colors.blue[600]! : const Color(0xFFF59E0B);

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Item name row with coloured dot and MICRO/DIRECT badge
          Row(children: [
            Container(
              width: 8,
              height: 8,
              decoration:
                  BoxDecoration(color: dotColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(item.name,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w500)),
            ),
            // Type badge distinguishes micro activities from direct balance
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: dotColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                item.isMicro ? 'MICRO' : 'DIRECT',
                style: TextStyle(
                    color: dotColor,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5),
              ),
            ),
          ]),
          const SizedBox(height: 6),

          // Scope / Done / Balance chips
          Row(children: [
            _statChip('Scope', item.allocatedQty.toStringAsFixed(2)),
            const SizedBox(width: 4),
            _statChip('Done', item.executedQty.toStringAsFixed(2),
                color: AppColors.success),
            const SizedBox(width: 4),
            _statChip('Balance', balance.toStringAsFixed(2),
                color: fullyUsed
                    ? AppColors.textSecondary
                    : AppColors.info),
          ]),
          const SizedBox(height: 8),

          // Either show "fully used" message or an input field
          if (fullyUsed)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.success.withOpacity(0.07),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.success.withOpacity(0.3)),
              ),
              child: const Row(children: [
                Icon(Icons.check_circle_outline_rounded,
                    size: 14, color: AppColors.success),
                SizedBox(width: 6),
                Text('Fully used — no balance remaining',
                    style: TextStyle(color: AppColors.success, fontSize: 11)),
              ]),
            )
          else if (controller != null)
            // Quantity input field capped at the remaining balance
            TextFormField(
              controller: controller,
              decoration: InputDecoration(
                labelText:
                    'Enter Qty  (max ${balance.toStringAsFixed(2)})',
                prefixIcon: const Icon(Icons.straighten_rounded, size: 18),
                suffixText: boqBd.uom,
                isDense: true,
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              textInputAction: TextInputAction.next,
              validator: (value) {
                if (value == null || value.isEmpty) return null;
                final qty = double.tryParse(value);
                if (qty == null || qty <= 0) {
                  return 'Enter a valid positive number';
                }
                // Prevent over-entry beyond available balance
                if (qty > balance) {
                  return 'Exceeds balance '
                      '(${balance.toStringAsFixed(2)} ${boqBd.uom ?? ''})';
                }
                return null;
              },
            ),
        ],
      ),
    );
  }

  // ── Master schedule plans UI ─────────────────────────────────────────────────

  /// Master-schedule mode: shows one [_buildPlanCard] per BOQ plan.
  Widget _buildPlansSection() {
    final plans = widget.activity.plans;

    // Edge-case: activity has no plans configured
    if (plans.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.warning.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.warning.withOpacity(0.3)),
        ),
        child: const Row(children: [
          Icon(Icons.info_outline_rounded, color: AppColors.warning, size: 20),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'No BOQ plans are linked to this activity. '
              'Progress cannot be entered until plans are configured.',
              style: TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          ),
        ]),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section heading with plan count
        Text('BOQ Plans  (${plans.length})',
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        // One card per BOQ plan
        ...plans.map((plan) => _buildPlanCard(plan)),
      ],
    );
  }

  /// Card for a single master-schedule BOQ plan.
  /// Shows a stacked progress bar (approved in blue, pending in amber),
  /// quantity chips, pending/offline warnings, and a quantity input field.
  Widget _buildPlanCard(ActivityPlan plan) {
    final balance = plan.balance;
    // How much has been saved locally but not yet synced
    final localQty = _localPendingQty[plan.boqItemId] ?? 0;
    final fullyUsed = balance <= 0;

    // Fraction of planned qty that has been approved
    final approvedPct = plan.plannedQuantity > 0
        ? (plan.approvedQty / plan.plannedQuantity).clamp(0.0, 1.0)
        : 0.0;
    // Fraction including pending (approved + awaiting approval)
    final pendingPct = plan.plannedQuantity > 0
        ? ((plan.approvedQty + plan.pendingQty) / plan.plannedQuantity)
            .clamp(0.0, 1.0)
        : 0.0;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
            color: fullyUsed
                ? AppColors.success.withOpacity(0.4)
                : AppColors.divider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Plan description + unit of measure badge
            Row(children: [
              Expanded(
                child: Text(plan.description,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
              ),
              if (plan.uom != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(plan.uom!,
                      style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ),
            ]),
            const SizedBox(height: 10),

            // Stacked progress bars: amber (pending) behind blue (approved)
            Stack(children: [
              // Amber layer covers pending + approved range
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: pendingPct.toDouble(),
                  backgroundColor: AppColors.divider,
                  valueColor: AlwaysStoppedAnimation<Color>(
                      AppColors.warning.withOpacity(0.5)),
                  minHeight: 7,
                ),
              ),
              // Blue (or green) layer covers only the approved range
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: approvedPct.toDouble(),
                  backgroundColor: Colors.transparent,
                  valueColor: AlwaysStoppedAnimation<Color>(
                      approvedPct >= 1.0
                          ? AppColors.success
                          : AppColors.primary),
                  minHeight: 7,
                ),
              ),
            ]),
            const SizedBox(height: 8),

            // Four quantity chips: Planned / Approved / Pending / Balance
            Row(children: [
              _statChip('Planned', plan.plannedQuantity.toStringAsFixed(2)),
              const SizedBox(width: 6),
              _statChip('Approved', plan.approvedQty.toStringAsFixed(2),
                  color: AppColors.success),
              const SizedBox(width: 6),
              _statChip('Pending', plan.pendingQty.toStringAsFixed(2),
                  color: AppColors.warning),
              const SizedBox(width: 6),
              _statChip('Balance', balance.toStringAsFixed(2),
                  color: fullyUsed
                      ? AppColors.textSecondary
                      : AppColors.info),
            ]),

            // Notice when there are entries awaiting manager approval
            if (plan.pendingQty > 0) ...[
              const SizedBox(height: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                  border:
                      Border.all(color: AppColors.warning.withOpacity(0.25)),
                ),
                child: Row(children: [
                  const Icon(Icons.hourglass_top_rounded,
                      size: 14, color: AppColors.warning),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${plan.pendingQty.toStringAsFixed(2)} ${plan.uom ?? ''} '
                      'awaiting manager approval — included in balance.',
                      style: const TextStyle(
                          color: AppColors.warning, fontSize: 11),
                    ),
                  ),
                ]),
              ),
            ],

            // Notice when entries are saved locally but not yet synced
            if (localQty > 0) ...[
              const SizedBox(height: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.info.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                  border:
                      Border.all(color: AppColors.info.withOpacity(0.25)),
                ),
                child: Row(children: [
                  const Icon(Icons.cloud_upload_outlined,
                      size: 14, color: AppColors.info),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${localQty.toStringAsFixed(2)} ${plan.uom ?? ''} '
                      'saved offline (not yet synced). '
                      'Not reflected in the balance above.',
                      style: const TextStyle(
                          color: AppColors.info, fontSize: 11),
                    ),
                  ),
                ]),
              ),
            ],

            const SizedBox(height: 12),

            // Quantity input field (or "fully submitted" notice)
            if (fullyUsed)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.07),
                  borderRadius: BorderRadius.circular(8),
                  border:
                      Border.all(color: AppColors.success.withOpacity(0.3)),
                ),
                child: const Row(children: [
                  Icon(Icons.check_circle_outline_rounded,
                      size: 16, color: AppColors.success),
                  SizedBox(width: 8),
                  Text('Fully submitted — no balance remaining',
                      style: TextStyle(
                          color: AppColors.success,
                          fontSize: 12,
                          fontWeight: FontWeight.w500)),
                ]),
              )
            else
              // Quantity entry field — validates that the value does not
              // exceed the remaining balance for this plan
              TextFormField(
                controller: _planControllers[plan.planId],
                decoration: InputDecoration(
                  labelText:
                      'Enter Qty  (max ${balance.toStringAsFixed(2)})',
                  prefixIcon: const Icon(Icons.straighten_rounded, size: 18),
                  suffixText: plan.uom,
                  isDense: true,
                ),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                textInputAction: TextInputAction.next,
                validator: (value) {
                  if (value == null || value.isEmpty) return null;
                  final qty = double.tryParse(value);
                  if (qty == null || qty <= 0) {
                    return 'Enter a valid positive number';
                  }
                  // Prevent over-entry
                  if (qty > balance) {
                    return 'Exceeds balance '
                        '(${balance.toStringAsFixed(2)} ${plan.uom ?? ''})';
                  }
                  return null;
                },
              ),
          ],
        ),
      ),
    );
  }

  // ── Shared stat chip ─────────────────────────────────────────────────────────

  /// Small labelled value chip used in both master and micro breakdown cards.
  Widget _statChip(String label, String value, {Color? color}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        decoration: BoxDecoration(
          color: (color ?? AppColors.primary).withOpacity(0.07),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Small grey label above the value
            Text(label,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 10)),
            // Bold coloured value
            Text(value,
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: color ?? AppColors.primary),
                overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }

  // ── Remarks ──────────────────────────────────────────────────────────────────

  /// Optional free-text remarks field shared between master and micro modes.
  Widget _buildRemarksInput() {
    return TextFormField(
      controller: _remarksController,
      decoration: const InputDecoration(
        labelText: 'Remarks (Optional)',
        prefixIcon: Icon(Icons.notes_rounded),
        alignLabelWithHint: true,
      ),
      maxLines: 3,
      textInputAction: TextInputAction.done,
    );
  }

  // ── Submit button (handles both master and micro modes) ──────────────────────

  /// Primary CTA button that adapts its label and tap handler based on the
  /// current mode (_hasMicro). Disabled while [_hasMicro] is still null or
  /// a submission is in progress.
  Widget _buildSubmitButton(ProgressState state) {
    final bool isMicro = _hasMicro == true;
    // Loading state differs between micro (local flag) and master (bloc state)
    final bool isLoading =
        isMicro ? _microSubmitting : state is ProgressLoading;
    // Disable the button while mode is undetermined or a request is running
    final bool isDisabled = _hasMicro == null || isLoading;

    return SizedBox(
      width: double.infinity,
      height: AppDimensions.buttonHeight,
      child: ElevatedButton(
        onPressed: isDisabled
            ? null
            : (isMicro ? _handleMicroSubmit : _handleSubmit),
        style: ElevatedButton.styleFrom(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: isLoading
            // Show a spinner while the submission is in-flight
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor:
                      AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.save_rounded),
                  SizedBox(width: 8),
                  Text('Save Progress'),
                ],
              ),
      ),
    );
  }

  /// Inline sync-progress indicator shown while offline entries are being
  /// uploaded to the server (ProgressSyncing bloc state).
  Widget _buildSyncProgress(ProgressSyncing state) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.info.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.info),
          ),
        ),
        const SizedBox(width: 12),
        // Show current/total count so the user knows how many items remain
        Text('Syncing… (${state.current}/${state.total})',
            style: const TextStyle(
                color: AppColors.info, fontWeight: FontWeight.w500)),
      ]),
    );
  }

  // ── Micro success dialog ─────────────────────────────────────────────────────

  /// Non-dismissible success dialog shown after a successful micro submit.
  /// Tapping "Done" pops both the dialog and the progress entry page.
  void _showMicroSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.all(24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.success.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.check_circle_rounded,
                  color: AppColors.success, size: 32),
            ),
            const SizedBox(height: 16),
            const Text('Micro Progress Saved',
                style:
                    TextStyle(fontWeight: FontWeight.w600, fontSize: 18)),
            const SizedBox(height: 8),
            const Text(
              'Progress submitted and awaiting manager approval.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: AppColors.textSecondary, fontSize: 14),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context); // close dialog
              Navigator.pop(context); // back to activity list
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  // ── Master success dialog ────────────────────────────────────────────────────

  /// Non-dismissible dialog shown after master-schedule data is saved.
  /// Differentiates between online (sync complete) and offline (queued) saves.
  /// When offline, offers a "Sync Now" button to attempt an immediate upload.
  void _showSuccessDialog(ProgressSaved state) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.all(24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                // Amber background for offline save, green for online
                color: state.isOffline
                    ? AppColors.warning.withOpacity(0.15)
                    : AppColors.success.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                state.isOffline
                    ? Icons.cloud_upload_rounded
                    : Icons.check_circle_rounded,
                color:
                    state.isOffline ? AppColors.warning : AppColors.success,
                size: 32,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              state.isOffline ? 'Saved Offline' : 'Progress Saved',
              style: const TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              state.isOffline
                  ? "Saved locally — will sync when you're back online."
                  : 'Progress saved successfully.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 14),
            ),
            // Show pending sync count when there are queued entries
            if (state.pendingSyncCount > 0) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cloud_upload_rounded,
                        size: 16, color: AppColors.warning),
                    const SizedBox(width: 6),
                    Text('${state.pendingSyncCount} items pending sync',
                        style: const TextStyle(
                            color: AppColors.warning,
                            fontSize: 12,
                            fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          // Done: close dialog and return to the activity list
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('Done'),
          ),
          // Sync Now: close dialog and trigger an immediate sync attempt
          if (state.isOffline)
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                context.read<ProgressBloc>().add(SyncProgress());
              },
              icon: const Icon(Icons.sync_rounded, size: 18),
              label: const Text('Sync Now'),
            ),
        ],
      ),
    );
  }
}
