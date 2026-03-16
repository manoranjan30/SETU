/// The three visualization overlay modes for the 3D building view.
/// Switching mode cross-fades floor colors to reflect a different data lens.
enum TowerViewMode {
  /// Color floors by construction completion percentage.
  progress,

  /// Color floors by open quality observation count.
  quality,

  /// Color floors by open EHS (safety) events.
  ehs,
}

extension TowerViewModeX on TowerViewMode {
  String get label {
    switch (this) {
      case TowerViewMode.progress:
        return 'Progress';
      case TowerViewMode.quality:
        return 'Quality';
      case TowerViewMode.ehs:
        return 'EHS';
    }
  }
}
