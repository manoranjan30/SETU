import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/widgets/offline_banner.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/features/tower_lens/data/repositories/tower_progress_repository.dart';
import 'package:setu_mobile/features/tower_lens/presentation/bloc/tower_lens_bloc.dart';
import 'package:setu_mobile/features/tower_lens/presentation/widgets/isometric_building_painter.dart';
import 'package:setu_mobile/features/tower_lens/presentation/widgets/floor_detail_sheet.dart';
import 'package:setu_mobile/features/tower_lens/presentation/widgets/view_mode_switcher.dart';
import 'package:setu_mobile/features/tower_lens/presentation/widgets/floor_legend_bar.dart';
import 'package:setu_mobile/features/tower_lens/presentation/widgets/project_site_map.dart';

class TowerLensPage extends StatefulWidget {
  final int projectId;
  final String projectName;

  const TowerLensPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  State<TowerLensPage> createState() => _TowerLensPageState();
}

class _TowerLensPageState extends State<TowerLensPage>
    with TickerProviderStateMixin {
  // --- Animation Controllers ---
  late AnimationController _buildCtrl;
  late AnimationController _liftCtrl;
  late AnimationController _modeCtrl;
  late AnimationController _pulseCtrl;

  // --- Cached animations derived from controllers ---
  late Animation<double> _liftAnim;
  late Animation<double> _pulseAnim;

  // --- Interaction state ---
  // FloorHitArea objects are populated by IsometricBuildingPainter during paint()
  final List<FloorHitArea> _hitAreas = [];
  double _rotationAngle = 0.0;
  double _scale = 1.0;
  bool _showSiteMap = false;

  // --- Track whether first load animation has fired ---
  bool _buildAnimStarted = false;

  @override
  void initState() {
    super.initState();

    // Build-up stacking animation — duration refined after first load
    _buildCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    // Floor lift — easeOutBack, tween 0 → 4 (pixels)
    _liftCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
    );
    _liftAnim = Tween<double>(begin: 0, end: 4).animate(
      CurvedAnimation(parent: _liftCtrl, curve: Curves.easeOutBack),
    );

    // View mode cross-fade
    _modeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );

    // Active floor pulse — repeating, reverse
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _pulseAnim = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _buildCtrl.forward();
    _liftCtrl.forward();
    _modeCtrl.forward();
    _pulseCtrl.repeat(reverse: true);
  }

  @override
  void dispose() {
    _buildCtrl.dispose();
    _liftCtrl.dispose();
    _modeCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _showFloorDetail(
      BuildContext context, TowerLensLoaded state, int floorIndex) {
    final floor = state.activeTower.floors[floorIndex];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FloorDetailSheet(
        floor: floor,
        towerName: state.activeTower.towerName,
        onDismiss: () {
          Navigator.pop(context);
          context.read<TowerLensBloc>().add(const SelectTowerFloor(null));
        },
      ),
    );
  }

  void _handleTapUp(TapUpDetails details, TowerLensLoaded state) {
    final tapPos = details.localPosition;
    for (final hit in _hitAreas) {
      if (hit.contains(tapPos)) {
        context.read<TowerLensBloc>().add(SelectTowerFloor(hit.floorIndex));
        _liftCtrl
          ..reset()
          ..forward();
        return;
      }
    }
  }

  void _handleHorizontalDragUpdate(DragUpdateDetails details) {
    setState(() {
      _rotationAngle =
          (_rotationAngle + details.delta.dx * 0.005).clamp(-_pi12, _pi12);
    });
  }

  void _handleHorizontalDragEnd(DragEndDetails _) {
    // Animate back to 0 over a few frames via a simple post-frame loop
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          _rotationAngle = _rotationAngle * 0.6;
        });
        if (_rotationAngle.abs() > 0.002) {
          _handleHorizontalDragEnd(DragEndDetails());
        } else {
          setState(() => _rotationAngle = 0.0);
        }
      }
    });
  }

  static const double _pi12 = 3.14159265358979 / 12;

  void _handleScaleUpdate(ScaleUpdateDetails details) {
    setState(() {
      _scale = (_scale * details.scale).clamp(0.5, 2.5);
    });
  }

  void _handleDoubleTap() {
    setState(() {
      _rotationAngle = 0.0;
      _scale = 1.0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<TowerLensBloc>(
      create: (_) => TowerLensBloc(
        repository: TowerProgressRepository(sl<SetuApiClient>()),
      )..add(LoadTowerLens(widget.projectId)),
      child: BlocConsumer<TowerLensBloc, TowerLensState>(
        listener: (context, state) {
          if (state is TowerLensLoaded && !_buildAnimStarted) {
            _buildAnimStarted = true;
            final floorCount = state.activeTower.floors.length;
            _buildCtrl.duration =
                Duration(milliseconds: 800 + floorCount * 60);
            _buildCtrl
              ..reset()
              ..forward(from: 0);
          }

          if (state is FloorCompletedState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Floor complete! ${state.floorName}'),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }

          if (state is TowerLensError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Colors.red.shade700,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }

          if (state is TowerLensLoaded && state.selectedFloorIndex != null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                _showFloorDetail(context, state, state.selectedFloorIndex!);
              }
            });
          }
        },
        builder: (context, state) {
          if (state is TowerLensLoading) {
            return Scaffold(
              backgroundColor: const Color(0xFF0F172A),
              appBar: AppBar(
                backgroundColor: const Color(0xFF1E293B),
                title: Text(widget.projectName),
              ),
              body: const Center(
                child: CircularProgressIndicator(
                  color: Color(0xFF3B82F6),
                ),
              ),
            );
          }

          if (state is TowerLensError) {
            return Scaffold(
              backgroundColor: const Color(0xFF0F172A),
              appBar: AppBar(
                backgroundColor: const Color(0xFF1E293B),
                title: Text(widget.projectName),
              ),
              body: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        color: Colors.red, size: 48),
                    const SizedBox(height: 16),
                    Text(
                      state.message,
                      style: const TextStyle(color: Colors.white70),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () => context
                          .read<TowerLensBloc>()
                          .add(LoadTowerLens(widget.projectId)),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF3B82F6),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is TowerLensLoaded) {
            final towerName = state.activeTower.towerName;

            return Scaffold(
              backgroundColor: const Color(0xFF0F172A),
              appBar: AppBar(
                backgroundColor: const Color(0xFF1E293B),
                elevation: 0,
                title: Text(
                  state.towers.length > 1 ? 'All Towers' : towerName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                actions: [
                  if (state.isFromCache)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                      child: OfflineChip(),
                    ),
                  ViewModeSwitcher(
                    activeMode: state.activeMode,
                    onChanged: (mode) {
                      context
                          .read<TowerLensBloc>()
                          .add(ChangeTowerViewMode(mode));
                      _modeCtrl
                        ..reset()
                        ..forward();
                    },
                  ),
                  IconButton(
                    icon: Icon(
                      _showSiteMap ? Icons.view_in_ar : Icons.map_outlined,
                      color: Colors.white70,
                    ),
                    tooltip: _showSiteMap ? 'Show 3D View' : 'Show Site Map',
                    onPressed: () =>
                        setState(() => _showSiteMap = !_showSiteMap),
                  ),
                ],
              ),
              body: Column(
                children: [
                  // Tower selector chips (shown when multiple towers)
                  if (state.towers.length > 1)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: state.towers
                              .asMap()
                              .entries
                              .map((entry) {
                            final isActive =
                                entry.key == state.activeTowerIndex;
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: GestureDetector(
                                onTap: () => context
                                    .read<TowerLensBloc>()
                                    .add(SelectTower(entry.key)),
                                child: AnimatedContainer(
                                  duration:
                                      const Duration(milliseconds: 200),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 7),
                                  decoration: BoxDecoration(
                                    color: isActive
                                        ? const Color(0xFF3B82F6)
                                        : const Color(0xFF1E293B),
                                    borderRadius:
                                        BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isActive
                                          ? const Color(0xFF3B82F6)
                                          : const Color(0xFF334155),
                                    ),
                                  ),
                                  child: Text(
                                    entry.value.towerName,
                                    style: TextStyle(
                                      color: isActive
                                          ? Colors.white
                                          : Colors.white60,
                                      fontSize: 13,
                                      fontWeight: isActive
                                          ? FontWeight.w700
                                          : FontWeight.w400,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),

                  // Main 3D view / site map
                  Expanded(
                    child: Stack(
                      children: [
                        if (_showSiteMap)
                          ProjectSiteMap(
                            towers: state.towers,
                            activeTowerIndex: state.activeTowerIndex,
                            onTowerSelected: (i) => context
                                .read<TowerLensBloc>()
                                .add(SelectTower(i)),
                          )
                        else
                          GestureDetector(
                            onTapUp: (details) =>
                                _handleTapUp(details, state),
                            onHorizontalDragUpdate:
                                _handleHorizontalDragUpdate,
                            onHorizontalDragEnd: _handleHorizontalDragEnd,
                            onScaleUpdate: _handleScaleUpdate,
                            onDoubleTap: _handleDoubleTap,
                            child: AnimatedBuilder(
                              animation: Listenable.merge([
                                _buildCtrl,
                                _liftAnim,
                                _modeCtrl,
                                _pulseAnim,
                              ]),
                              builder: (context, _) {
                                return CustomPaint(
                                  painter: IsometricBuildingPainter(
                                    model: state.activeTower,
                                    hitAreas: _hitAreas,
                                    buildProgress: _buildCtrl.value,
                                    rotationAngle: _rotationAngle,
                                    scale: _scale,
                                    selectedLift: _liftAnim.value,
                                    pulseOpacity: _pulseAnim.value,
                                  ),
                                  size: Size.infinite,
                                );
                              },
                            ),
                          ),

                        // Floor legend pinned above bottom nav
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: FloorLegendBar(
                            model: state.activeTower,
                            selectedFloorIndex: state.selectedFloorIndex,
                            onFloorTapped: (i) => context
                                .read<TowerLensBloc>()
                                .add(SelectTowerFloor(i)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }

          // Fallback for any other state
          return Scaffold(
            backgroundColor: const Color(0xFF0F172A),
            appBar: AppBar(
              backgroundColor: const Color(0xFF1E293B),
              title: Text(widget.projectName),
            ),
            body: const SizedBox.shrink(),
          );
        },
      ),
    );
  }
}
