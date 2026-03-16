import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/features/labor/data/models/labor_models.dart';
import 'package:setu_mobile/features/labor/presentation/bloc/labor_bloc.dart';

/// Daily labor headcount register for a project.
/// Shows one row per labor category. User enters count + optional contractor.
/// A total-workers summary bar sums all category counts in real time.
/// The FAB saves the current register to the server via [LaborBloc].
class LaborPresencePage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const LaborPresencePage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<LaborPresencePage> createState() => _LaborPresencePageState();
}

class _LaborPresencePageState extends State<LaborPresencePage> {
  late DateTime _selectedDate;

  @override
  void initState() {
    super.initState();
    // Default to today's date on page open
    _selectedDate = DateTime.now();
    _load();
  }

  /// Returns the selected date formatted as YYYY-MM-DD for API calls.
  String get _dateString =>
      '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';

  /// Dispatches [LoadLaborPresence] to fetch the register for the selected date.
  void _load() {
    context.read<LaborBloc>().add(LoadLaborPresence(
          projectId: widget.projectId,
          date: _dateString,
        ));
  }

  /// Opens the system date picker bounded to the last 90 days.
  /// Reloads the register when a different date is selected.
  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
      // Reload for the newly selected date
      _load();
    }
  }

  /// Dispatches [SaveLaborPresence] to persist the current headcounts.
  void _save() {
    context.read<LaborBloc>().add(SaveLaborPresence(
          projectId: widget.projectId,
          date: _dateString,
        ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Labor Register',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName,
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.normal),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ],
        ),
        actions: [
          // Date picker shortcut in the app bar
          IconButton(
            icon: const Icon(Icons.calendar_today_outlined),
            tooltip: 'Select date',
            onPressed: _pickDate,
          ),
          // Manual refresh button
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _load,
          ),
        ],
      ),
      body: BlocConsumer<LaborBloc, LaborState>(
        listener: (context, state) {
          // On successful save: show green snack with entry count and reload
          if (state is LaborSaveSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                    'Saved ${state.savedCount} labor entr${state.savedCount == 1 ? 'y' : 'ies'} for $_dateString'),
                backgroundColor: Colors.green,
              ),
            );
            _load();
          } else if (state is LaborSaveError) {
            // Show save error as a red snack
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Theme.of(context).colorScheme.error,
              ),
            );
          }
        },
        builder: (context, state) {
          return Column(
            children: [
              // Sticky date header — tapping opens the date picker
              _DateHeader(
                date: _selectedDate,
                onTap: _pickDate,
              ),
              Expanded(
                child: _buildBody(context, state),
              ),
            ],
          );
        },
      ),
      // Save FAB — only shown when a register is loaded or saving is in progress
      floatingActionButton: BlocBuilder<LaborBloc, LaborState>(
        builder: (context, state) {
          final isSaving = state is LaborSaving;
          final isLoaded = state is LaborLoaded;
          // Hide FAB when the register hasn't loaded yet
          if (!isLoaded && !isSaving) return const SizedBox.shrink();
          return FloatingActionButton.extended(
            // Disable button while save is in progress to prevent double-tap
            onPressed: isSaving ? null : _save,
            icon: isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.save_rounded),
            label: Text(isSaving ? 'Saving...' : 'Save Register'),
            backgroundColor: const Color(0xFF1565C0),
          );
        },
      ),
    );
  }

  /// Builds the body section based on the current [LaborState].
  /// Handles loading spinner, error view, empty state, and the category list.
  Widget _buildBody(BuildContext context, LaborState state) {
    // Full-page spinner on initial load
    if (state is LaborLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    // Full-page error with retry button
    if (state is LaborError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off_rounded,
                  size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text(state.message,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey.shade600)),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    // Extract entries and total from loaded or saving state
    List<DailyLaborEntry> entries = [];
    int total = 0;
    if (state is LaborLoaded) {
      entries = state.entries;
      total = state.totalWorkers;
    } else if (state is LaborSaving) {
      // Keep existing entries visible during the save operation
      entries = state.entries;
      total = state.totalWorkers;
    }

    // Empty state — no categories configured for this project
    if (entries.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.people_outline_rounded,
                size: 56, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            Text('No labor categories configured',
                style: TextStyle(color: Colors.grey.shade500)),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 100),
      children: [
        // Total workers summary bar at the top of the list
        _TotalBar(total: total),
        const SizedBox(height: 12),
        // One row per labor category; each dispatches UpdateLaborEntry on change
        ...entries.map((entry) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _LaborEntryRow(
                entry: entry,
                onChanged: (count, contractor) {
                  // Dispatch count/contractor update to bloc (updates in-memory state)
                  context.read<LaborBloc>().add(UpdateLaborEntry(
                        categoryId: entry.categoryId,
                        count: count,
                        contractorName: contractor,
                      ));
                },
              ),
            )),
      ],
    );
  }
}

// ─── Date header ──────────────────────────────────────────────────────────────

/// Full-width tappable date header displayed above the category list.
/// Prefixes "Today — " when the selected date matches the current day.
class _DateHeader extends StatelessWidget {
  final DateTime date;
  final VoidCallback onTap;

  const _DateHeader({required this.date, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isToday = _isToday(date);
    // Context-aware label so today is clearly highlighted
    final label = isToday
        ? 'Today — ${_fmt(date)}'
        : _fmt(date);

    return InkWell(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF1565C0).withValues(alpha: 0.06),
          border: const Border(
            bottom: BorderSide(color: Color(0xFFE5E7EB)),
          ),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_outlined,
                size: 16, color: Color(0xFF1565C0)),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1565C0),
              ),
            ),
            const SizedBox(width: 4),
            // Dropdown chevron indicates tappability
            const Icon(Icons.arrow_drop_down_rounded,
                size: 18, color: Color(0xFF1565C0)),
          ],
        ),
      ),
    );
  }

  /// Returns true when [dt] matches today's calendar date.
  bool _isToday(DateTime dt) {
    final now = DateTime.now();
    return dt.year == now.year && dt.month == now.month && dt.day == now.day;
  }

  /// Formats a [DateTime] as DD/MM/YYYY for display.
  String _fmt(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
}

// ─── Total bar ────────────────────────────────────────────────────────────────

/// Summary banner showing the aggregated total worker count across all categories.
/// Tinted blue when at least one worker is recorded; grey when the register is empty.
class _TotalBar extends StatelessWidget {
  final int total;
  const _TotalBar({required this.total});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        // Blue tint when workers are present; neutral grey when zero
        color: total > 0
            ? const Color(0xFF1565C0).withValues(alpha: 0.08)
            : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: total > 0
              ? const Color(0xFF1565C0).withValues(alpha: 0.3)
              : Colors.grey.shade300,
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.people_rounded,
              size: 18,
              color: total > 0
                  ? const Color(0xFF1565C0)
                  : Colors.grey.shade500),
          const SizedBox(width: 8),
          Text(
            'Total Workers on Site: ',
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade700,
            ),
          ),
          // Large bold count number
          Text(
            '$total',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: total > 0
                  ? const Color(0xFF1565C0)
                  : Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Labor entry row ──────────────────────────────────────────────────────────

/// Single category row in the labor register.
/// Shows the category name, a [_CountStepper], and a contractor name field
/// that expands only when the count is greater than zero.
class _LaborEntryRow extends StatefulWidget {
  final DailyLaborEntry entry;
  final void Function(int count, String? contractor) onChanged;

  const _LaborEntryRow({required this.entry, required this.onChanged});

  @override
  State<_LaborEntryRow> createState() => _LaborEntryRowState();
}

class _LaborEntryRowState extends State<_LaborEntryRow> {
  late final TextEditingController _countCtrl;
  late final TextEditingController _contractorCtrl;

  @override
  void initState() {
    super.initState();
    // Pre-fill count from the loaded entry; leave blank when count is zero
    _countCtrl = TextEditingController(
      text: widget.entry.count > 0 ? '${widget.entry.count}' : '',
    );
    _contractorCtrl = TextEditingController(
      text: widget.entry.contractorName ?? '',
    );
  }

  @override
  void didUpdateWidget(_LaborEntryRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Sync count if changed externally (e.g. initial load from API)
    if (oldWidget.entry.count != widget.entry.count) {
      _countCtrl.text =
          widget.entry.count > 0 ? '${widget.entry.count}' : '';
    }
  }

  @override
  void dispose() {
    _countCtrl.dispose();
    _contractorCtrl.dispose();
    super.dispose();
  }

  /// Reads the current field values and calls [onChanged] to notify the parent.
  void _notify() {
    final count = int.tryParse(_countCtrl.text) ?? 0;
    // Treat blank contractor field as null (no contractor)
    final contractor = _contractorCtrl.text.trim().isEmpty
        ? null
        : _contractorCtrl.text.trim();
    widget.onChanged(count, contractor);
  }

  @override
  Widget build(BuildContext context) {
    // Tinted border and blue label when a count is entered
    final hasCount = (int.tryParse(_countCtrl.text) ?? 0) > 0;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        // Stronger blue border when count > 0 to highlight active rows
        border: Border.all(
          color: hasCount
              ? const Color(0xFF1565C0).withValues(alpha: 0.4)
              : const Color(0xFFE5E7EB),
          width: hasCount ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Category name — blue when workers entered, dark grey otherwise
              Expanded(
                child: Text(
                  widget.entry.categoryName,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: hasCount
                        ? const Color(0xFF1565C0)
                        : const Color(0xFF374151),
                  ),
                ),
              ),
              // +/- stepper with inline text input for precise entry
              _CountStepper(
                controller: _countCtrl,
                onChanged: _notify,
              ),
            ],
          ),
          // Contractor name field expands only when a count is entered
          if (hasCount) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _contractorCtrl,
              decoration: const InputDecoration(
                hintText: 'Contractor name (optional)',
                isDense: true,
                border: OutlineInputBorder(),
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
              style: const TextStyle(fontSize: 13),
              // Notify on every keystroke to keep the bloc state in sync
              onChanged: (_) => _notify(),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Count stepper ────────────────────────────────────────────────────────────

/// Inline +/- stepper paired with a numeric text field.
/// Minus button is disabled when count is already zero.
class _CountStepper extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onChanged;

  const _CountStepper({required this.controller, required this.onChanged});

  /// Parses the current controller text as an integer, defaulting to 0.
  int get _value => int.tryParse(controller.text) ?? 0;

  /// Decrements the count by one, clamped to zero.
  void _decrement() {
    final v = _value;
    if (v > 0) {
      controller.text = '${v - 1}';
      onChanged();
    }
  }

  /// Increments the count by one.
  void _increment() {
    controller.text = '${_value + 1}';
    onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Decrement button
        _StepBtn(icon: Icons.remove, onTap: _decrement),
        const SizedBox(width: 4),
        // Numeric text input — digits only, centered, 52px wide
        SizedBox(
          width: 52,
          child: TextField(
            controller: controller,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            // Prevent non-numeric characters
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              isDense: true,
              border: OutlineInputBorder(),
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            ),
            style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w700),
            // Notify on direct keyboard input as well as stepper taps
            onChanged: (_) => onChanged(),
          ),
        ),
        const SizedBox(width: 4),
        // Increment button
        _StepBtn(icon: Icons.add, onTap: _increment),
      ],
    );
  }
}

/// Single square icon button used for the + and - stepper controls.
class _StepBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _StepBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: const Color(0xFF1565C0).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 16, color: const Color(0xFF1565C0)),
      ),
    );
  }
}
