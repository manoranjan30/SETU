import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_dashboard_bloc.dart';

class EhsHubPage extends StatelessWidget {
  final int projectId;
  final String projectName;

  const EhsHubPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => EhsDashboardBloc(apiClient: sl<SetuApiClient>())
        ..add(LoadEhsDashboard(projectId)),
      child: _EhsHubView(projectId: projectId, projectName: projectName),
    );
  }
}

class _EhsHubView extends StatefulWidget {
  final int projectId;
  final String projectName;

  const _EhsHubView({required this.projectId, required this.projectName});

  @override
  State<_EhsHubView> createState() => _EhsHubViewState();
}

class _EhsHubViewState extends State<_EhsHubView> with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  static const _tabs = [
    EhsTab.overview,
    EhsTab.performance,
    EhsTab.manhours,
    EhsTab.training,
    EhsTab.legal,
    EhsTab.machinery,
    EhsTab.vehicles,
  ];

  static const _tabLabels = [
    'Overview',
    'Performance',
    'Manhours',
    'Training',
    'Legal',
    'Machinery',
    'Vehicles',
  ];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<EhsDashboardBloc, EhsDashboardState>(
      listener: (context, state) {
        if (state is EhsDashboardError) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.red.shade700,
          ));
        }
        if (state is EhsDashboardActionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.green.shade700,
          ));
        }
      },
      builder: (context, state) {
        final EhsDashboardLoaded? loaded = switch (state) {
          EhsDashboardLoaded s => s,
          EhsDashboardTabLoading s => s.base,
          EhsDashboardActionSuccess s => s.data,
          _ => null,
        };

        final isLoading = state is EhsDashboardLoading;
        final isTabLoading = state is EhsDashboardTabLoading;

        return Scaffold(
          appBar: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('EHS Hub', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                Text(widget.projectName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal)),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh),
                tooltip: 'Refresh',
                onPressed: () => context.read<EhsDashboardBloc>().add(LoadEhsDashboard(widget.projectId)),
              ),
            ],
            bottom: TabBar(
              controller: _tabCtrl,
              isScrollable: true,
              tabs: _tabLabels.map((l) => Tab(text: l)).toList(),
            ),
          ),
          body: isLoading
              ? const Center(child: CircularProgressIndicator())
              : loaded == null
                  ? _EhsErrorView(projectId: widget.projectId)
                  : Stack(
                      children: [
                        TabBarView(
                          controller: _tabCtrl,
                          children: [
                            _OverviewTab(data: loaded, projectId: widget.projectId),
                            _PerformanceTab(data: loaded, projectId: widget.projectId),
                            _ManhoursTab(data: loaded, projectId: widget.projectId),
                            _TrainingTab(data: loaded, projectId: widget.projectId),
                            _LegalTab(data: loaded, projectId: widget.projectId),
                            _MachineryTab(data: loaded, projectId: widget.projectId),
                            _VehiclesTab(data: loaded, projectId: widget.projectId),
                          ],
                        ),
                        if (isTabLoading)
                          const Positioned(
                            top: 0, left: 0, right: 0,
                            child: LinearProgressIndicator(),
                          ),
                      ],
                    ),
        );
      },
    );
  }
}

class _EhsErrorView extends StatelessWidget {
  final int projectId;
  const _EhsErrorView({required this.projectId});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off, size: 48, color: Colors.grey),
          const SizedBox(height: 16),
          const Text('Failed to load EHS data', style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => context.read<EhsDashboardBloc>().add(LoadEhsDashboard(projectId)),
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// Tab: Overview
// ============================================================

class _OverviewTab extends StatelessWidget {
  final EhsDashboardLoaded data;
  final int projectId;
  const _OverviewTab({required this.data, required this.projectId});

  @override
  Widget build(BuildContext context) {
    final s = data.summary;
    if (s == null) {
      return _EmptyCard(
        label: 'No summary data',
        onRefresh: () => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.overview)),
      );
    }
    return RefreshIndicator(
      onRefresh: () async => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.overview)),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const _SectionTitle('Safety KPIs'),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.6,
            children: [
              _KpiCard(label: 'Total Incidents', value: '${s.totalIncidents}',
                  color: s.totalIncidents > 0 ? Colors.red.shade700 : Colors.green.shade700,
                  icon: Icons.warning_amber_outlined),
              _KpiCard(label: 'Near Misses', value: '${s.nearMissCount}',
                  color: Colors.orange.shade700, icon: Icons.remove_circle_outline),
              _KpiCard(label: 'Open Observations', value: '${s.openObservations}',
                  color: Colors.blue.shade700, icon: Icons.visibility_outlined),
              _KpiCard(label: 'Workers On Site', value: '${s.totalWorkersOnSite}',
                  color: Colors.indigo.shade700, icon: Icons.groups_outlined),
            ],
          ),
          const SizedBox(height: 16),
          const _SectionTitle('Compliance'),
          const SizedBox(height: 8),
          _ComplianceBar(label: 'Training Compliance', percent: s.trainingCompliancePercent),
          const SizedBox(height: 8),
          _ComplianceBar(label: 'Legal Compliance', percent: s.legalCompliancePercent),
          const SizedBox(height: 16),
          const _SectionTitle('This Month'),
          const SizedBox(height: 8),
          _KpiCard(
            label: 'Total Manhours',
            value: '${s.totalManhoursThisMonth}',
            color: Colors.teal.shade700,
            icon: Icons.access_time_outlined,
          ),
        ],
      ),
    );
  }
}

// ============================================================
// Tab: Performance
// ============================================================

class _PerformanceTab extends StatelessWidget {
  final EhsDashboardLoaded data;
  final int projectId;
  const _PerformanceTab({required this.data, required this.projectId});

  @override
  Widget build(BuildContext context) {
    final p = data.performance;
    if (p == null) {
      return _EmptyCard(
        label: 'No performance data',
        onRefresh: () => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.performance)),
      );
    }
    return RefreshIndicator(
      onRefresh: () async => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.performance)),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.6,
            children: [
              _KpiCard(label: 'TRIFR', value: p.trifr.toStringAsFixed(2),
                  color: Colors.red.shade700, icon: Icons.trending_up_outlined),
              _KpiCard(label: 'Near Miss Rate', value: p.nearMissRate.toStringAsFixed(2),
                  color: Colors.orange.shade700, icon: Icons.remove_circle_outline),
              _KpiCard(label: 'LTI Count', value: '${p.ltiCount}',
                  color: Colors.red.shade900, icon: Icons.personal_injury_outlined),
              _KpiCard(label: 'First Aid', value: '${p.firstAidCount}',
                  color: Colors.blue.shade700, icon: Icons.medical_services_outlined),
            ],
          ),
          if (p.incidentTrend.isNotEmpty) ...[
            const SizedBox(height: 16),
            const _SectionTitle('Incident Trend (Monthly)'),
            const SizedBox(height: 8),
            ...p.incidentTrend.map((pt) => _TrendRow(month: pt.monthLabel, count: pt.count)),
          ],
        ],
      ),
    );
  }
}

// ============================================================
// Tab: Manhours
// ============================================================

class _ManhoursTab extends StatelessWidget {
  final EhsDashboardLoaded data;
  final int projectId;
  const _ManhoursTab({required this.data, required this.projectId});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.manhours)),
        child: data.manhours.isEmpty
            ? _EmptyCard(
                label: 'No manhours records',
                onRefresh: () => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.manhours)),
              )
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: data.manhours.length,
                itemBuilder: (context, i) {
                  final r = data.manhours[i];
                  return _InfoCard(
                    title: r.month,
                    subtitle: '${r.totalManhours} manhours · ${r.totalWorkers} workers · ${r.tbmCount} TBMs',
                    icon: Icons.access_time_outlined,
                    iconColor: Colors.teal.shade700,
                    trailing: r.remarks,
                  );
                },
              ),
      ),
      floatingActionButton: ps.canReadEhsDashboard
          ? FloatingActionButton.small(
              onPressed: () => _showManhoursForm(context),
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  void _showManhoursForm(BuildContext context) {
    final monthCtrl = TextEditingController();
    final hoursCtrl = TextEditingController();
    final workersCtrl = TextEditingController();
    final tbmCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16, right: 16, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Add Manhours Record', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(controller: monthCtrl, decoration: const InputDecoration(
              labelText: 'Month (YYYY-MM) *', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: hoursCtrl, keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Total Manhours *', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: workersCtrl, keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Total Workers', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: tbmCtrl, keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'TBM Count', border: OutlineInputBorder())),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () {
                    if (monthCtrl.text.trim().isEmpty || hoursCtrl.text.trim().isEmpty) return;
                    context.read<EhsDashboardBloc>().add(CreateEhsManhours(projectId, {
                      'month': monthCtrl.text.trim(),
                      'totalManhours': int.tryParse(hoursCtrl.text) ?? 0,
                      'totalWorkers': int.tryParse(workersCtrl.text) ?? 0,
                      'tbmCount': int.tryParse(tbmCtrl.text) ?? 0,
                    }));
                    Navigator.pop(ctx);
                  },
                  child: const Text('Add'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// Tab: Training
// ============================================================

class _TrainingTab extends StatelessWidget {
  final EhsDashboardLoaded data;
  final int projectId;
  const _TrainingTab({required this.data, required this.projectId});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.training)),
        child: data.training.isEmpty
            ? _EmptyCard(label: 'No training records',
                onRefresh: () => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.training)))
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: data.training.length,
                itemBuilder: (context, i) {
                  final r = data.training[i];
                  return _InfoCard(
                    title: r.topic,
                    subtitle: '${r.trainingType} · ${r.participantCount} participants',
                    icon: Icons.school_outlined,
                    iconColor: Colors.indigo.shade700,
                    statusLabel: r.status,
                    statusColor: r.statusColor,
                    trailing: r.trainingDate,
                    alert: r.isExpired ? 'Expired' : null,
                  );
                },
              ),
      ),
      floatingActionButton: ps.canReadEhsDashboard
          ? FloatingActionButton.small(
              onPressed: () => _showTrainingForm(context),
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  void _showTrainingForm(BuildContext context) {
    final topicCtrl = TextEditingController();
    final trainerCtrl = TextEditingController();
    final participantsCtrl = TextEditingController();
    String type = 'INDUCTION';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Add Training Record', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Training Type', border: OutlineInputBorder()),
                items: ['INDUCTION', 'SKILL', 'REFRESHER', 'CERTIFICATION']
                    .map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                onChanged: (v) => setModalState(() => type = v ?? 'INDUCTION'),
              ),
              const SizedBox(height: 8),
              TextField(controller: topicCtrl, decoration: const InputDecoration(
                  labelText: 'Topic *', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: trainerCtrl, decoration: const InputDecoration(
                  labelText: 'Trainer Name', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: participantsCtrl, keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Participants', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () {
                      if (topicCtrl.text.trim().isEmpty) return;
                      context.read<EhsDashboardBloc>().add(CreateEhsTraining(projectId, {
                        'trainingType': type,
                        'topic': topicCtrl.text.trim(),
                        'trainerName': trainerCtrl.text.trim().isEmpty ? null : trainerCtrl.text.trim(),
                        'participantCount': int.tryParse(participantsCtrl.text) ?? 0,
                      }));
                      Navigator.pop(ctx);
                    },
                    child: const Text('Add'),
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

// ============================================================
// Tab: Legal Compliance
// ============================================================

class _LegalTab extends StatelessWidget {
  final EhsDashboardLoaded data;
  final int projectId;
  const _LegalTab({required this.data, required this.projectId});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.legal)),
        child: data.legal.isEmpty
            ? _EmptyCard(label: 'No legal items',
                onRefresh: () => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.legal)))
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: data.legal.length,
                itemBuilder: (context, i) {
                  final item = data.legal[i];
                  return _InfoCard(
                    title: item.description,
                    subtitle: item.licenseType + (item.licenseNumber != null ? ' · ${item.licenseNumber}' : ''),
                    icon: Icons.gavel_outlined,
                    iconColor: Colors.deepPurple.shade700,
                    statusLabel: item.status,
                    statusColor: item.statusColor,
                    trailing: item.expiryDate != null ? 'Expires: ${item.expiryDate}' : null,
                    alert: item.isExpired
                        ? 'Expired'
                        : item.isExpiringSoon
                            ? 'Expiring soon'
                            : null,
                  );
                },
              ),
      ),
      floatingActionButton: ps.canReadEhsDashboard
          ? FloatingActionButton.small(
              onPressed: () => _showLegalForm(context),
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  void _showLegalForm(BuildContext context) {
    final descCtrl = TextEditingController();
    final licNoCtrl = TextEditingController();
    final authorityCtrl = TextEditingController();
    final expiryCtrl = TextEditingController();
    String type = 'LABOUR_LICENSE';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Add Legal Item', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'License Type', border: OutlineInputBorder()),
                items: ['LABOUR_LICENSE', 'FACTORY_LICENSE', 'FIRE_NOC', 'POLLUTION_NOC', 'BUILDING_PERMIT', 'OTHER']
                    .map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ')))).toList(),
                onChanged: (v) => setModalState(() => type = v ?? 'LABOUR_LICENSE'),
              ),
              const SizedBox(height: 8),
              TextField(controller: descCtrl, decoration: const InputDecoration(
                  labelText: 'Description *', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: licNoCtrl, decoration: const InputDecoration(
                  labelText: 'License Number', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: authorityCtrl, decoration: const InputDecoration(
                  labelText: 'Issuing Authority', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: expiryCtrl, decoration: const InputDecoration(
                  labelText: 'Expiry Date (YYYY-MM-DD)', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () {
                      if (descCtrl.text.trim().isEmpty) return;
                      context.read<EhsDashboardBloc>().add(CreateEhsLegal(projectId, {
                        'licenseType': type,
                        'description': descCtrl.text.trim(),
                        if (licNoCtrl.text.trim().isNotEmpty) 'licenseNumber': licNoCtrl.text.trim(),
                        if (authorityCtrl.text.trim().isNotEmpty) 'issuingAuthority': authorityCtrl.text.trim(),
                        if (expiryCtrl.text.trim().isNotEmpty) 'expiryDate': expiryCtrl.text.trim(),
                      }));
                      Navigator.pop(ctx);
                    },
                    child: const Text('Add'),
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

// ============================================================
// Tab: Machinery
// ============================================================

class _MachineryTab extends StatelessWidget {
  final EhsDashboardLoaded data;
  final int projectId;
  const _MachineryTab({required this.data, required this.projectId});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.machinery)),
        child: data.machinery.isEmpty
            ? _EmptyCard(label: 'No machinery records',
                onRefresh: () => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.machinery)))
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: data.machinery.length,
                itemBuilder: (context, i) {
                  final r = data.machinery[i];
                  return _InfoCard(
                    title: r.machineName ?? r.machineryType,
                    subtitle: r.machineryType + (r.equipmentId != null ? ' · ${r.equipmentId}' : ''),
                    icon: Icons.construction_outlined,
                    iconColor: Colors.brown.shade700,
                    statusLabel: r.status,
                    statusColor: r.statusColor,
                    trailing: 'Inspected: ${r.inspectionDate}',
                  );
                },
              ),
      ),
      floatingActionButton: ps.canReadEhsDashboard
          ? FloatingActionButton.small(
              onPressed: () => _showMachineryForm(context),
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  void _showMachineryForm(BuildContext context) {
    final typeCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final idCtrl = TextEditingController();
    final operatorCtrl = TextEditingController();
    final dateCtrl = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
    String status = 'FIT';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Add Machinery Record', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextField(controller: typeCtrl, decoration: const InputDecoration(
                  labelText: 'Machinery Type *', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: nameCtrl, decoration: const InputDecoration(
                  labelText: 'Machine Name', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: idCtrl, decoration: const InputDecoration(
                  labelText: 'Equipment ID', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: operatorCtrl, decoration: const InputDecoration(
                  labelText: 'Operator', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: dateCtrl, decoration: const InputDecoration(
                  labelText: 'Inspection Date (YYYY-MM-DD)', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: status,
                decoration: const InputDecoration(labelText: 'Status', border: OutlineInputBorder()),
                items: ['FIT', 'UNFIT', 'UNDER_REPAIR']
                    .map((s) => DropdownMenuItem(value: s, child: Text(s.replaceAll('_', ' ')))).toList(),
                onChanged: (v) => setModalState(() => status = v ?? 'FIT'),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () {
                      if (typeCtrl.text.trim().isEmpty) return;
                      context.read<EhsDashboardBloc>().add(CreateEhsMachinery(projectId, {
                        'machineryType': typeCtrl.text.trim(),
                        if (nameCtrl.text.trim().isNotEmpty) 'machineName': nameCtrl.text.trim(),
                        if (idCtrl.text.trim().isNotEmpty) 'equipmentId': idCtrl.text.trim(),
                        if (operatorCtrl.text.trim().isNotEmpty) 'operator': operatorCtrl.text.trim(),
                        'inspectionDate': dateCtrl.text.trim(),
                        'status': status,
                      }));
                      Navigator.pop(ctx);
                    },
                    child: const Text('Add'),
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

// ============================================================
// Tab: Vehicles
// ============================================================

class _VehiclesTab extends StatelessWidget {
  final EhsDashboardLoaded data;
  final int projectId;
  const _VehiclesTab({required this.data, required this.projectId});

  @override
  Widget build(BuildContext context) {
    final ps = PermissionService.of(context);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.vehicles)),
        child: data.vehicles.isEmpty
            ? _EmptyCard(label: 'No vehicle records',
                onRefresh: () => context.read<EhsDashboardBloc>().add(RefreshEhsTab(projectId, EhsTab.vehicles)))
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: data.vehicles.length,
                itemBuilder: (context, i) {
                  final r = data.vehicles[i];
                  return _InfoCard(
                    title: r.vehicleNumber ?? r.vehicleType,
                    subtitle: r.vehicleType + (r.driverName != null ? ' · ${r.driverName}' : ''),
                    icon: Icons.local_shipping_outlined,
                    iconColor: Colors.blueGrey.shade700,
                    statusLabel: r.status,
                    statusColor: r.statusColor,
                    trailing: r.insuranceExpiryDate != null ? 'Insurance: ${r.insuranceExpiryDate}' : null,
                    alert: r.hasExpiringDocs ? 'Document expiring soon' : null,
                  );
                },
              ),
      ),
      floatingActionButton: ps.canReadEhsDashboard
          ? FloatingActionButton.small(
              onPressed: () => _showVehicleForm(context),
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  void _showVehicleForm(BuildContext context) {
    final typeCtrl = TextEditingController();
    final numberCtrl = TextEditingController();
    final driverCtrl = TextEditingController();
    final licCtrl = TextEditingController();
    final pucCtrl = TextEditingController();
    final insCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16, right: 16, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Add Vehicle', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(controller: typeCtrl, decoration: const InputDecoration(
                labelText: 'Vehicle Type *', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: numberCtrl, decoration: const InputDecoration(
                labelText: 'Vehicle Number', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: driverCtrl, decoration: const InputDecoration(
                labelText: 'Driver Name', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: licCtrl, decoration: const InputDecoration(
                labelText: 'Driver License No.', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: pucCtrl, decoration: const InputDecoration(
                labelText: 'PUC Expiry (YYYY-MM-DD)', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: insCtrl, decoration: const InputDecoration(
                labelText: 'Insurance Expiry (YYYY-MM-DD)', border: OutlineInputBorder())),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () {
                    if (typeCtrl.text.trim().isEmpty) return;
                    context.read<EhsDashboardBloc>().add(CreateEhsVehicle(projectId, {
                      'vehicleType': typeCtrl.text.trim(),
                      if (numberCtrl.text.trim().isNotEmpty) 'vehicleNumber': numberCtrl.text.trim(),
                      if (driverCtrl.text.trim().isNotEmpty) 'driverName': driverCtrl.text.trim(),
                      if (licCtrl.text.trim().isNotEmpty) 'driverLicense': licCtrl.text.trim(),
                      if (pucCtrl.text.trim().isNotEmpty) 'pucExpiryDate': pucCtrl.text.trim(),
                      if (insCtrl.text.trim().isNotEmpty) 'insuranceExpiryDate': insCtrl.text.trim(),
                    }));
                    Navigator.pop(ctx);
                  },
                  child: const Text('Add'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// Shared widgets
// ============================================================

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700));
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(label,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
            Text(value,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
          ],
        ),
      ),
    );
  }
}

class _ComplianceBar extends StatelessWidget {
  final String label;
  final double percent;
  const _ComplianceBar({required this.label, required this.percent});

  @override
  Widget build(BuildContext context) {
    final clampedPercent = percent.clamp(0.0, 100.0);
    final color = clampedPercent >= 80
        ? Colors.green.shade600
        : clampedPercent >= 50
            ? Colors.orange.shade600
            : Colors.red.shade600;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 12)),
            Text('${clampedPercent.toStringAsFixed(0)}%',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: clampedPercent / 100,
            minHeight: 8,
            backgroundColor: Colors.grey.shade200,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }
}

class _TrendRow extends StatelessWidget {
  final String month;
  final int count;
  const _TrendRow({required this.month, required this.count});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 70, child: Text(month, style: const TextStyle(fontSize: 12))),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: count == 0 ? 0 : (count / 10.0).clamp(0, 1),
                minHeight: 16,
                backgroundColor: Colors.grey.shade200,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.red.shade400),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text('$count', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData icon;
  final Color iconColor;
  final String? statusLabel;
  final Color? statusColor;
  final String? trailing;
  final String? alert;

  const _InfoCard({
    required this.title,
    this.subtitle,
    required this.icon,
    required this.iconColor,
    this.statusLabel,
    this.statusColor,
    this.trailing,
    this.alert,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: alert != null ? Colors.orange.shade300 : Colors.grey.shade200,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Icon(icon, size: 18, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(title,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      ),
                      if (statusLabel != null && statusColor != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: statusColor!.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(statusLabel!,
                              style: TextStyle(
                                  fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
                        ),
                    ],
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                  ],
                  if (trailing != null) ...[
                    const SizedBox(height: 2),
                    Text(trailing!, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                  ],
                  if (alert != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.warning_amber_outlined, size: 12, color: Colors.orange.shade700),
                        const SizedBox(width: 4),
                        Text(alert!,
                            style: TextStyle(fontSize: 11, color: Colors.orange.shade700, fontWeight: FontWeight.w600)),
                      ],
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

class _EmptyCard extends StatelessWidget {
  final String label;
  final VoidCallback onRefresh;
  const _EmptyCard({required this.label, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inbox_outlined, size: 48, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          Text(label, style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh'),
          ),
        ],
      ),
    );
  }
}
