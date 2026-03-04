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
  // Keyed by "${boqIdx}_${type}_${id|'balance'}"
  final Map<String, TextEditingController> _microControllers = {};

  // Local unsynced qty per boqItemId (pending/failed in Drift DB)
  final Map<int, double> _localPendingQty = {};

  @override
  void initState() {
    super.initState();
    for (final plan in widget.activity.plans) {
      _planControllers[plan.planId] = TextEditingController();
    }
    _loadLocalPendingQty();
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
      if (hasMicro) _fetchBreakdown();
    } catch (_) {
      if (!mounted) return;
      setState(() => _hasMicro = false);
    }
  }

  /// Fetch the execution breakdown for this activity / EPS node.
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

      // Initialise one controller per line item
      final controllers = <String, TextEditingController>{};
      for (int i = 0; i < bd.boqBreakdown.length; i++) {
        for (final item in bd.boqBreakdown[i].items) {
          final key = '${i}_${item.type}_${item.id ?? 'balance'}';
          controllers[key] = TextEditingController();
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

  void _handleSubmit() {
    if (!_formKey.currentState!.validate()) return;

    final entries = <model.ProgressEntry>[];
    for (final plan in widget.activity.plans) {
      final qty =
          double.tryParse(_planControllers[plan.planId]?.text ?? '') ?? 0;
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

    if (entries.isEmpty) {
      _showEmptySnack();
      return;
    }
    context.read<ProgressBloc>().add(SaveMultipleProgress(entries));
  }

  // ── Micro schedule submit ────────────────────────────────────────────────────

  Future<void> _handleMicroSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final bd = _breakdown;
    if (bd == null) return;

    final entries = <Map<String, dynamic>>[];
    for (int i = 0; i < bd.boqBreakdown.length; i++) {
      final boqBd = bd.boqBreakdown[i];
      for (final item in boqBd.items) {
        final key = '${i}_${item.type}_${item.id ?? 'balance'}';
        final qty =
            double.tryParse(_microControllers[key]?.text ?? '') ?? 0;
        if (qty <= 0) continue;
        entries.add({
          'boqItemId': boqBd.boqItemId,
          'microActivityId': item.isMicro ? item.id : null,
          'quantity': qty,
        });
      }
    }

    if (entries.isEmpty) {
      _showEmptySnack();
      return;
    }

    setState(() => _microSubmitting = true);
    try {
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

  void _showEmptySnack() {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Enter quantity for at least one item'),
      backgroundColor: AppColors.error,
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Progress Entry'),
        actions: [
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
          if (state is ProgressSaved) {
            _showSuccessDialog(state);
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
                  _buildActivityInfoCard(),
                  const SizedBox(height: 20),
                  _buildDatePicker(),
                  const SizedBox(height: 20),
                  _buildContentSection(),
                  const SizedBox(height: 16),
                  _buildRemarksInput(),
                  const SizedBox(height: 24),
                  _buildSubmitButton(state),
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

  Widget _buildContentSection() {
    if (_hasMicro == null) {
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
                    Text(widget.activity.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(widget.project.name,
                        style: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 12)),
                  ],
                ),
              ),
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
          if (widget.activity.actualProgress != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: AppColors.divider,
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
            Text(DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate),
                style: Theme.of(context).textTheme.bodyLarge),
            const Icon(Icons.chevron_right_rounded,
                color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

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

  Widget _buildBreakdownSection() {
    if (_microLoading) {
      return const Center(
        child:
            Padding(padding: EdgeInsets.symmetric(vertical: 32), child: CircularProgressIndicator()),
      );
    }

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
    if (bd == null || bd.boqBreakdown.isEmpty) {
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
              'Micro schedule detected but no BOQ breakdown is configured yet.',
              style: TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          ),
        ]),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Micro schedule banner
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
                'Micro Schedule active — enter progress per micro task below.',
                style: TextStyle(color: Colors.blue, fontSize: 12),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Text(
          'Execution Breakdown  (${bd.boqBreakdown.length} BOQ item${bd.boqBreakdown.length == 1 ? '' : 's'})',
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        ...List.generate(bd.boqBreakdown.length,
            (i) => _buildBoqBreakdownCard(i, bd.boqBreakdown[i])),
      ],
    );
  }

  Widget _buildBoqBreakdownCard(int idx, BoqItemBreakdown boqBd) {
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
            // Header
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

            // Overall progress bar
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

            // Scope chips
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

            // Per-item rows
            ...List.generate(boqBd.items.length,
                (j) => _buildBreakdownItemRow(idx, boqBd.items[j], boqBd)),
          ],
        ),
      ),
    );
  }

  Widget _buildBreakdownItemRow(
      int boqIdx, BreakdownItem item, BoqItemBreakdown boqBd) {
    final key = '${boqIdx}_${item.type}_${item.id ?? 'balance'}';
    final controller = _microControllers[key];
    final balance = item.balanceQty.clamp(0.0, double.maxFinite);
    final fullyUsed = balance <= 0;
    final dotColor =
        item.isMicro ? Colors.blue[600]! : const Color(0xFFF59E0B);

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name row + type badge
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

          // Qty chips
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

          // Input or fully-used indicator
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

  Widget _buildPlansSection() {
    final plans = widget.activity.plans;

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
        Text('BOQ Plans  (${plans.length})',
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        ...plans.map((plan) => _buildPlanCard(plan)),
      ],
    );
  }

  Widget _buildPlanCard(ActivityPlan plan) {
    final balance = plan.balance;
    final localQty = _localPendingQty[plan.boqItemId] ?? 0;
    final fullyUsed = balance <= 0;

    final approvedPct = plan.plannedQuantity > 0
        ? (plan.approvedQty / plan.plannedQuantity).clamp(0.0, 1.0)
        : 0.0;
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
            // Header
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

            // Stacked progress bar (approved + pending)
            Stack(children: [
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

            // 4-chip quantity row
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

            // Pending approval notice
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

            // Local unsynced qty warning
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

            // Quantity input
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
            Text(label,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 10)),
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

  Widget _buildSubmitButton(ProgressState state) {
    final bool isMicro = _hasMicro == true;
    final bool isLoading =
        isMicro ? _microSubmitting : state is ProgressLoading;
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
        Text('Syncing… (${state.current}/${state.total})',
            style: const TextStyle(
                color: AppColors.info, fontWeight: FontWeight.w500)),
      ]),
    );
  }

  // ── Micro success dialog ─────────────────────────────────────────────────────

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
              Navigator.pop(context); // back to activities
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  // ── Master success dialog ────────────────────────────────────────────────────

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
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('Done'),
          ),
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
