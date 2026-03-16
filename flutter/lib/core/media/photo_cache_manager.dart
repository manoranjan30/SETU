import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// Custom cache manager for SETU server photos.
///
/// Policy (size cap takes priority):
///   - Max entries : 300 objects (evicts oldest when full)
///   - Max age     : 7 days (photos not viewed within a week are evicted;
///                   they reload on next view from the server)
///
/// The 150 MB hard cap is enforced by [MediaCleanupService] on each
/// app launch, which deletes oldest cached files until under the limit.
///
/// Usage with CachedNetworkImage:
/// ```dart
/// CachedNetworkImage(
///   imageUrl: url,
///   cacheManager: SetuPhotoCacheManager(),
/// )
/// ```
class SetuPhotoCacheManager extends CacheManager with ImageCacheManager {
  static const _cacheKey = 'setu_photos';

  static final SetuPhotoCacheManager _instance = SetuPhotoCacheManager._();
  factory SetuPhotoCacheManager() => _instance;

  SetuPhotoCacheManager._()
      : super(Config(
          _cacheKey,
          stalePeriod: const Duration(days: 7),
          maxNrOfCacheObjects: 300,
        ));
}
