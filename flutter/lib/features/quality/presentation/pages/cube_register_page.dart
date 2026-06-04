import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/features/quality/data/models/cube_register_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/cube_register_bloc.dart';

class CubeRegisterPage extends StatelessWidget {
  final int projectId;
  final String projectName;

  const CubeRegisterPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => CubeRegisterBloc(apiClient: sl<SetuApiClient>())
        ..add(LoadCubeRegister(projectId)),
      child: _CubeRegisterView(projectId: projectId, projectName: projectName),
    );
  }
}

class _CubeRegisterView extends StatefulWidget {
  final int projectId;
  final String projectName;
  const _CubeRegisterView({required this.projectId, required this.projectName});

  @override
  State<_CubeRegisterView> createState() => _CubeRegisterViewState();
}

class _CubeRegisterViewState extends State<_CubeRegisterView> {
  String _search = '';
  String _statusFilter = 'ALL';
  String _ageFilter = 'ALL';

  static const _statusOptions = [
    'ALL', 'PENDING', 'DUE_TODAY', 'OVERDUE', 'TESTED', 'APPROVED', 'FAILED',
  ];
  static const _ageOptions = ['ALL', '7-Day', '28-Day'];

  List<CubeTestRecord> _applyFilters(List<CubeTestRecord> all) {
    var list = all;
    if (_statusFilter != 'ALL') {
      final target = CubeTestStatus.fromString(_statusFilter);
      list = list.where((r) => r.status == target).toList();
    }
    if (_ageFilter != 'ALL') {
      final isSevenDay = _ageFilter == '7-Day';
      list = list
          .where((r) =>
              isSevenDay
                  ? r.testAge == CubeTestAge.sevenDay
                  : r.testAge == CubeTestAge.twentyEightDay)
          .toList();
    }
    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      list = list
          .where((r) =>
              r.cubeId.toLowerCase().contains(q) ||
              (r.elementName?.toLowerCase().contains(q) ?? false) ||
              (r.mixIdOrGrade?.toLowerCase().contains(q) ?? false) ||
              (r.locationText?.toLowerCase().contains(q) ?? false))
          .toList();
    }
    // Sort: overdue first, then due today, then by due date
    list.sort((a, b) {
      int priority(CubeTestRecord r) {
        if (r.status == CubeTestStatus.overdue) return 0;
        if (r.status == CubeTestStatus.dueToday) return 1;
        if (r.status == CubeTestStatus.pending) return 2;
        if (r.status == CubeTestStatus.tested) return 3;
        return 4;
      }
      final pc = priority(a).compareTo(priority(b));
      if (pc != 0) return pc;
      return a.dueDate.compareTo(b.dueDate);
    });
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CubeRegisterBloc, CubeRegisterState>(
      listener: (context, state) {
        if (state is CubeRegisterError) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.red.shade700,
          ));
        }
        if (state is CubeRegisterActionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.green.shade700,
          ));
        }
      },
      builder: (context, state) {
        final records = switch (state) {
          final CubeRegisterLoaded s => s.records,
          final CubeRegisterActionSuccess s => s.records,
          _ => <CubeTestRecord>[],
        };
        final isLoading = state is CubeRegisterLoading;
        final filtered = _applyFilters(records);

        // Summary counts
        final overdue = records.where((r) => r.status == CubeTestStatus.overdue).length;
        final dueToday = records.where((r) => r.status == CubeTestStatus.dueToday).length;
        final pending = records.where((r) => r.status == CubeTestStatus.pending).length;
        final tested = records.where((r) => r.status == CubeTestStatus.tested).length;

        return Scaffold(
          appBar: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Cube Register', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                Text(widget.projectName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal)),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: () => context.read<CubeRegisterBloc>().add(LoadCubeRegister(widget.projectId)),
              ),
            ],
          ),
          body: isLoading && records.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : Column(
                  children: [
                    if (isLoading)
                      const LinearProgressIndicator(),

                    // Summary banner
                    if (records.isNotEmpty)
                      _SummaryBanner(
                        overdue: overdue,
                        dueToday: dueToday,
                        pending: pending,
                        tested: tested,
                        total: records.length,
                      ),

                    // Search bar
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                      child: TextField(
                        decoration: const InputDecoration(
                          hintText: 'Search by cube ID, element, grade…',
                          prefixIcon: Icon(Icons.search, size: 18),
                          isDense: true,
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        ),
                        onChanged: (v) => setState(() => _search = v),
                      ),
                    ),

                    // Filter chips row
                    _FilterRow(
                      statusFilter: _statusFilter,
                      ageFilter: _ageFilter,
                      statusOptions: _statusOptions,
                      ageOptions: _ageOptions,
                      onStatusChanged: (v) => setState(() => _statusFilter = v),
                      onAgeChanged: (v) => setState(() => _ageFilter = v),
                    ),

                    // List
                    Expanded(
                      child: filtered.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.science_outlined, size: 48, color: Colors.grey.shade300),
                                  const SizedBox(height: 12),
                                  Text(
                                    _search.isNotEmpty || _statusFilter != 'ALL' || _ageFilter != 'ALL'
                                        ? 'No cubes match your filter'
                                        : 'No cube test records yet',
                                    style: TextStyle(color: Colors.grey.shade500),
                                  ),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: () async =>
                                  context.read<CubeRegisterBloc>().add(LoadCubeRegister(widget.projectId)),
                              child: ListView.builder(
                                padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                                itemCount: filtered.length,
                                itemBuilder: (context, i) => _CubeCard(
                                  record: filtered[i],
                                  onTap: () => _openDetail(context, filtered[i]),
                                ),
                              ),
                            ),
                    ),
                  ],
                ),
        );
      },
    );
  }

  void _openDetail(BuildContext context, CubeTestRecord record) {
    final ps = PermissionService.of(context);
    final bloc = context.read<CubeRegisterBloc>();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => BlocProvider.value(
        value: bloc,
        child: _CubeDetailSheet(record: record, canSave: ps.canSaveCubeTest, canApprove: ps.canApproveCubeTest),
      ),
    );
  }
}

// ── Summary Banner ──────────────────────────────────────────────────────────

class _SummaryBanner extends StatelessWidget {
  final int overdue, dueToday, pending, tested, total;
  const _SummaryBanner({
    required this.overdue,
    required this.dueToday,
    required this.pending,
    required this.tested,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _StatPill('Total', total, Colors.grey.shade700),
          _StatPill('Overdue', overdue, Colors.red.shade700),
          _StatPill('Due Today', dueToday, Colors.orange.shade700),
          _StatPill('Pending', pending, Colors.blue.shade700),
          _StatPill('Tested', tested, Colors.indigo.shade700),
        ],
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _StatPill(this.label, this.count, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$count', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: TextStyle(fontSize: 9, color: Colors.grey.shade600)),
      ],
    );
  }
}

// ── Filter Row ──────────────────────────────────────────────────────────────

class _FilterRow extends StatelessWidget {
  final String statusFilter, ageFilter;
  final List<String> statusOptions, ageOptions;
  final ValueChanged<String> onStatusChanged, onAgeChanged;

  const _FilterRow({
    required this.statusFilter,
    required this.ageFilter,
    required this.statusOptions,
    required this.ageOptions,
    required this.onStatusChanged,
    required this.onAgeChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Row(
        children: [
          ...statusOptions.map((s) => Padding(
                padding: const EdgeInsets.only(right: 6),
                child: FilterChip(
                  label: Text(s == 'ALL' ? 'All Status' : _statusLabel(s),
                      style: const TextStyle(fontSize: 11)),
                  selected: statusFilter == s,
                  onSelected: (_) => onStatusChanged(s),
                  visualDensity: VisualDensity.compact,
                ),
              )),
          const SizedBox(width: 8),
          ...ageOptions.where((a) => a != 'ALL').map((a) => Padding(
                padding: const EdgeInsets.only(right: 6),
                child: FilterChip(
                  label: Text(a, style: const TextStyle(fontSize: 11)),
                  selected: ageFilter == a,
                  onSelected: (_) => onAgeChanged(ageFilter == a ? 'ALL' : a),
                  visualDensity: VisualDensity.compact,
                ),
              )),
        ],
      ),
    );
  }

  String _statusLabel(String s) {
    return CubeTestStatus.fromString(s).label;
  }
}

// ── Cube Card ───────────────────────────────────────────────────────────────

class _CubeCard extends StatelessWidget {
  final CubeTestRecord record;
  final VoidCallback onTap;
  const _CubeCard({required this.record, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final r = record;
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: r.status.needsAttention
              ? r.status.color.withValues(alpha: 0.5)
              : Colors.grey.shade200,
          width: r.status.needsAttention ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Cube ID
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade800,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(r.cubeId,
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                  const SizedBox(width: 8),
                  // Test age badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: Colors.blue.shade200),
                    ),
                    child: Text(r.testAge.label,
                        style: TextStyle(fontSize: 11, color: Colors.blue.shade700)),
                  ),
                  const Spacer(),
                  // Status badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: r.status.color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(r.status.label,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: r.status.color)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  if (r.elementName != null)
                    _InfoChip(Icons.location_on_outlined, r.elementName!),
                  if (r.mixIdOrGrade != null)
                    _InfoChip(Icons.science_outlined, r.mixIdOrGrade!),
                  _InfoChip(Icons.calendar_today_outlined, 'Due: ${r.dueDate}'),
                  if (r.compressiveStrengthMpa != null)
                    _InfoChip(
                      r.hasPassed ? Icons.check_circle_outline : Icons.cancel_outlined,
                      '${r.compressiveStrengthMpa} MPa',
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoChip(this.icon, this.label);

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: Colors.grey.shade500),
        const SizedBox(width: 3),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      ],
    );
  }
}

// ── Detail / Edit Sheet ──────────────────────────────────────────────────────

class _CubeDetailSheet extends StatefulWidget {
  final CubeTestRecord record;
  final bool canSave;
  final bool canApprove;
  const _CubeDetailSheet({required this.record, required this.canSave, required this.canApprove});

  @override
  State<_CubeDetailSheet> createState() => _CubeDetailSheetState();
}

class _CubeDetailSheetState extends State<_CubeDetailSheet> {
  late final TextEditingController _loadKnCtrl;
  late final TextEditingController _testedByCtrl;
  late final TextEditingController _testedDateCtrl;
  late final TextEditingController _remarksCtrl;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final r = widget.record;
    _loadKnCtrl = TextEditingController(text: r.loadKn ?? '');
    _testedByCtrl = TextEditingController(text: r.testedByName ?? '');
    _testedDateCtrl = TextEditingController(text: r.testedDate ?? '');
    _remarksCtrl = TextEditingController(text: r.remarks ?? '');
  }

  @override
  void dispose() {
    _loadKnCtrl.dispose();
    _testedByCtrl.dispose();
    _testedDateCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  bool get _isApproved => widget.record.status == CubeTestStatus.approved;
  bool get _canEdit => widget.canSave && !_isApproved;

  void _save(BuildContext context) {
    setState(() => _submitting = true);
    context.read<CubeRegisterBloc>().add(UpdateCubeTest(
      widget.record.id,
      {
        if (_loadKnCtrl.text.isNotEmpty) 'loadKn': _loadKnCtrl.text.trim(),
        if (_testedByCtrl.text.isNotEmpty) 'testedByName': _testedByCtrl.text.trim(),
        if (_testedDateCtrl.text.isNotEmpty) 'testedDate': _testedDateCtrl.text.trim(),
        if (_remarksCtrl.text.isNotEmpty) 'remarks': _remarksCtrl.text.trim(),
      },
    ));
    Navigator.of(context).pop();
  }

  void _approve(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve Cube Test'),
        content: Text(
            'Confirm approval for cube ${widget.record.cubeId}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<CubeRegisterBloc>().add(ApproveCubeTest(widget.record.id));
              Navigator.of(context).pop();
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.record;
    final theme = Theme.of(context);

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (context, scrollCtrl) => Column(
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: theme.dividerColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              controller: scrollCtrl,
              padding: EdgeInsets.only(
                left: 16, right: 16, top: 4,
                bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    children: [
                      Text(r.cubeId,
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: r.status.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(r.status.label,
                            style: TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w600, color: r.status.color)),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(r.testAge.label,
                            style: TextStyle(fontSize: 11, color: Colors.blue.shade700)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Context info
                  _Section(
                    title: 'Context',
                    children: [
                      _DetailRow('Element', r.elementName),
                      _DetailRow('GO', r.goLabel),
                      _DetailRow('Location', r.locationText),
                      _DetailRow('Grade / Mix ID', r.mixIdOrGrade),
                      _DetailRow('Truck No', r.truckNo),
                      _DetailRow('Challan No', r.deliveryChallanNo),
                      _DetailRow('Cast Date', r.castDate),
                      _DetailRow('Due Date', r.dueDate,
                          highlight: r.status.needsAttention ? r.status.color : null),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Test results
                  _Section(
                    title: 'Test Results',
                    children: [
                      // Compressive strength display
                      if (r.compressiveStrengthMpa != null)
                        _StrengthRow(
                          actual: r.compressiveStrengthMpa!,
                          required: r.requiredStrengthMpa,
                          passed: r.hasPassed,
                        ),
                      _DetailRow('Load (kN)', r.loadKn),
                      _DetailRow('Compressive Strength (MPa)', r.compressiveStrengthMpa),
                      _DetailRow('Required Strength (MPa)', r.requiredStrengthMpa),
                      _DetailRow('Average Strength (MPa)', r.averageStrengthMpa),
                      _DetailRow('Tested By', r.testedByName),
                      _DetailRow('Test Date', r.testedDate),
                      if (r.approvedAt != null)
                        _DetailRow('Approved At', r.approvedAt!.toLocal().toString().split('.').first),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Editable fields (only when canEdit)
                  if (_canEdit) ...[
                    _Section(
                      title: 'Enter Test Result',
                      children: [
                        _EditField('Load (kN) *', _loadKnCtrl,
                            keyboardType: TextInputType.number,
                            hint: 'e.g. 506.25'),
                        const SizedBox(height: 8),
                        _EditField('Tested By', _testedByCtrl,
                            hint: 'Lab technician name'),
                        const SizedBox(height: 8),
                        _EditField('Test Date (YYYY-MM-DD)', _testedDateCtrl,
                            hint: 'e.g. 2026-06-10'),
                        const SizedBox(height: 8),
                        _EditField('Remarks', _remarksCtrl, maxLines: 2),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Action buttons
                  Row(
                    children: [
                      if (_canEdit) ...[
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _submitting ? null : () => _save(context),
                            icon: const Icon(Icons.save_outlined, size: 16),
                            label: const Text('Save Result'),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      if (widget.canApprove) ...[
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _isApproved ? null : () => _approve(context),
                            icon: Icon(
                              _isApproved ? Icons.check_circle : Icons.verified_outlined,
                              size: 16,
                            ),
                            label: Text(_isApproved ? 'Approved' : 'Approve'),
                            style: FilledButton.styleFrom(
                              backgroundColor: _isApproved
                                  ? Colors.grey.shade400
                                  : Colors.green.shade700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Helper Widgets ──────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Column(children: children),
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String? value;
  final Color? highlight;
  const _DetailRow(this.label, this.value, {this.highlight});

  @override
  Widget build(BuildContext context) {
    if (value == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text(label,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ),
          Expanded(
            child: Text(value!,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: highlight)),
          ),
        ],
      ),
    );
  }
}

class _StrengthRow extends StatelessWidget {
  final String actual;
  final String? required;
  final bool passed;
  const _StrengthRow({required this.actual, this.required, required this.passed});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: passed ? Colors.green.shade50 : Colors.red.shade50,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
            color: passed ? Colors.green.shade200 : Colors.red.shade200),
      ),
      child: Row(
        children: [
          Icon(
            passed ? Icons.check_circle : Icons.cancel,
            color: passed ? Colors.green.shade700 : Colors.red.shade700,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$actual MPa ${passed ? '≥' : '<'} ${required ?? '?'} MPa required',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: passed ? Colors.green.shade800 : Colors.red.shade800),
                ),
                Text(
                  passed ? 'PASSED' : 'FAILED',
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: passed ? Colors.green.shade700 : Colors.red.shade700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EditField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final TextInputType keyboardType;
  final String? hint;
  final int maxLines;

  const _EditField(
    this.label,
    this.controller, {
    this.keyboardType = TextInputType.text,
    this.hint,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: const OutlineInputBorder(),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
    );
  }
}
