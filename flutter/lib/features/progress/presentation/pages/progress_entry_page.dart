import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/progress/data/models/progress_model.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/widgets/breadcrumb_widget.dart' as widgets;
import 'package:setu_mobile/features/sync/presentation/pages/sync_log_page.dart';

class ProgressEntryPage extends StatefulWidget {
  final Activity activity;
  final Project project;

  const ProgressEntryPage({
    super.key,
    required this.activity,
    required this.project,
  });

  @override
  State<ProgressEntryPage> createState() => _ProgressEntryPageState();
}

class _ProgressEntryPageState extends State<ProgressEntryPage> {
  final _formKey = GlobalKey<FormState>();
  final _remarksController = TextEditingController();
  DateTime _selectedDate = DateTime.now();

  // One controller per plan, keyed by planId
  final Map<int, TextEditingController> _planControllers = {};

  @override
  void initState() {
    super.initState();
    for (final plan in widget.activity.plans) {
      _planControllers[plan.planId] = TextEditingController();
    }
  }

  @override
  void dispose() {
    for (final c in _planControllers.values) {
      c.dispose();
    }
    _remarksController.dispose();
    super.dispose();
  }

  void _handleSubmit() {
    if (!_formKey.currentState!.validate()) return;

    final entries = <ProgressEntry>[];
    for (final plan in widget.activity.plans) {
      final text = _planControllers[plan.planId]?.text ?? '';
      final qty = double.tryParse(text) ?? 0;
      if (qty <= 0) continue;
      // microActivityId column is repurposed to carry planId to the sync layer
      entries.add(ProgressEntry(
        projectId: widget.project.id,
        activityId: widget.activity.id,
        epsNodeId: widget.activity.epsNodeId ?? 0,
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter quantity for at least one item'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    context.read<ProgressBloc>().add(SaveMultipleProgress(entries));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Progress Entry'),
        actions: [
          widgets.LiveSyncStatusIndicator(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SyncLogPage()),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: BlocConsumer<ProgressBloc, ProgressState>(
        listener: (context, state) {
          if (state is ProgressSaved) {
            _showSuccessDialog(state);
          } else if (state is ProgressError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: AppColors.error,
                behavior: SnackBarBehavior.floating,
              ),
            );
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
                  _buildPlansSection(),
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

  // ── Activity info card ──────────────────────────────────────────────────────

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
                child: const Icon(
                  Icons.assignment_rounded,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.activity.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.project.name,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
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
                child: Text(
                  '$progressPercent%',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
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
                  progress >= 1.0 ? AppColors.success : AppColors.primary,
                ),
                minHeight: 5,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Date picker ─────────────────────────────────────────────────────────────

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
            Text(
              DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate),
              style: Theme.of(context).textTheme.bodyLarge,
            ),
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

  // ── Plans section ────────────────────────────────────────────────────────────

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
        child: const Row(
          children: [
            Icon(Icons.info_outline_rounded,
                color: AppColors.warning, size: 20),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'No BOQ plans are linked to this activity. '
                'Progress cannot be entered until plans are configured.',
                style: TextStyle(color: AppColors.warning, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'BOQ Plans  (${plans.length})',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 8),
        ...plans.map((plan) => _buildPlanCard(plan)),
      ],
    );
  }

  Widget _buildPlanCard(ActivityPlan plan) {
    final balance = plan.balance;
    final pct = plan.plannedQuantity > 0
        ? (plan.consumedQty / plan.plannedQuantity).clamp(0.0, 1.0)
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
            // Header: description + UOM badge
            Row(
              children: [
                Expanded(
                  child: Text(
                    plan.description,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
                if (plan.uom != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      plan.uom!,
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),

            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: pct.toDouble(),
                backgroundColor: AppColors.divider,
                valueColor: AlwaysStoppedAnimation<Color>(
                  pct >= 1.0 ? AppColors.success : AppColors.primary,
                ),
                minHeight: 5,
              ),
            ),
            const SizedBox(height: 8),

            // Quantity stats row
            Row(
              children: [
                _statChip('Planned',
                    plan.plannedQuantity.toStringAsFixed(2)),
                const SizedBox(width: 8),
                _statChip('Done',
                    plan.consumedQty.toStringAsFixed(2),
                    color: AppColors.textSecondary),
                const SizedBox(width: 8),
                _statChip('Balance',
                    balance.toStringAsFixed(2),
                    color: balance > 0
                        ? AppColors.success
                        : AppColors.textSecondary),
              ],
            ),
            const SizedBox(height: 12),

            // Quantity input
            TextFormField(
              controller: _planControllers[plan.planId],
              decoration: InputDecoration(
                labelText: "Today's Qty",
                prefixIcon:
                    const Icon(Icons.straighten_rounded, size: 18),
                suffixText: plan.uom,
                isDense: true,
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              textInputAction: TextInputAction.next,
              validator: (value) {
                if (value == null || value.isEmpty) return null; // optional
                final qty = double.tryParse(value);
                if (qty == null || qty < 0) {
                  return 'Enter a valid number';
                }
                return null;
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _statChip(String label, String value, {Color? color}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: (color ?? AppColors.primary).withOpacity(0.07),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 10,
              ),
            ),
            Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: color ?? AppColors.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Remarks ─────────────────────────────────────────────────────────────────

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

  // ── Submit button ────────────────────────────────────────────────────────────

  Widget _buildSubmitButton(ProgressState state) {
    final isLoading = state is ProgressLoading;
    return SizedBox(
      width: double.infinity,
      height: AppDimensions.buttonHeight,
      child: ElevatedButton(
        onPressed: isLoading ? null : _handleSubmit,
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
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
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
      child: Row(
        children: [
          const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.info),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            'Syncing… (${state.current}/${state.total})',
            style: const TextStyle(
              color: AppColors.info,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  // ── Success dialog ───────────────────────────────────────────────────────────

  void _showSuccessDialog(ProgressSaved state) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
                fontWeight: FontWeight.w600,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              state.isOffline
                  ? "Saved locally — will sync when you're back online."
                  : 'Progress saved successfully.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
            ),
            if (state.pendingSyncCount > 0) ...[
              const SizedBox(height: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
                    Text(
                      '${state.pendingSyncCount} items pending sync',
                      style: const TextStyle(
                        color: AppColors.warning,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // close dialog
              Navigator.pop(context); // back to activities
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
