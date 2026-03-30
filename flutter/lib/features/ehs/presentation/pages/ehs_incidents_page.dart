import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/core/widgets/offline_banner.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_incident_bloc.dart';

/// EHS Incidents page — lists all safety incidents for the project.
/// Shows a scrollable card list with a FAB to report new incidents.
/// FAB is gated behind [PermissionService.canCreateEhsIncident].
class EhsIncidentsPage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const EhsIncidentsPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<EhsIncidentsPage> createState() => _EhsIncidentsPageState();
}

class _EhsIncidentsPageState extends State<EhsIncidentsPage> {
  @override
  void initState() {
    super.initState();
    // Dispatch the initial load immediately on construction
    _load();
  }

  /// Dispatches a full load (shows spinner) via [EhsIncidentBloc].
  void _load() =>
      context.read<EhsIncidentBloc>().add(LoadEhsIncidents(widget.projectId));

  /// Dispatches a refresh (pull-to-refresh, no spinner) via [EhsIncidentBloc].
  void _refresh() => context
      .read<EhsIncidentBloc>()
      .add(RefreshEhsIncidents(widget.projectId));

  /// Opens the [_CreateIncidentSheet] as a modal bottom sheet.
  /// The sheet shares the parent's [EhsIncidentBloc] via [BlocProvider.value].
  Future<void> _openCreateForm() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => BlocProvider.value(
        // Pass the existing bloc so the sheet can dispatch CreateEhsIncident
        value: context.read<EhsIncidentBloc>(),
        child: _CreateIncidentSheet(projectId: widget.projectId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Read permissions to gate the FAB
    final ps = PermissionService.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('EHS Incidents',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.projectName,
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.normal),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ],
        ),
        actions: [
          // Manual refresh button
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
        ],
      ),
      // FAB shown only when user has create permission
      floatingActionButton: ps.canCreateEhsIncident
          ? FloatingActionButton.extended(
              onPressed: _openCreateForm,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Report'),
              backgroundColor: const Color(0xFFB91C1C),
            )
          : null,
      body: BlocConsumer<EhsIncidentBloc, EhsIncidentState>(
        listener: (context, state) {
          // On successful create: dismiss any open sheets, show green snack, reload list
          if (state is EhsIncidentActionSuccess) {
            Navigator.of(context).popUntil((r) => r.isFirst || r.isCurrent);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Colors.green,
              ),
            );
            _load();
          } else if (state is EhsIncidentActionError) {
            // Show error message from the bloc as a red snack
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Theme.of(context).colorScheme.error,
              ),
            );
          }
        },
        builder: (context, state) {
          // Full-page spinner on initial load (not refresh)
          if (state is EhsIncidentLoading && !state.isRefresh) {
            return const Center(child: CircularProgressIndicator());
          }
          // Full-page error with retry button
          if (state is EhsIncidentError) {
            return _ErrorView(message: state.message, onRetry: _load);
          }
          // Extract incidents list from the loaded state, default to empty
          final incidents =
              state is EhsIncidentLoaded ? state.incidents : <EhsIncident>[];

          // Empty state — shows prompt to report the first incident
          if (incidents.isEmpty) {
            return _EmptyView(
              canCreate: ps.canCreateEhsIncident,
              onReport: _openCreateForm,
            );
          }

          // Pull-to-refresh wraps the incident card list
          final fromCache =
              state is EhsIncidentLoaded && state.fromCache;
          return Column(
            children: [
              if (fromCache) const OfflineBanner(),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => _refresh(),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
                    itemCount: incidents.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => RepaintBoundary(
                      child: _IncidentCard(incident: incidents[i]),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─── Incident card ────────────────────────────────────────────────────────────

/// Card widget for a single EHS incident.
/// Shows type badge, status badge, date, description, location, days-lost,
/// and first-aid / hospital-visit indicator badges.
class _IncidentCard extends StatelessWidget {
  final EhsIncident incident;
  const _IncidentCard({required this.incident});

  @override
  Widget build(BuildContext context) {
    final type = incident.incidentType;
    final status = incident.status;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        // Left border tinted with the incident type colour for quick scanning
        side: BorderSide(
          color: type.color.withValues(alpha: 0.4),
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Incident type badge (Near Miss / FA / MTC / LTI / Fatality)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: type.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: type.color.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_amber_rounded,
                          size: 12, color: type.color),
                      const SizedBox(width: 4),
                      Text(
                        type.label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: type.color,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                // Status badge (Open / Under Investigation / Closed)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: status.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    status.label,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: status.color,
                    ),
                  ),
                ),
                const Spacer(),
                // Incident date aligned to the right
                Text(
                  incident.incidentDate,
                  style: TextStyle(
                    fontSize: 11,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Description capped at 2 lines
            Text(
              incident.description,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w500),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.location_on_outlined,
                    size: 13,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.5)),
                const SizedBox(width: 4),
                // Location shown truncated to one line
                Flexible(
                  child: Text(
                    incident.location,
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.6),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                // Days-lost chip — only shown for MTC/LTI incident types
                if (incident.daysLost > 0) ...[
                  const SizedBox(width: 12),
                  const Icon(Icons.schedule_rounded,
                      size: 12, color: Color(0xFF7C3AED)),
                  const SizedBox(width: 3),
                  Text(
                    '${incident.daysLost} day${incident.daysLost > 1 ? 's' : ''} lost',
                    style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF7C3AED),
                        fontWeight: FontWeight.w600),
                  ),
                ],
                // First-aid and hospital-visit indicator badges
                if (incident.firstAidGiven || incident.hospitalVisit) ...[
                  const Spacer(),
                  if (incident.firstAidGiven)
                    const _Badge(
                        icon: Icons.medical_services_outlined,
                        label: 'FA',
                        color: Color(0xFF3B82F6)),
                  if (incident.hospitalVisit)
                    const _Badge(
                        icon: Icons.local_hospital_outlined,
                        label: 'Hospital',
                        color: Color(0xFFEF4444)),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact pill badge used for First Aid and Hospital Visit indicators on incident cards.
class _Badge extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _Badge({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 3),
          Text(label,
              style: TextStyle(
                  fontSize: 10,
                  color: color,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ─── Create incident sheet ────────────────────────────────────────────────────

/// Modal bottom sheet form for reporting a new EHS incident.
/// Collects date, type, location, description, cause, affected persons,
/// first-aid/hospital flags, and days lost (for MTC/LTI types only).
class _CreateIncidentSheet extends StatefulWidget {
  final int projectId;
  const _CreateIncidentSheet({required this.projectId});

  @override
  State<_CreateIncidentSheet> createState() => _CreateIncidentSheetState();
}

class _CreateIncidentSheetState extends State<_CreateIncidentSheet> {
  final _formKey = GlobalKey<FormState>();
  DateTime _incidentDate = DateTime.now();
  IncidentType _type = IncidentType.nearMiss;
  final _locationCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _causeCtrl = TextEditingController();
  final _affectedCtrl = TextEditingController();
  bool _firstAid = false;
  bool _hospital = false;
  int _daysLost = 0;
  // Guards the submit button against double-tap while the bloc processes
  bool _submitting = false;

  @override
  void dispose() {
    _locationCtrl.dispose();
    _descCtrl.dispose();
    _causeCtrl.dispose();
    _affectedCtrl.dispose();
    super.dispose();
  }

  /// Returns the incident date formatted as YYYY-MM-DD for the API payload.
  String get _dateString =>
      '${_incidentDate.year}-${_incidentDate.month.toString().padLeft(2, '0')}-${_incidentDate.day.toString().padLeft(2, '0')}';

  /// Opens the system date picker, bounded to the last 365 days.
  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _incidentDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _incidentDate = picked);
  }

  /// Validates the form then dispatches [CreateEhsIncident] to the bloc.
  /// Parses the affected-persons field as a comma-separated list.
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    // Split comma-separated names and strip whitespace
    final affected = _affectedCtrl.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    context.read<EhsIncidentBloc>().add(CreateEhsIncident(
          projectId: widget.projectId,
          incidentDate: _dateString,
          incidentType: _type,
          location: _locationCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          immediateCause: _causeCtrl.text.trim(),
          affectedPersons: affected,
          firstAidGiven: _firstAid,
          hospitalVisit: _hospital,
          daysLost: _daysLost,
        ));

    // Dismiss the sheet immediately; the parent listener handles the result snack
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    // Days-lost stepper is only relevant for MTC (Medical Treatment Case) and LTI (Lost Time Injury)
    final needsDaysLost =
        _type == IncidentType.mtc || _type == IncidentType.lti;

    return Padding(
      // Shift sheet above keyboard when it appears
      padding: EdgeInsets.fromLTRB(
          16, 20, 16, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Text(
                'Report EHS Incident',
                style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 20),

              // Incident date picker (tappable row styled as a form field)
              InkWell(
                onTap: _pickDate,
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Incident Date',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.calendar_today_outlined),
                  ),
                  child: Text(
                    '${_incidentDate.day.toString().padLeft(2, '0')}/${_incidentDate.month.toString().padLeft(2, '0')}/${_incidentDate.year}',
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Incident type dropdown — drives days-lost visibility
              DropdownButtonFormField<IncidentType>(
                value: _type,
                decoration: const InputDecoration(
                  labelText: 'Incident Type *',
                  border: OutlineInputBorder(),
                ),
                items: IncidentType.values
                    .map((t) => DropdownMenuItem(
                          value: t,
                          child: Text(t.label),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _type = v!),
              ),
              const SizedBox(height: 12),

              // Location field — required
              TextFormField(
                controller: _locationCtrl,
                decoration: const InputDecoration(
                  labelText: 'Location *',
                  border: OutlineInputBorder(),
                  hintText: 'e.g. Floor 3, Block A',
                ),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),

              // Description field — required, up to 3 lines
              TextFormField(
                controller: _descCtrl,
                decoration: const InputDecoration(
                  labelText: 'Description *',
                  border: OutlineInputBorder(),
                  hintText: 'What happened?',
                ),
                maxLines: 3,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),

              // Immediate cause — required root-cause description
              TextFormField(
                controller: _causeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Immediate Cause *',
                  border: OutlineInputBorder(),
                  hintText: 'Direct cause of the incident',
                ),
                maxLines: 2,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),

              // Affected persons — optional, comma-separated names
              TextFormField(
                controller: _affectedCtrl,
                decoration: const InputDecoration(
                  labelText: 'Affected Persons',
                  border: OutlineInputBorder(),
                  hintText: 'Comma-separated names (optional)',
                ),
              ),
              const SizedBox(height: 12),

              // First Aid and Hospital Visit checkboxes side by side
              Row(
                children: [
                  Expanded(
                    child: CheckboxListTile(
                      dense: true,
                      title: const Text('First Aid', style: TextStyle(fontSize: 13)),
                      value: _firstAid,
                      onChanged: (v) => setState(() => _firstAid = v!),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  Expanded(
                    child: CheckboxListTile(
                      dense: true,
                      title: const Text('Hospital Visit', style: TextStyle(fontSize: 13)),
                      value: _hospital,
                      onChanged: (v) => setState(() => _hospital = v!),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),

              // Days-lost stepper — only shown for MTC and LTI incident types
              if (needsDaysLost) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Text('Days Lost: ',
                        style: TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(width: 8),
                    // Decrement clamped to 0
                    IconButton(
                      onPressed: () =>
                          setState(() => _daysLost = (_daysLost - 1).clamp(0, 999)),
                      icon: const Icon(Icons.remove_circle_outline),
                      iconSize: 20,
                    ),
                    Text('$_daysLost',
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w700)),
                    IconButton(
                      onPressed: () => setState(() => _daysLost++),
                      icon: const Icon(Icons.add_circle_outline),
                      iconSize: 20,
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 20),
              // Submit button — shows inline spinner while submitting
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded),
                  label: Text(_submitting ? 'Reporting...' : 'Report Incident'),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFB91C1C)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Empty / Error views ──────────────────────────────────────────────────────

/// Empty state shown when no incidents exist for the project.
/// Optionally shows a "Report Incident" button when the user has create permission.
class _EmptyView extends StatelessWidget {
  final bool canCreate;
  final VoidCallback onReport;
  const _EmptyView({required this.canCreate, required this.onReport});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.health_and_safety_outlined,
                size: 56,
                color: const Color(0xFFB91C1C).withValues(alpha: 0.3)),
            const SizedBox(height: 16),
            Text('No incidents recorded',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(
              'Site is incident-free — stay safe out there',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
            ),
            // Report button only shown when user has create permission
            if (canCreate) ...[
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onReport,
                icon: const Icon(Icons.add_rounded, size: 16),
                label: const Text('Report Incident'),
                style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFB91C1C)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Full-page error state with a message and retry button.
class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded,
                size: 48,
                color: Theme.of(context)
                    .colorScheme
                    .error
                    .withValues(alpha: 0.6)),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600)),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
