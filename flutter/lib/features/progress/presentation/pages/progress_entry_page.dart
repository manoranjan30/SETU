import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/progress/data/models/progress_model.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';

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
      if (_selectedBoqItem == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please select a BOQ item'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }

      final entry = ProgressEntry(
        projectId: widget.project.id,
        activityId: widget.activity.id,
        epsNodeId: widget.activity.epsNodeId ?? 0,
        boqItemId: _selectedBoqItem!.id,
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
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () {
              // TODO: Navigate to history
            },
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
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is ProgressLoading && _isLoading) {
            return const Center(child: CircularProgressIndicator());
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
                  const SizedBox(height: 24),

                  // Date picker
                  _buildDatePicker(),
                  const SizedBox(height: 16),

                  // BOQ Item selector
                  if (_breakdown != null) _buildBoqItemSelector(),
                  const SizedBox(height: 16),

                  // Micro Activity selector (if applicable)
                  if (_breakdown?.hasMicroSchedule == true && _selectedBoqItem != null)
                    _buildMicroActivitySelector(),
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
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildActivityInfoCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppDimensions.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.assignment,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.activity.name,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        widget.project.name,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (widget.activity.actualProgress != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: widget.activity.actualProgress!,
                        backgroundColor: AppColors.outline,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          AppColors.primary,
                        ),
                        minHeight: 8,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '${(widget.activity.actualProgress! * 100).toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: AppColors.primary,
                        ),
                  ),
                ],
              ),
            ],
          ],
        ),
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
          prefixIcon: Icon(Icons.calendar_today),
        ),
        child: Text(
          DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate),
          style: Theme.of(context).textTheme.bodyLarge,
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
        prefixIcon: Icon(Icons.list_alt),
      ),
      value: _selectedBoqItem,
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
        prefixIcon: Icon(Icons.task),
      ),
      value: _selectedMicroActivity,
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
        prefixIcon: const Icon(Icons.straighten),
        suffixText: _selectedBoqItem?.unit ?? 'units',
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
        prefixIcon: Icon(Icons.notes),
        alignLabelWithHint: true,
      ),
      maxLines: 3,
      textInputAction: TextInputAction.done,
    );
  }

  Widget _buildPhotoCapture() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppDimensions.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Photos (Optional)',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildPhotoButton(
                  icon: Icons.camera_alt,
                  label: 'Camera',
                  onTap: () {
                    // TODO: Implement camera capture
                  },
                ),
                const SizedBox(width: 16),
                _buildPhotoButton(
                  icon: Icons.photo_library,
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.outline),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20, color: AppColors.primary),
            const SizedBox(width: 8),
            Text(label),
          ],
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
        child: isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Text('Save Progress'),
      ),
    );
  }

  void _showSuccessDialog(ProgressSaved state) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        icon: Icon(
          state.isOffline ? Icons.cloud_upload : Icons.check_circle,
          color: state.isOffline ? AppColors.warning : AppColors.success,
          size: 48,
        ),
        title: Text(state.isOffline ? 'Saved Offline' : 'Progress Saved'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              state.isOffline
                  ? 'Your progress has been saved locally and will be synced when you\'re back online.'
                  : 'Your progress has been saved successfully.',
              textAlign: TextAlign.center,
            ),
            if (state.pendingSyncCount > 0) ...[
              const SizedBox(height: 8),
              Text(
                '${state.pendingSyncCount} items pending sync',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.warning,
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
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                context.read<ProgressBloc>().add(SyncProgress());
              },
              child: const Text('Sync Now'),
            ),
        ],
      ),
    );
  }
}
