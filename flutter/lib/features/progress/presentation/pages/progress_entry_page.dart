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
import 'package:shimmer/shimmer.dart';

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
  final _quantityController = TextEditingController();
  final _remarksController = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  BoqItem? _selectedBoqItem;
  MicroActivity? _selectedMicroActivity;
  ExecutionBreakdown? _breakdown;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadBreakdown();
  }

  void _loadBreakdown() {
    if (widget.activity.epsNodeId != null) {
      context.read<ProgressBloc>().add(
            LoadExecutionBreakdown(
              activityId: widget.activity.id,
              epsNodeId: widget.activity.epsNodeId!,
            ),
          );
    } else {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  void _handleSubmit() {
    if (_formKey.currentState!.validate()) {
      if (_selectedBoqItem == null && _breakdown != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please select a BOQ item'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }

      final entry = ProgressEntry(
        projectId: widget.project.id,
        activityId: widget.activity.id,
        epsNodeId: widget.activity.epsNodeId ?? 0,
        boqItemId: _selectedBoqItem?.id ?? 0,
        microActivityId: _selectedMicroActivity?.id,
        quantity: double.parse(_quantityController.text),
        date: _selectedDate,
        remarks: _remarksController.text.isNotEmpty ? _remarksController.text : null,
        createdAt: DateTime.now(),
      );

      context.read<ProgressBloc>().add(SaveProgress(entry));
    }
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
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () {
              _showSyncHistory(context);
            },
            tooltip: 'Sync History',
          ),
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
          if (state is ProgressLoading && _isLoading) {
            return _buildLoadingShimmer();
          }

          if (state is ExecutionBreakdownLoaded) {
            _breakdown = state.breakdown;
            _isLoading = false;
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(AppDimensions.paddingMD),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Activity info card
                  _buildActivityInfoCard(),
                  const SizedBox(height: 20),

                  // Date picker
                  _buildDatePicker(),
                  const SizedBox(height: 16),

                  // BOQ Item selector
                  if (_breakdown != null) _buildBoqItemSelector(),
                  if (_breakdown != null) const SizedBox(height: 16),

                  // Micro Activity selector (if applicable)
                  if (_breakdown?.hasMicroSchedule == true && _selectedBoqItem != null)
                    _buildMicroActivitySelector(),
                  if (_breakdown?.hasMicroSchedule == true && _selectedBoqItem != null)
                    const SizedBox(height: 16),

                  // Quantity input
                  _buildQuantityInput(),
                  const SizedBox(height: 16),

                  // Remarks input
                  _buildRemarksInput(),
                  const SizedBox(height: 24),

                  // Photo capture (optional)
                  _buildPhotoCapture(),
                  const SizedBox(height: 24),

                  // Submit button
                  _buildSubmitButton(state),
                  
                  // Sync status info
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
                child: Icon(
                  widget.activity.hasMicroSchedule 
                      ? Icons.task_alt_rounded 
                      : Icons.assignment_rounded,
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
            ],
          ),
          if (widget.activity.actualProgress != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Progress',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            '$progressPercent%',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progress,
                          backgroundColor: AppColors.divider,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            progress >= 1.0 ? AppColors.success : AppColors.primary,
                          ),
                          minHeight: 6,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
          if (widget.activity.unit != null && widget.activity.plannedQuantity != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                _buildInfoChip(
                  'Planned',
                  '${widget.activity.plannedQuantity!.toStringAsFixed(1)} ${widget.activity.unit}',
                ),
                const SizedBox(width: 12),
                _buildInfoChip(
                  'Executed',
                  '${widget.activity.actualQuantity?.toStringAsFixed(1) ?? '0'} ${widget.activity.unit}',
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.divider),
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
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

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
            const Icon(Icons.chevron_right_rounded, color: AppColors.textSecondary),
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
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Widget _buildBoqItemSelector() {
    final items = _breakdown?.microActivities.isNotEmpty == true
        ? _breakdown!.microActivities
            .where((a) => a.boqItemId != null)
            .map((a) => BoqItem(
                  id: a.boqItemId!,
                  name: a.name,
                  quantity: a.plannedQuantity,
                  executedQuantity: a.executedQuantity,
                ))
            .toList()
        : _breakdown?.balanceItems ?? [];

    return DropdownButtonFormField<BoqItem>(
      decoration: const InputDecoration(
        labelText: 'BOQ Item',
        prefixIcon: Icon(Icons.list_alt_rounded),
      ),
      initialValue: _selectedBoqItem,
      items: items.map((item) {
        return DropdownMenuItem(
          value: item,
          child: Text(
            item.name,
            overflow: TextOverflow.ellipsis,
          ),
        );
      }).toList(),
      onChanged: (value) {
        setState(() {
          _selectedBoqItem = value;
          _selectedMicroActivity = null;
        });
      },
      validator: (value) {
        if (value == null) {
          return 'Please select a BOQ item';
        }
        return null;
      },
    );
  }

  Widget _buildMicroActivitySelector() {
    final activities = _breakdown?.microActivities
            .where((a) => a.boqItemId == _selectedBoqItem?.id)
            .toList() ??
        [];

    if (activities.isEmpty) return const SizedBox.shrink();

    return DropdownButtonFormField<MicroActivity>(
      decoration: const InputDecoration(
        labelText: 'Micro Activity (Optional)',
        prefixIcon: Icon(Icons.task_rounded),
      ),
      initialValue: _selectedMicroActivity,
      items: [
        const DropdownMenuItem(
          value: null,
          child: Text('Direct Execution (No Micro Activity)'),
        ),
        ...activities.map((activity) {
          return DropdownMenuItem(
            value: activity,
            child: Text(
              '${activity.name} (${activity.remainingQuantity.toStringAsFixed(2)} remaining)',
              overflow: TextOverflow.ellipsis,
            ),
          );
        }),
      ],
      onChanged: (value) {
        setState(() => _selectedMicroActivity = value);
      },
    );
  }

  Widget _buildQuantityInput() {
    return TextFormField(
      controller: _quantityController,
      decoration: InputDecoration(
        labelText: 'Quantity',
        prefixIcon: const Icon(Icons.straighten_rounded),
        suffixText: _selectedBoqItem?.unit ?? widget.activity.unit ?? 'units',
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      textInputAction: TextInputAction.next,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter quantity';
        }
        final qty = double.tryParse(value);
        if (qty == null || qty <= 0) {
          return 'Please enter a valid quantity';
        }
        return null;
      },
    );
  }

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

  Widget _buildPhotoCapture() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.divider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.photo_camera_outlined, 
                    size: 18, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text(
                  'Photos (Optional)',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildPhotoButton(
                  icon: Icons.camera_alt_rounded,
                  label: 'Camera',
                  onTap: () {
                    // TODO: Implement camera capture
                  },
                ),
                const SizedBox(width: 12),
                _buildPhotoButton(
                  icon: Icons.photo_library_rounded,
                  label: 'Gallery',
                  onTap: () {
                    // TODO: Implement gallery picker
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotoButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.divider),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(color: AppColors.primary)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSubmitButton(ProgressState state) {
    final isLoading = state is ProgressLoading;

    return SizedBox(
      width: double.infinity,
      height: AppDimensions.buttonHeight,
      child: ElevatedButton(
        onPressed: isLoading ? null : _handleSubmit,
        style: ElevatedButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
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
            'Syncing... (${state.current}/${state.total})',
            style: const TextStyle(
              color: AppColors.info,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingShimmer() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      child: Column(
        children: [
          // Activity info shimmer
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Shimmer.fromColors(
              baseColor: Colors.grey[300]!,
              highlightColor: Colors.grey[100]!,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              height: 16,
                              width: double.infinity,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Container(
                              height: 12,
                              width: 150,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          // Form fields shimmer
          ...List.generate(4, (index) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Container(
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Shimmer.fromColors(
                baseColor: Colors.grey[300]!,
                highlightColor: Colors.grey[100]!,
                child: Container(),
              ),
            ),
          )),
        ],
      ),
    );
  }

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
                state.isOffline ? Icons.cloud_upload_rounded : Icons.check_circle_rounded,
                color: state.isOffline ? AppColors.warning : AppColors.success,
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
                  ? 'Your progress has been saved locally and will be synced when you\'re back online.'
                  : 'Your progress has been saved successfully.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
            ),
            if (state.pendingSyncCount > 0) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
              Navigator.pop(context); // Close dialog
              Navigator.pop(context); // Go back to activities
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

  void _showSyncHistory(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => const SyncHistorySheet(),
    );
  }
}

/// Sync history bottom sheet
class SyncHistorySheet extends StatefulWidget {
  const SyncHistorySheet({super.key});

  @override
  State<SyncHistorySheet> createState() => _SyncHistorySheetState();
}

class _SyncHistorySheetState extends State<SyncHistorySheet> {
  @override
  void initState() {
    super.initState();
    // Load sync history
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Sync History',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            // Content
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(16),
                children: [
                  _buildSyncStatusCard(),
                  const SizedBox(height: 16),
                  Text(
                    'Recent Entries',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  ),
                  const SizedBox(height: 8),
                  // Placeholder for sync history items
                  _buildHistoryItem(
                    'Block Work - Tower A',
                    '50.0 sqm',
                    'Today, 10:30 AM',
                    SyncStatus.synced,
                  ),
                  _buildHistoryItem(
                    'Plastering - Floor 2',
                    '25.0 sqm',
                    'Today, 09:15 AM',
                    SyncStatus.pending,
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSyncStatusCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.success.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.success.withOpacity(0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.cloud_done_rounded, color: AppColors.success),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'All Synced',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.success,
                  ),
                ),
                Text(
                  'Last synced: Just now',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryItem(
    String title,
    String quantity,
    String time,
    SyncStatus status,
  ) {
    Color statusColor;
    IconData statusIcon;
    
    switch (status) {
      case SyncStatus.synced:
        statusColor = AppColors.success;
        statusIcon = Icons.check_circle_rounded;
        break;
      case SyncStatus.pending:
        statusColor = AppColors.warning;
        statusIcon = Icons.schedule_rounded;
        break;
      case SyncStatus.failed:
        statusColor = AppColors.error;
        statusIcon = Icons.error_rounded;
        break;
      default:
        statusColor = AppColors.textSecondary;
        statusIcon = Icons.help_outline_rounded;
    }

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: AppColors.divider),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: statusColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(statusIcon, color: statusColor, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontSize: 14)),
        subtitle: Text('$quantity | $time',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        trailing: status == SyncStatus.pending
            ? IconButton(
                icon: const Icon(Icons.sync_rounded, color: AppColors.primary),
                onPressed: () {
                  // Retry sync
                },
              )
            : null,
      ),
    );
  }
}

