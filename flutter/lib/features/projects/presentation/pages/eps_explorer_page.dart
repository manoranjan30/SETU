import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:setu_mobile/core/theme/app_colors.dart';
import 'package:setu_mobile/core/theme/app_dimensions.dart';
import 'package:setu_mobile/features/projects/data/models/project_model.dart';
import 'package:setu_mobile/features/projects/presentation/bloc/project_bloc.dart';
import 'package:setu_mobile/features/projects/presentation/widgets/breadcrumb_widget.dart';
import 'package:setu_mobile/features/progress/presentation/pages/progress_entry_page.dart';
import 'package:setu_mobile/features/progress/presentation/bloc/progress_bloc.dart';
import 'package:setu_mobile/features/sync/presentation/pages/sync_log_page.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:shimmer/shimmer.dart';

/// EPS Explorer Page - Hierarchical navigation through project structure.
///
/// Implements the "Site Level" navigation flow:
/// Project → Zone/Block → Tower → Floor → Activities
///
/// The breadcrumb at the top always reflects the current navigation depth.
/// Back button pops one level up; long-pressing it returns to the projects list.
class EpsExplorerPage extends StatefulWidget {
  final Project project;

  const EpsExplorerPage({
    super.key,
    required this.project,
  });

  @override
  State<EpsExplorerPage> createState() => _EpsExplorerPageState();
}

class _EpsExplorerPageState extends State<EpsExplorerPage> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  // Activity view preferences — loaded from SharedPreferences on init
  int? _wbsDepth;       // null = all levels, N = show last N path segments
  bool _treeView = false;

  static const _prefKeyDepth = 'progress_wbs_depth';
  static const _prefKeyTree  = 'progress_tree_view';

  @override
  void initState() {
    super.initState();
    _loadPrefs();
    context.read<ProjectBloc>().add(LoadProjectHierarchy(widget.project.id));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  // ── Preferences ──────────────────────────────────────────────────────────────

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final d = prefs.containsKey(_prefKeyDepth) ? prefs.getInt(_prefKeyDepth) : null;
    final t = prefs.getBool(_prefKeyTree) ?? false;
    if (mounted) setState(() { _wbsDepth = d; _treeView = t; });
  }

  Future<void> _saveWbsDepth(int? v) async {
    final prefs = await SharedPreferences.getInstance();
    if (v == null) {
      await prefs.remove(_prefKeyDepth);
    } else {
      await prefs.setInt(_prefKeyDepth, v);
    }
  }

  Future<void> _saveTreeView(bool v) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKeyTree, v);
  }

  void _showDepthPicker() {
    final options = <(int?, String)>[
      (null, 'All levels (default)'),
      (4, 'Last 4 levels'),
      (3, 'Last 3 levels'),
      (2, 'Last 2 levels'),
      (1, 'Name only'),
    ];
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(children: [
                Text('Activity title depth',
                    style: Theme.of(context).textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const Spacer(),
                Text('controls how many WBS levels show as title',
                    style: Theme.of(context).textTheme.bodySmall
                        ?.copyWith(color: AppColors.textSecondary, fontSize: 10)),
              ]),
            ),
            ...options.map((opt) {
              final (value, label) = opt;
              final isSelected = _wbsDepth == value;
              return ListTile(
                dense: true,
                leading: Icon(
                  isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  color: isSelected ? AppColors.primary : AppColors.textSecondary,
                  size: 20,
                ),
                title: Text(label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                      color: isSelected ? AppColors.primary : null,
                    )),
                onTap: () {
                  Navigator.pop(ctx);
                  setState(() => _wbsDepth = value);
                  _saveWbsDepth(value);
                },
              );
            }),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Intercept the hardware back button to navigate up within the EPS tree
      // instead of immediately leaving the page
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _handleBackPress();
        if (shouldPop && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: _handleBackTap,
            // Long-press shortcuts the user all the way back to the projects list
            onLongPress: () {
              Navigator.of(context).popUntil((route) => route.isFirst);
            },
            tooltip: 'Back (long press to projects)',
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Project Structure'),
              // Show the project name as a subtitle for context
              Text(
                widget.project.name,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF6B7280),
                    ),
              ),
            ],
          ),
          actions: [
            // Live sync status dot — tapping opens the sync log
            LiveSyncStatusIndicator(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SyncLogPage()),
                );
              },
            ),
            const SizedBox(width: 8),
            // Manual refresh for the currently-viewed node
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () {
                context.read<ProjectBloc>().add(RefreshCurrentNode());
              },
              tooltip: 'Refresh',
            ),
          ],
        ),
        body: BlocConsumer<ProjectBloc, ProjectState>(
          listener: (context, state) {
            // Clear search whenever the user navigates to a different node
            if (state is EpsExplorerState && _searchQuery.isNotEmpty) {
              _searchCtrl.clear();
              setState(() => _searchQuery = '');
            }
            if (state is ProjectError) {
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
            // Full-screen shimmer while the initial load is in-flight
            if (state is ProjectLoading) {
              return _buildLoadingShimmer();
            }

            // Main content once the EPS tree has been loaded
            if (state is EpsExplorerState) {
              return _buildExplorerContent(state);
            }

            // Error state — show the full-page error widget
            if (state is ProjectError) {
              return _buildErrorState(state.message);
            }

            // Fallback to shimmer for any unhandled state
            return _buildLoadingShimmer();
          },
        ),
      ),
    );
  }

  /// Builds the main explorer body: breadcrumb strip + optional banners +
  /// the scrollable list of child nodes and activities.
  Widget _buildExplorerContent(EpsExplorerState state) {
    return Column(
      children: [
        // Sticky breadcrumb — tapping any crumb navigates to that level
        BreadcrumbWidget(
          path: state.currentPath,
          onNavigateToIndex: (index) {
            context.read<ProjectBloc>().add(NavigateToPathIndex(index));
          },
        ),

        // Offline indicator — shown when serving from local cache
        if (state.isOffline)
          _buildOfflineBanner(),

        // Thin progress bar at the top while child nodes are loading in the
        // background (e.g. after tapping a folder)
        if (state.isLoadingChildren)
          const LinearProgressIndicator(minHeight: 2),

        // Scrollable list of folders + activities for the current node
        Expanded(
          child: _isEffectivelyEmpty(state)
              ? _buildEmptyState()
              : _buildItemsList(state),
        ),
      ],
    );
  }

  /// Amber warning banner shown when the EPS tree is loaded from local cache
  /// because the device is offline.
  Widget _buildOfflineBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppColors.warning.withValues(alpha: 0.15),
      child: const Row(
        children: [
          Icon(Icons.cloud_off, size: 18, color: AppColors.warning),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Offline - showing cached data',
              style: TextStyle(
                color: AppColors.warning,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Returns true when the current node has no child folders AND no activities
  /// directly attached to it (activities on deeper children are excluded).
  bool _isEffectivelyEmpty(EpsExplorerState state) {
    if (state.childNodes.isNotEmpty) return false;
    return state.activities.every((a) => a.epsNodeId != state.currentNode.id);
  }

  /// Renders the combined list of EPS folder items and leaf activities for
  /// the currently-viewed node.
  Widget _buildItemsList(EpsExplorerState state) {
    // Only show activities directly assigned to the current node.
    // Sort by `sequence` (WBS sequenceNo from backend) so activities appear in
    // the same order as the project schedule.
    final allDirect = state.activities
        .where((a) => a.epsNodeId == state.currentNode.id)
        .toList()
      ..sort((a, b) {
        final diff = (a.sequence ?? 0).compareTo(b.sequence ?? 0);
        if (diff != 0) return diff;
        // Secondary sort: activity code alphabetical (WBS order)
        final ac = a.code ?? '';
        final bc = b.code ?? '';
        if (ac.isNotEmpty && bc.isNotEmpty) return ac.compareTo(bc);
        return a.name.compareTo(b.name);
      });

    // Filter by search query when the user has typed something
    final q = _searchQuery.toLowerCase();
    final directActivities = q.isEmpty
        ? allDirect
        : allDirect
            .where((a) =>
                a.name.toLowerCase().contains(q) ||
                (a.code?.toLowerCase().contains(q) ?? false) ||
                (a.wbsPath?.toLowerCase().contains(q) ?? false))
            .toList();

    // Show search bar only when there are activities on this node
    final hasActivities = allDirect.isNotEmpty;

    return Column(children: [
      // ── Activity search bar — only when this floor has activities ────────
      if (hasActivities)
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _searchQuery = v),
            decoration: InputDecoration(
              hintText: 'Search activities…',
              prefixIcon: const Icon(Icons.search, size: 18),
              isDense: true,
              border: const OutlineInputBorder(),
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 16),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
            ),
          ),
        ),
      Expanded(
        child: ListView(
          padding: const EdgeInsets.all(AppDimensions.paddingMD),
          children: [
            // ── Folder items section ───────────────────────────────────────
            if (state.childNodes.isNotEmpty) ...[
              _buildSectionHeader(
                _getSectionLabel(state.childNodes),
                state.childNodes.length,
                _getSectionIcon(state.childNodes),
              ),
              const SizedBox(height: 8),
              ...state.childNodes.map((node) => _buildFolderItem(node, state)),
            ],

            // ── Leaf activity items — only those directly on this node ─────
            if (directActivities.isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildSectionHeader(
                q.isNotEmpty
                    ? 'Activities (${directActivities.length} of ${allDirect.length})'
                    : 'Activities',
                directActivities.length,
                Icons.assignment_outlined,
              ),
              const SizedBox(height: 4),
              // View mode + title depth controls
              _buildActivityViewControls(),
              const SizedBox(height: 8),
              // Render flat list or WBS tree depending on toggle
              if (_treeView)
                _buildActivityTree(
                    directActivities, (a) => _buildActivityItem(a, state))
              else
                ...directActivities.map((a) => _buildActivityItem(a, state)),
            ] else if (q.isNotEmpty) ...[
              const SizedBox(height: 32),
              Center(
                child: Text('No activities match "$_searchQuery"',
                    style: const TextStyle(color: AppColors.textSecondary)),
              ),
            ],
          ],
        ),
      ),
    ]);
  }

  // ── Activity view controls ────────────────────────────────────────────────────

  /// Compact row below the Activities section header:
  /// [List] [Tree] toggle on the left, depth chip on the right.
  Widget _buildActivityViewControls() {
    final depthLabel = switch (_wbsDepth) {
      null => 'All levels',
      1    => 'Name only',
      _    => '$_wbsDepth levels',
    };

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          // List mode toggle
          _viewToggle(Icons.view_list_outlined, !_treeView, () {
            setState(() => _treeView = false);
            _saveTreeView(false);
          }, tooltip: 'List view'),
          const SizedBox(width: 4),
          // Tree mode toggle
          _viewToggle(Icons.account_tree_outlined, _treeView, () {
            setState(() => _treeView = true);
            _saveTreeView(true);
          }, tooltip: 'Tree view'),
          const Spacer(),
          // WBS depth chip — tapping opens the picker bottom sheet
          GestureDetector(
            onTap: _showDepthPicker,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.25)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.tune_rounded,
                    size: 11, color: AppColors.primary),
                const SizedBox(width: 4),
                Text(
                  depthLabel,
                  style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600),
                ),
                const SizedBox(width: 2),
                const Icon(Icons.keyboard_arrow_down_rounded,
                    size: 12, color: AppColors.primary),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _viewToggle(IconData icon, bool active, VoidCallback onTap,
      {required String tooltip}) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: active
                ? AppColors.primary.withValues(alpha: 0.12)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
                color: active
                    ? AppColors.primary.withValues(alpha: 0.4)
                    : AppColors.divider),
          ),
          child: Icon(icon,
              size: 16,
              color: active ? AppColors.primary : AppColors.textSecondary),
        ),
      ),
    );
  }

  // ── WBS tree builder ──────────────────────────────────────────────────────────

  /// Converts a flat [activities] list into a [_WbsNode] tree using each
  /// activity's [Activity.wbsPath] (ancestors separated by " > ").
  _WbsNode _buildWbsTree(List<Activity> activities) {
    final root = _WbsNode('');
    for (final activity in activities) {
      final segments = (activity.wbsPath?.isNotEmpty == true)
          ? activity.wbsPath!.split(' > ')
          : <String>[];
      _WbsNode current = root;
      for (final seg in segments) {
        _WbsNode? next;
        for (final child in current.children) {
          if (child.label == seg) { next = child; break; }
        }
        if (next == null) {
          next = _WbsNode(seg);
          current.children.add(next);
        }
        current = next;
      }
      current.activities.add(activity);
    }
    return root;
  }

  /// Renders [activities] as a collapsible WBS tree.
  /// [buildCard] is called for each leaf activity to produce its card widget.
  Widget _buildActivityTree(
      List<Activity> activities, Widget Function(Activity) buildCard) {
    final root = _buildWbsTree(activities);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Activities with no wbsPath sit directly at the root (ungrouped)
        ...root.activities.map(buildCard),
        // One collapsible section per top-level WBS group
        ...root.children.map((node) => _WbsGroupTile(
              node: node,
              depth: 0,
              buildCard: buildCard,
            )),
      ],
    );
  }

  // ── Section header ────────────────────────────────────────────────────────────

  /// Small header row with an icon, section name, and an item count badge.
  Widget _buildSectionHeader(String title, int count, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(width: 8),
          // Count badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Folder item (slim) ────────────────────────────────────────────────────────

  /// Card for an EPS folder node (Zone / Block / Tower / Floor etc.).
  /// Tapping dispatches [NavigateToNode] to drill into that level.
  Widget _buildFolderItem(EpsNode node, EpsExplorerState state) {
    // Child folder count (sub-nodes)
    final childCount = node.children.length;
    // Activities directly assigned to this folder node
    final activityCount = state.getActivitiesForNode(node.id).length;

    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        side: const BorderSide(color: AppColors.divider, width: 1),
      ),
      child: InkWell(
        onTap: () {
          context.read<ProjectBloc>().add(NavigateToNode(node));
        },
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
          child: Row(
            children: [
              // Node type icon with a tinted background (slimmed to 36×36)
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: _getNodeColor(node.type).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _getNodeIcon(node.type),
                  color: _getNodeColor(node.type),
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      node.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    // Subtitle shows child count + activity count in human form
                    Text(
                      _buildFolderSubtitle(childCount, activityCount, node.type),
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              // Navigation affordance
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textSecondary,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Builds the descriptive subtitle for a folder card, e.g. "3 floors · 5 activities".
  String _buildFolderSubtitle(int childCount, int activityCount, String nodeType) {
    final parts = <String>[];
    if (childCount > 0) {
      final childLabel = _childTypeLabelOf(nodeType);
      parts.add('$childCount $childLabel${childCount > 1 ? 's' : ''}');
    }
    if (activityCount > 0) {
      parts.add('$activityCount activit${activityCount > 1 ? 'ies' : 'y'}');
    }
    if (parts.isEmpty) {
      return 'Tap to explore';
    }
    return parts.join(' · ');
  }

  /// Returns the singular label for the expected child type of [parentType].
  String _childTypeLabelOf(String parentType) {
    switch (parentType.toUpperCase()) {
      case 'PROJECT': return 'block';
      case 'BLOCK':   return 'tower';
      case 'TOWER':   return 'floor';
      case 'FLOOR':   return 'unit';
      case 'UNIT':    return 'room';
      default:        return 'zone';
    }
  }

  /// Returns a human-readable plural label for the section header based on
  /// the type of the first child node.
  String _getSectionLabel(List<EpsNode> nodes) {
    if (nodes.isEmpty) return 'Zones';
    switch (nodes.first.type.toUpperCase()) {
      case 'BLOCK':    return 'Blocks';
      case 'TOWER':    return 'Towers';
      case 'FLOOR':    return 'Floors';
      case 'UNIT':     return 'Units';
      case 'ROOM':     return 'Rooms';
      case 'PHASE':    return 'Phases';
      case 'BUILDING': return 'Buildings';
      default:         return 'Zones';
    }
  }

  /// Returns the section header icon for the given list of nodes.
  IconData _getSectionIcon(List<EpsNode> nodes) {
    if (nodes.isEmpty) return Icons.folder_outlined;
    return _getNodeIcon(nodes.first.type);
  }

  /// Maps an EPS node type string to a Material icon.
  IconData _getNodeIcon(String type) {
    switch (type.toUpperCase()) {
      case 'BLOCK':    return Icons.domain_rounded;
      case 'TOWER':
      case 'BUILDING': return Icons.apartment_rounded;
      case 'FLOOR':    return Icons.layers_rounded;
      case 'UNIT':     return Icons.home_rounded;
      case 'ROOM':     return Icons.meeting_room_rounded;
      case 'PHASE':    return Icons.timeline_rounded;
      default:         return Icons.folder_rounded;
    }
  }

  /// Maps an EPS node type to a distinctive colour used for the icon bg.
  Color _getNodeColor(String type) {
    switch (type.toUpperCase()) {
      case 'BLOCK':    return const Color(0xFF1565C0); // deep blue
      case 'TOWER':
      case 'BUILDING': return const Color(0xFF6A1B9A); // purple
      case 'FLOOR':    return const Color(0xFFE65100); // orange
      case 'UNIT':     return const Color(0xFF2E7D32); // green
      case 'ROOM':     return const Color(0xFF00695C); // teal
      case 'PHASE':    return const Color(0xFF558B2F); // light green
      default:         return Colors.amber;
    }
  }

  // ── Activity card (slim) ──────────────────────────────────────────────────────

  /// Slim card for a leaf-level WBS [Activity].
  /// Shows progress bar, status badge, and actual vs planned quantities.
  /// Tapping navigates to [ProgressEntryPage].
  Widget _buildActivityItem(Activity activity, EpsExplorerState state) {
    final progress = activity.progress;
    final progressPercent = (progress * 100).toStringAsFixed(0);
    final isCompleted = progress >= 1.0;

    return Card(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        side: BorderSide(
          // Tinted green border for completed activities
          color: isCompleted
              ? AppColors.success.withValues(alpha: 0.3)
              : AppColors.divider,
          width: 1,
        ),
      ),
      child: InkWell(
        onTap: () {
          _navigateToProgressEntry(activity, state);
        },
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 7, 8, 7),
          child: Row(
            children: [
              // Activity icon — 36×36, different icon for micro-schedule activities
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isCompleted
                      ? AppColors.success.withValues(alpha: 0.12)
                      : AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  // task_alt icon signals the activity has a micro schedule
                  activity.hasMicroSchedule
                      ? Icons.task_alt_rounded
                      : Icons.assignment_rounded,
                  color: isCompleted
                      ? AppColors.success
                      : AppColors.primary,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _buildActivityHierarchy(activity),
                        ),
                        // Status chip (Completed / In Progress / Not Started)
                        _buildStatusChip(activity.status),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // Progress bar showing completion as a coloured fill
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(
                        value: progress,
                        backgroundColor: AppColors.divider,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          isCompleted ? AppColors.success : AppColors.primary,
                        ),
                        minHeight: 4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Percentage completion text
                        Text(
                          '$progressPercent% Complete',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        // Actual vs planned quantity when data is available
                        if (activity.unit != null && activity.plannedQuantity != null)
                          Text(
                            '${activity.actualQuantity?.toStringAsFixed(1) ?? '0'} / ${activity.plannedQuantity!.toStringAsFixed(1)} ${activity.unit}',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              // Navigation affordance
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textSecondary,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Builds the WBS ancestor breadcrumb + activity name, clipped to [_wbsDepth].
  ///
  /// Full path: wbsPath parts + activity name.
  /// When [_wbsDepth] is N, only the last N segments are shown.
  /// The last 3 visible segments are rendered bold; the rest are grey.
  Widget _buildActivityHierarchy(Activity activity) {
    // Assemble the full ordered path: wbsPath parts + leaf activity name.
    List<String> parts = [];
    if (activity.wbsPath != null && activity.wbsPath!.isNotEmpty) {
      parts.addAll(activity.wbsPath!.split(' > '));
    }
    parts.add(activity.name);

    // Clip to user-selected depth (null = show all)
    if (_wbsDepth != null && parts.length > _wbsDepth!) {
      parts = parts.sublist(parts.length - _wbsDepth!);
    }

    // Split point: last 3 entries are bold; anything before is grey.
    final int boldStart = parts.length > 3 ? parts.length - 3 : 0;
    final String greyText = parts.sublist(0, boldStart).join(' > ');
    final String boldText = parts.sublist(boldStart).join(' > ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (greyText.isNotEmpty)
          Text(
            greyText,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w400,
              height: 1.3,
            ),
          ),
        Text(
          boldText,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            height: 1.3,
          ),
        ),
      ],
    );
  }

  /// Pill chip coloured by activity status value.
  Widget _buildStatusChip(String? status) {
    if (status == null) return const SizedBox.shrink();

    Color chipColor;
    String label;

    switch (status.toLowerCase()) {
      case 'completed':
        chipColor = AppColors.success;
        label = 'Completed';
        break;
      case 'in_progress':
      case 'in progress':
        chipColor = AppColors.info;
        label = 'In Progress';
        break;
      case 'not_started':
      case 'not started':
        chipColor = AppColors.textSecondary;
        label = 'Not Started';
        break;
      default:
        chipColor = AppColors.textSecondary;
        label = status.replaceAll('_', ' ');
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: chipColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: chipColor,
          fontSize: 9,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  // ── Error / empty / shimmer states ────────────────────────────────────────────

  /// Full-page error state with a Retry button that reloads the hierarchy.
  Widget _buildErrorState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.cloud_off_outlined,
                size: 40,
                color: AppColors.error,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Failed to load project',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                // Re-fire the hierarchy load event
                context
                    .read<ProjectBloc>()
                    .add(LoadProjectHierarchy(widget.project.id));
              },
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  /// Empty state shown when the current node has no sub-zones or activities.
  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.textSecondary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.folder_open_outlined,
                size: 40,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No work packages defined',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'This location has no sub-zones or activities assigned.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// Shimmer-animated skeleton list shown during the initial load.
  Widget _buildLoadingShimmer() {
    return ListView.builder(
      padding: const EdgeInsets.all(AppDimensions.paddingMD),
      itemCount: 6,
      itemBuilder: (context, index) => _buildShimmerTile(),
    );
  }

  /// Single shimmer placeholder tile matching the folder/activity card shape.
  Widget _buildShimmerTile() {
    return Container(
      margin: const EdgeInsets.only(bottom: AppDimensions.marginSM),
      padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppDimensions.cardRadius),
        border: Border.all(color: AppColors.divider),
      ),
      child: Shimmer.fromColors(
        baseColor: Colors.grey[300]!,
        highlightColor: Colors.grey[100]!,
        child: Row(
          children: [
            // Icon placeholder (36×36 to match slim cards)
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title placeholder
                  Container(
                    height: 13,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Subtitle placeholder
                  Container(
                    height: 10,
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
      ),
    );
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  /// Pushes [ProgressEntryPage] for the selected [activity].
  /// Passes [currentEpsNodeId] so the progress form uses the correct EPS node
  /// (mirrors the web frontend's selectedEpsIds[0] selection).
  void _navigateToProgressEntry(Activity activity, EpsExplorerState state) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (context) => sl<ProgressBloc>(),
          child: ProgressEntryPage(
            activity: activity,
            project: state.project,
            // Pass the exact EPS node the user is viewing — mirrors the web
            // frontend's selectedEpsIds[0] so micro activities are found.
            currentEpsNodeId: state.currentNode.id,
            // Full breadcrumb so the user can identify the site location
            // e.g. "Block A › Tower 1 › 1st Floor".
            epsPath: state.currentPath.map((n) => n.name).join(' › '),
          ),
        ),
      ),
    );
  }

  /// Handles the system back gesture.
  /// Returns false (absorbs the event) if the user can navigate up within the
  /// EPS tree; returns true to allow the OS to pop the route once at the root.
  Future<bool> _handleBackPress() async {
    final projectState = context.read<ProjectBloc>().state;
    if (projectState is EpsExplorerState && projectState.currentPath.length > 1) {
      // Navigate up one level in the EPS tree
      context.read<ProjectBloc>().add(NavigateBack());
      return false; // do NOT pop the route
    }
    return true; // at root — allow the route to pop
  }

  /// Handles the AppBar back button tap by reusing [_handleBackPress] logic.
  void _handleBackTap() {
    _handleBackPress().then((shouldPop) {
      if (shouldPop && mounted) {
        Navigator.of(context).pop();
      }
    });
  }
}

// ── WBS tree data model ────────────────────────────────────────────────────────

/// A node in the local WBS grouping tree built from [Activity.wbsPath] strings.
/// Root node has an empty label; leaf nodes hold the activities assigned there.
class _WbsNode {
  final String label;
  final List<_WbsNode> children = [];
  final List<Activity> activities = [];

  _WbsNode(this.label);
}

// ── WBS group accordion tile ───────────────────────────────────────────────────

/// Collapsible accordion tile for a single WBS group in tree view.
///
/// Top-level groups (depth 0) start expanded; nested groups start collapsed.
/// Each level is indented by 12 px relative to its parent.
class _WbsGroupTile extends StatefulWidget {
  final _WbsNode node;
  final int depth;
  final Widget Function(Activity) buildCard;

  const _WbsGroupTile({
    required this.node,
    required this.depth,
    required this.buildCard,
  });

  @override
  State<_WbsGroupTile> createState() => _WbsGroupTileState();
}

class _WbsGroupTileState extends State<_WbsGroupTile> {
  // Top-level groups start open so the user immediately sees the structure;
  // nested groups start closed to keep the initial view manageable.
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.depth == 0;
  }

  /// Total activities in this node and all its descendants.
  int get _totalActivities => _countActivities(widget.node);

  int _countActivities(_WbsNode node) {
    int count = node.activities.length;
    for (final child in node.children) {
      count += _countActivities(child);
    }
    return count;
  }

  @override
  Widget build(BuildContext context) {
    // Indent each nesting level by 12 px
    final double leftInset = widget.depth * 12.0;

    return Padding(
      padding: EdgeInsets.only(left: leftInset, bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Group header ────────────────────────────────────────────────────
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
              decoration: BoxDecoration(
                // Slightly darker bg for top-level groups
                color: AppColors.primary
                    .withValues(alpha: widget.depth == 0 ? 0.07 : 0.04),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(children: [
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  size: 15,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 5),
                Icon(
                  Icons.folder_outlined,
                  size: 13,
                  color: AppColors.primary.withValues(alpha: 0.7),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    widget.node.label,
                    style: TextStyle(
                      fontWeight: widget.depth == 0
                          ? FontWeight.w700
                          : FontWeight.w600,
                      fontSize: 12,
                      color: AppColors.primary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                // Activity count badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '$_totalActivities',
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ]),
            ),
          ),

          // ── Expanded body ───────────────────────────────────────────────────
          if (_expanded) ...[
            const SizedBox(height: 4),
            // Activities directly at this WBS node
            ...widget.node.activities.map(widget.buildCard),
            // Nested WBS sub-groups (recursive)
            ...widget.node.children.map((child) => _WbsGroupTile(
                  node: child,
                  depth: widget.depth + 1,
                  buildCard: widget.buildCard,
                )),
          ],
        ],
      ),
    );
  }
}
