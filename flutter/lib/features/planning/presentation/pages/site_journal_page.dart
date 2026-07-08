import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:setu_mobile/core/api/api_endpoints.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/planning/data/models/phase2_models.dart';
import 'package:setu_mobile/features/planning/presentation/bloc/planning_phase2_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/injection_container.dart';

class SiteJournalPage extends StatefulWidget {
  final Project project;
  const SiteJournalPage({super.key, required this.project});

  @override
  State<SiteJournalPage> createState() => _SiteJournalPageState();
}

class _SiteJournalPageState extends State<SiteJournalPage> {
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<PlanningPhase2Bloc>().add(LoadJournal(widget.project.id));
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Site Journal', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          Text(widget.project.name, style: const TextStyle(fontSize: 12)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.refresh),
              onPressed: () => context.read<PlanningPhase2Bloc>().add(LoadJournal(widget.project.id))),
        ],
      ),
      body: BlocConsumer<PlanningPhase2Bloc, Phase2State>(
        listener: (ctx, state) {
          if (state is Phase2ActionSuccess) {
            ScaffoldMessenger.of(ctx).showSnackBar(
                SnackBar(content: Text(state.message), backgroundColor: Colors.green.shade700));
          }
          if (state is Phase2Error) {
            ScaffoldMessenger.of(ctx).showSnackBar(
                SnackBar(content: Text(state.message), backgroundColor: Colors.red.shade700));
          }
        },
        builder: (ctx, state) {
          if (state is Phase2Loading) return const Center(child: CircularProgressIndicator());
          if (state is! JournalLoaded) return const SizedBox.shrink();

          return RefreshIndicator(
            onRefresh: () async => context.read<PlanningPhase2Bloc>().add(LoadJournal(widget.project.id)),
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                if (ps.canCreateJournal)
                  _TodayCard(entry: state.todayEntry, project: widget.project),
                if (state.entries.isEmpty && state.todayEntry == null)
                  const Center(child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.book_outlined, size: 64, color: Colors.grey),
                      SizedBox(height: 12),
                      Text('No journal entries yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    ]),
                  ))
                else
                  ...state.entries.map((e) => Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: _JournalCard(
                      entry: e,
                      project: widget.project,
                      canUpdate: ps.canUpdateJournal,
                      onSubmit: (ps.canUpdateJournal && e.status == JournalStatus.draft)
                          ? () => context.read<PlanningPhase2Bloc>().add(SubmitJournal(widget.project.id, e.id)) : null,
                      onLock: (ps.canUpdateJournal && e.status == JournalStatus.submitted)
                          ? () => context.read<PlanningPhase2Bloc>().add(LockJournal(widget.project.id, e.id)) : null,
                      onReopen: (ps.canUpdateJournal && e.status != JournalStatus.draft)
                          ? () => context.read<PlanningPhase2Bloc>().add(ReopenJournal(widget.project.id, e.id)) : null,
                    ),
                  )),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  final SiteJournalEntry? entry;
  final Project project;
  const _TodayCard({this.entry, required this.project});

  @override
  Widget build(BuildContext context) {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final hasDraft = entry?.status == JournalStatus.draft;
    final color = entry == null ? Colors.blue : (hasDraft ? Colors.orange : Colors.green);
    return Card(
      color: color.shade50,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: color.shade200)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(Icons.today_outlined, color: color.shade700),
            const SizedBox(width: 8),
            Text(
              entry == null ? "Today's Entry — Not logged"
                  : (hasDraft ? "Today's Entry — Draft" : "Today's Entry — ${entry!.status.label}"),
              style: TextStyle(fontWeight: FontWeight.w700, color: color.shade700),
            ),
          ]),
          if (entry != null) ...[
            const SizedBox(height: 6),
            if (entry!.weather != null)
              Row(children: [
                Icon(entry!.weather!.icon, size: 14, color: Colors.grey.shade600),
                const SizedBox(width: 4),
                Text(entry!.weather!.label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                const SizedBox(width: 12),
                if (entry!.locationText != null)
                  Text(entry!.locationText!, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ]),
            const SizedBox(height: 4),
            Text(entry!.summary, style: const TextStyle(fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
            if (entry!.laborCount != null)
              Text('Headcount: ${entry!.laborCount}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ],
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => BlocProvider.value(
                value: context.read<PlanningPhase2Bloc>(),
                child: JournalEntryFormPage(project: project, date: today, existing: entry),
              ),
            )),
            icon: Icon(entry != null ? Icons.edit_outlined : Icons.add, size: 16),
            label: Text(entry != null ? 'Edit Entry' : "Add Today's Entry"),
            style: FilledButton.styleFrom(
              backgroundColor: color.shade700,
              minimumSize: const Size.fromHeight(38),
            ),
          ),
        ]),
      ),
    );
  }
}

class _JournalCard extends StatelessWidget {
  final SiteJournalEntry entry;
  final Project project;
  final bool canUpdate;
  final VoidCallback? onSubmit;
  final VoidCallback? onLock;
  final VoidCallback? onReopen;

  const _JournalCard({
    required this.entry, required this.project, required this.canUpdate,
    this.onSubmit, this.onLock, this.onReopen,
  });

  @override
  Widget build(BuildContext context) {
    DateTime? dt;
    try { dt = DateTime.parse(entry.date); } catch (_) {}
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: Theme.of(context).dividerColor)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(dt != null ? DateFormat('dd MMM yyyy, EEE').format(dt) : entry.date,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const Spacer(),
            // Status chip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: entry.status.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
              child: Text(entry.status.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: entry.status.color)),
            ),
          ]),
          if (entry.weather != null || entry.locationText != null) ...[
            const SizedBox(height: 4),
            Row(children: [
              if (entry.weather != null) ...[
                Icon(entry.weather!.icon, size: 13, color: Colors.grey.shade600),
                const SizedBox(width: 3),
                Text(entry.weather!.label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              ],
              if (entry.locationText?.isNotEmpty == true) ...[
                const SizedBox(width: 8),
                Icon(Icons.location_on_outlined, size: 13, color: Colors.grey.shade600),
                const SizedBox(width: 3),
                Flexible(child: Text(entry.locationText!, style: TextStyle(fontSize: 11, color: Colors.grey.shade600), overflow: TextOverflow.ellipsis)),
              ],
            ]),
          ],
          const SizedBox(height: 6),
          Text(entry.summary, style: const TextStyle(fontSize: 13)),
          if (entry.workDoneToday?.isNotEmpty == true) ...[
            const SizedBox(height: 4),
            _Line(Icons.construction_outlined, entry.workDoneToday!),
          ],
          if (entry.issuesRaised?.isNotEmpty == true) ...[
            const SizedBox(height: 4),
            _Line(Icons.warning_amber_outlined, entry.issuesRaised!, color: Colors.orange.shade700),
          ],
          if (entry.safetyObservations?.isNotEmpty == true) ...[
            const SizedBox(height: 4),
            _Line(Icons.health_and_safety_outlined, entry.safetyObservations!, color: Colors.teal.shade700),
          ],
          if (entry.laborCount != null) ...[
            const SizedBox(height: 4),
            _Line(Icons.groups_outlined, '${entry.laborCount} workers on site'),
          ],
          // Photos preview
          if (entry.photoUrls.isNotEmpty) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 64,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: entry.photoUrls.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (_, i) => ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: CachedNetworkImage(
                    imageUrl: ApiEndpoints.resolveUrl(entry.photoUrls[i]),
                    width: 64, height: 64, fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => Container(width: 64, height: 64, color: Colors.grey.shade200,
                        child: const Icon(Icons.broken_image_outlined, color: Colors.grey)),
                  ),
                ),
              ),
            ),
          ],
          // Lifecycle actions
          if (onSubmit != null || onLock != null || onReopen != null || entry.isEditable) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 6, children: [
              if (entry.isEditable && canUpdate)
                OutlinedButton.icon(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(
                    builder: (_) => BlocProvider.value(
                      value: context.read<PlanningPhase2Bloc>(),
                      child: JournalEntryFormPage(project: project, date: entry.date, existing: entry),
                    ),
                  )),
                  icon: const Icon(Icons.edit_outlined, size: 14),
                  label: const Text('Edit'),
                  style: OutlinedButton.styleFrom(textStyle: const TextStyle(fontSize: 12)),
                ),
              if (onSubmit != null)
                FilledButton.icon(
                  onPressed: onSubmit,
                  icon: const Icon(Icons.send_outlined, size: 14),
                  label: const Text('Submit'),
                  style: FilledButton.styleFrom(backgroundColor: Colors.blue.shade700, textStyle: const TextStyle(fontSize: 12)),
                ),
              if (onLock != null)
                FilledButton.icon(
                  onPressed: onLock,
                  icon: const Icon(Icons.lock_outline, size: 14),
                  label: const Text('Lock'),
                  style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700, textStyle: const TextStyle(fontSize: 12)),
                ),
              if (onReopen != null)
                OutlinedButton.icon(
                  onPressed: onReopen,
                  icon: const Icon(Icons.lock_open_outlined, size: 14),
                  label: const Text('Reopen'),
                  style: OutlinedButton.styleFrom(textStyle: const TextStyle(fontSize: 12)),
                ),
            ]),
          ],
        ]),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color? color;
  const _Line(this.icon, this.text, {this.color});
  @override
  Widget build(BuildContext context) {
    final c = color ?? Colors.grey.shade700;
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 13, color: c), const SizedBox(width: 5),
      Expanded(child: Text(text, style: TextStyle(fontSize: 12, color: c))),
    ]);
  }
}

// ── Journal Entry Form ─────────────────────────────────────────────────────────

class JournalEntryFormPage extends StatefulWidget {
  final Project project;
  final String date;
  final SiteJournalEntry? existing;
  const JournalEntryFormPage({super.key, required this.project, required this.date, this.existing});

  @override
  State<JournalEntryFormPage> createState() => _JournalEntryFormPageState();
}

class _JournalEntryFormPageState extends State<JournalEntryFormPage> {
  final _formKey = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _ctrls;
  WeatherCondition? _weather;
  String _journalType = 'DAILY_PROGRESS';
  bool _submitting = false;
  // EPS node selection for location (mirrors how site observations work)
  int? _epsNodeId;
  String? _epsNodeLabel; // display label from node name chain

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _epsNodeId = e?.epsNodeId;
    _epsNodeLabel = e?.locationText;
    _ctrls = {
      'summary': TextEditingController(text: e?.summary ?? ''),
      'locationText': TextEditingController(text: e?.locationText ?? ''),
      'workDoneToday': TextEditingController(text: e?.workDoneToday ?? ''),
      'progressNotes': TextEditingController(text: e?.progressNotes ?? ''),
      'issuesRaised': TextEditingController(text: e?.issuesRaised ?? ''),
      'safetyObservations': TextEditingController(text: e?.safetyObservations ?? ''),
      'qualityObservations': TextEditingController(text: e?.qualityObservations ?? ''),
      'decisionsTaken': TextEditingController(text: e?.decisionsTaken ?? ''),
      'instructionsGiven': TextEditingController(text: e?.instructionsGiven ?? ''),
      'materialReceived': TextEditingController(text: e?.materialReceived ?? ''),
      'delaysOrConstraints': TextEditingController(text: e?.delaysOrConstraints ?? ''),
      'tomorrowPlan': TextEditingController(text: e?.tomorrowPlan ?? ''),
      'laborCount': TextEditingController(text: e?.laborCount?.toString() ?? ''),
      'equipmentOnSite': TextEditingController(text: e?.equipmentOnSite ?? ''),
      'visitorsOnSite': TextEditingController(text: e?.visitorsOnSite ?? ''),
      'remarks': TextEditingController(text: e?.remarks ?? ''),
    };
    _weather = e?.weather;
    _journalType = e?.journalType ?? 'DAILY_PROGRESS';
  }

  @override
  void dispose() {
    for (final c in _ctrls.values) { c.dispose(); }
    super.dispose();
  }

  String? _v(String key) {
    final t = _ctrls[key]!.text.trim();
    return t.isNotEmpty ? t : null;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    final data = {
      'date': widget.date,
      'journalType': _journalType,
      if (_weather != null) 'weather': _weather!.apiValue,
      'summary': _ctrls['summary']!.text.trim(),
      if (_epsNodeId != null) 'epsNodeId': _epsNodeId,
      if ((_epsNodeLabel ?? _v('locationText')) != null)
        'locationText': _epsNodeLabel ?? _v('locationText'),
      if (_v('workDoneToday') != null) 'workDoneToday': _v('workDoneToday'),
      if (_v('progressNotes') != null) 'progressNotes': _v('progressNotes'),
      if (_v('issuesRaised') != null) 'issuesRaised': _v('issuesRaised'),
      if (_v('safetyObservations') != null) 'safetyObservations': _v('safetyObservations'),
      if (_v('qualityObservations') != null) 'qualityObservations': _v('qualityObservations'),
      if (_v('decisionsTaken') != null) 'decisionsTaken': _v('decisionsTaken'),
      if (_v('instructionsGiven') != null) 'instructionsGiven': _v('instructionsGiven'),
      if (_v('materialReceived') != null) 'materialReceived': _v('materialReceived'),
      if (_v('delaysOrConstraints') != null) 'delaysOrConstraints': _v('delaysOrConstraints'),
      if (_v('tomorrowPlan') != null) 'tomorrowPlan': _v('tomorrowPlan'),
      if (_v('laborCount') != null) 'laborCount': int.tryParse(_v('laborCount')!),
      if (_v('equipmentOnSite') != null) 'equipmentOnSite': _v('equipmentOnSite'),
      if (_v('visitorsOnSite') != null) 'visitorsOnSite': _v('visitorsOnSite'),
      if (_v('remarks') != null) 'remarks': _v('remarks'),
      'tags': [],
    };
    if (mounted) {
      context.read<PlanningPhase2Bloc>().add(SaveJournalEntry(widget.project.id, data, existingId: widget.existing?.id));
      Navigator.of(context).pop();
    }
  }

  /// Opens a searchable EPS node picker and returns (epsNodeId, label) or null.
  Future<(int, String)?> _pickLocation(BuildContext context) async {
    final api = sl<SetuApiClient>();
    // Flatten EPS tree into a searchable list
    List<Map<String, dynamic>> nodes = [];
    try {
      final raw = await api.getEpsTreeForProject(widget.project.id);
      void flatten(List<dynamic> list, String prefix) {
        for (final n in list) {
          final m = n as Map<String, dynamic>;
          final label = prefix.isEmpty ? (m['label'] ?? m['name'] ?? '') as String
              : '$prefix > ${(m['label'] ?? m['name'] ?? '')}';
          nodes.add({'id': m['id'], 'label': label, 'type': m['type'] ?? ''});
          final children = m['children'] as List<dynamic>? ?? [];
          if (children.isNotEmpty) flatten(children, label);
        }
      }
      flatten(raw, '');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not load location tree — check connection')));
      }
      return null;
    }
    if (!mounted) return null;
    return showModalBottomSheet<(int, String)>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => _EpsPickerSheet(nodes: nodes),
    );
  }

  Future<void> _uploadPhotos() async {
    if (widget.existing == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Save the entry first, then add photos')));
      return;
    }
    final picker = ImagePicker();
    final files = await picker.pickMultiImage(imageQuality: 80);
    if (files.isEmpty || !mounted) return;
    context.read<PlanningPhase2Bloc>().add(
        UploadJournalPhotos(widget.project.id, widget.existing!.id, files.map((f) => f.path).toList()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existing == null ? 'Add Journal Entry' : 'Edit Journal Entry',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.photo_camera_outlined), onPressed: _uploadPhotos, tooltip: 'Add Photos'),
          TextButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(DateFormat('EEEE, dd MMMM yyyy').format(DateTime.tryParse(widget.date) ?? DateTime.now()),
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 16),
            // Journal type
            DropdownButtonFormField<String>(
              initialValue: _journalType,
              decoration: const InputDecoration(labelText: 'Journal Type', border: OutlineInputBorder(), isDense: true),
              items: ['DAILY_PROGRESS', 'WEEKLY_REVIEW', 'INCIDENT', 'INSPECTION', 'SPECIAL_EVENT']
                  .map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' '), style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) { if (v != null) setState(() => _journalType = v); },
            ),
            const SizedBox(height: 12),
            // Weather
            const Text('Weather', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8, runSpacing: 4,
              children: WeatherCondition.values.map((w) => ChoiceChip(
                label: Row(mainAxisSize: MainAxisSize.min, children: [Icon(w.icon, size: 14), const SizedBox(width: 4), Text(w.label)]),
                selected: _weather == w,
                onSelected: (_) => setState(() => _weather = w),
              )).toList(),
            ),
            const SizedBox(height: 12),
            _F(_ctrls['summary']!, 'Day Summary *', maxLines: 3, required: true),
            const SizedBox(height: 10),
            // EPS location picker — shows current selection and opens a floor/unit selector
            InkWell(
              onTap: () async {
                final result = await _pickLocation(context);
                if (result != null) {
                  setState(() { _epsNodeId = result.$1; _epsNodeLabel = result.$2; });
                }
              },
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Location (EPS Node)',
                  border: OutlineInputBorder(),
                  isDense: true,
                  suffixIcon: Icon(Icons.location_on_outlined, size: 18),
                ),
                child: Text(
                  _epsNodeLabel ?? 'Select location (optional)',
                  style: TextStyle(color: _epsNodeLabel == null ? Colors.grey.shade500 : null, fontSize: 13),
                ),
              ),
            ),
            const SizedBox(height: 8),
            _F(_ctrls['locationText']!, 'Location Detail (floor, unit, area — optional)'),
            const SizedBox(height: 10),
            _F(_ctrls['workDoneToday']!, 'Work Done Today', maxLines: 2),
            const SizedBox(height: 10),
            _F(_ctrls['progressNotes']!, 'Progress Notes vs Baseline', maxLines: 2),
            const SizedBox(height: 10),
            _F(_ctrls['issuesRaised']!, 'Issues Raised', maxLines: 2),
            const SizedBox(height: 10),
            _F(_ctrls['safetyObservations']!, 'Safety Observations', maxLines: 2),
            const SizedBox(height: 10),
            _F(_ctrls['qualityObservations']!, 'Quality Observations', maxLines: 2),
            const SizedBox(height: 10),
            _F(_ctrls['decisionsTaken']!, 'Decisions Taken', maxLines: 2),
            const SizedBox(height: 10),
            _F(_ctrls['instructionsGiven']!, 'Instructions Given', maxLines: 2),
            const SizedBox(height: 10),
            _F(_ctrls['materialReceived']!, 'Material Received'),
            const SizedBox(height: 10),
            _F(_ctrls['delaysOrConstraints']!, 'Delays / Constraints', maxLines: 2),
            const SizedBox(height: 10),
            _F(_ctrls['tomorrowPlan']!, "Tomorrow's Plan", maxLines: 2),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: _F(_ctrls['laborCount']!, 'Headcount', keyboardType: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: _F(_ctrls['visitorsOnSite']!, 'Visitors')),
            ]),
            const SizedBox(height: 10),
            _F(_ctrls['equipmentOnSite']!, 'Equipment on Site'),
            const SizedBox(height: 10),
            _F(_ctrls['remarks']!, 'Remarks', maxLines: 2),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.save_outlined),
              label: const Text('Save Journal Entry'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
            ),
          ],
        ),
      ),
    );
  }
}

class _F extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final int maxLines;
  final bool required;
  final TextInputType? keyboardType;
  const _F(this.controller, this.label, {this.maxLines = 1, this.required = false, this.keyboardType});

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: controller,
    maxLines: maxLines,
    keyboardType: keyboardType,
    decoration: InputDecoration(labelText: label, border: const OutlineInputBorder(), isDense: true),
    validator: required ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null : null,
  );
}

/// Simple searchable EPS node picker shown as a bottom sheet.
class _EpsPickerSheet extends StatefulWidget {
  final List<Map<String, dynamic>> nodes;
  const _EpsPickerSheet({required this.nodes});

  @override
  State<_EpsPickerSheet> createState() => _EpsPickerSheetState();
}

class _EpsPickerSheetState extends State<_EpsPickerSheet> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _filtered = [];

  @override
  void initState() {
    super.initState();
    _filtered = widget.nodes;
    _searchCtrl.addListener(() {
      final q = _searchCtrl.text.toLowerCase();
      setState(() => _filtered = q.isEmpty
          ? widget.nodes
          : widget.nodes.where((n) => (n['label'] as String).toLowerCase().contains(q)).toList());
    });
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      expand: false,
      builder: (_, scrollCtrl) => Column(children: [
        Center(child: Container(
          margin: const EdgeInsets.only(top: 12, bottom: 8),
          width: 40, height: 4,
          decoration: BoxDecoration(color: Theme.of(context).dividerColor, borderRadius: BorderRadius.circular(2)),
        )),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            const Text('Select Location', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const Spacer(),
            TextButton(onPressed: () => Navigator.pop(context, null), child: const Text('Skip')),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchCtrl,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Search block, tower, floor…',
              prefixIcon: Icon(Icons.search, size: 18),
              border: OutlineInputBorder(),
              isDense: true,
              contentPadding: EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            controller: scrollCtrl,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
            itemCount: _filtered.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final n = _filtered[i];
              final label = n['label'] as String;
              final type = n['type'] as String? ?? '';
              return ListTile(
                dense: true,
                leading: Icon(
                  type == 'FLOOR' ? Icons.layers_outlined
                      : type == 'TOWER' || type == 'BUILDING' ? Icons.apartment_outlined
                      : type == 'UNIT' ? Icons.door_front_door_outlined
                      : Icons.account_tree_outlined,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                ),
                title: Text(label, style: const TextStyle(fontSize: 13)),
                onTap: () => Navigator.pop(context, (n['id'] as int, label)),
              );
            },
          ),
        ),
      ]),
    );
  }
}
