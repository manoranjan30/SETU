import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_site_obs_bloc.dart';
import 'package:setu_mobile/shared/widgets/obs_status_badge.dart';
import 'package:setu_mobile/shared/widgets/rectify_sheet.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';

/// Detail view for a single Quality Site Observation.
/// Provides Rectify / Close actions gated by permissions.
class QualitySiteObsDetailPage extends StatelessWidget {
  final QualitySiteObservation obs;
  final int projectId;

  const QualitySiteObsDetailPage({
    super.key,
    required this.obs,
    required this.projectId,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ps = PermissionService.of(context);

    return BlocListener<QualitySiteObsBloc, QualitySiteObsState>(
      listener: (context, state) {
        if (state is QualitySiteObsActionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_successMessage(state.action)),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        } else if (state is QualitySiteObsActionError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: theme.colorScheme.error,
            ),
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Observation Detail'),
          actions: [
            if (obs.isOpen && ps.canDeleteQualityObs)
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded),
                tooltip: 'Delete',
                onPressed: () => _confirmDelete(context),
              ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
          children: [
            // ── Status + Severity ───────────────────────────────────────────
            Row(
              children: [
                ObsStatusBadge(status: obs.status.label),
                const SizedBox(width: 8),
                SeverityBadge(severity: obs.severity),
                if (obs.category != null) ...[
                  const SizedBox(width: 8),
                  _Chip(obs.category!),
                ],
              ],
            ),
            const SizedBox(height: 16),

            // ── Description ─────────────────────────────────────────────────
            _Section(
              icon: Icons.description_outlined,
              title: 'Description',
              child: Text(obs.description, style: theme.textTheme.bodyMedium),
            ),
            const SizedBox(height: 12),

            // ── Location ────────────────────────────────────────────────────
            if (obs.locationLabel != null) ...[
              _Section(
                icon: Icons.location_on_outlined,
                title: 'Location',
                child: Text(obs.locationLabel!,
                    style: theme.textTheme.bodyMedium),
              ),
              const SizedBox(height: 12),
            ],

            // ── Raised by / Date ────────────────────────────────────────────
            _Section(
              icon: Icons.person_outline_rounded,
              title: 'Raised By',
              child: Row(
                children: [
                  Text(obs.raisedByName ?? 'Unknown',
                      style: theme.textTheme.bodyMedium),
                  const Spacer(),
                  Text(_fmtDate(obs.createdAt),
                      style: TextStyle(
                          fontSize: 12,
                          color: theme.colorScheme.onSurface
                              .withValues(alpha: 0.5))),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // ── Photos ──────────────────────────────────────────────────────
            if (obs.photoUrls.isNotEmpty) ...[
              _Section(
                icon: Icons.photo_library_outlined,
                title: 'Photos (${obs.photoUrls.length})',
                child: _PhotoStrip(urls: obs.photoUrls),
              ),
              const SizedBox(height: 12),
            ],

            // ── Rectification ───────────────────────────────────────────────
            if (obs.isRectified || obs.isClosed) ...[
              _Section(
                icon: Icons.build_circle_outlined,
                title: 'Rectification',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (obs.rectificationNotes != null)
                      Text(obs.rectificationNotes!,
                          style: theme.textTheme.bodyMedium),
                    if (obs.rectifiedAt != null) ...[
                      const SizedBox(height: 4),
                      Text('Rectified on ${_fmtDate(obs.rectifiedAt!)}',
                          style: TextStyle(
                              fontSize: 12,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5))),
                    ],
                    if (obs.rectificationPhotoUrls.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _PhotoStrip(urls: obs.rectificationPhotoUrls),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // ── Closure notes ───────────────────────────────────────────────
            if (obs.isClosed && obs.closureNotes != null) ...[
              _Section(
                icon: Icons.lock_outline_rounded,
                title: 'Closure Notes',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(obs.closureNotes!,
                        style: theme.textTheme.bodyMedium),
                    if (obs.closedAt != null) ...[
                      const SizedBox(height: 4),
                      Text('Closed on ${_fmtDate(obs.closedAt!)}',
                          style: TextStyle(
                              fontSize: 12,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.5))),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ),

        // ── Action Buttons ─────────────────────────────────────────────────
        bottomNavigationBar: _buildActions(context, ps),
      ),
    );
  }

  Widget? _buildActions(BuildContext context, PermissionService ps) {
    final canRectify = obs.isOpen &&
        obs.severity != 'INFO' &&
        ps.canRectifyQualityObs;
    // INFO severity can close directly from OPEN; others must be RECTIFIED first
    final canClose = ps.canCloseQualityObs &&
        (obs.isRectified || (obs.isOpen && obs.severity == 'INFO'));

    if (!canRectify && !canClose) return null;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Row(
          children: [
            if (canRectify)
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _rectify(context),
                  icon: const Icon(Icons.build_circle_outlined, size: 16),
                  label: const Text('Mark Rectified'),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB)),
                ),
              ),
            if (canRectify && canClose) const SizedBox(width: 10),
            if (canClose)
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _close(context),
                  icon: const Icon(Icons.lock_outline_rounded, size: 16),
                  label: const Text('Close'),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _rectify(BuildContext context) {
    RectifySheet.show(
      context,
      title: 'Rectify Observation',
      onSubmit: ({required notes, photoUrls = const []}) async {
        context.read<QualitySiteObsBloc>().add(
              RectifyQualitySiteObs(
                id: obs.id,
                notes: notes,
                photoUrls: photoUrls,
              ),
            );
      },
    );
  }

  void _close(BuildContext context) {
    final notesCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Close Observation'),
        content: TextField(
          controller: notesCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Closure notes (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.read<QualitySiteObsBloc>().add(
                    CloseQualitySiteObs(
                      id: obs.id,
                      closureNotes: notesCtrl.text.trim().isEmpty
                          ? null
                          : notesCtrl.text.trim(),
                    ),
                  );
            },
            child: const Text('Close Observation'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Observation'),
        content: const Text(
            'Are you sure you want to delete this observation? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context
                  .read<QualitySiteObsBloc>()
                  .add(DeleteQualitySiteObs(id: obs.id));
            },
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  String _fmtDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';

  String _successMessage(String action) {
    switch (action) {
      case 'rectified':
        return 'Marked as rectified';
      case 'closed':
        return 'Observation closed';
      case 'deleted':
        return 'Observation deleted';
      default:
        return 'Done';
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget child;

  const _Section({
    required this.icon,
    required this.title,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon,
                  size: 14,
                  color:
                      theme.colorScheme.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 4),
              Text(
                title,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.onSurface
                        .withValues(alpha: 0.5),
                    letterSpacing: 0.3),
              ),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  const _Chip(this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 11,
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.7))),
    );
  }
}

class _PhotoStrip extends StatelessWidget {
  final List<String> urls;
  const _PhotoStrip({required this.urls});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: urls.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) => GestureDetector(
          onTap: () => _openFullscreen(context, i),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.network(
              urls[i],
              width: 72,
              height: 72,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 72,
                height: 72,
                color: Colors.grey.shade200,
                child: const Icon(Icons.broken_image_outlined,
                    color: Colors.grey),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _openFullscreen(BuildContext context, int initial) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _FullscreenGallery(urls: urls, initial: initial),
      ),
    );
  }
}

class _FullscreenGallery extends StatefulWidget {
  final List<String> urls;
  final int initial;

  const _FullscreenGallery({required this.urls, required this.initial});

  @override
  State<_FullscreenGallery> createState() => _FullscreenGalleryState();
}

class _FullscreenGalleryState extends State<_FullscreenGallery> {
  late final PageController _pc;
  late int _current;

  @override
  void initState() {
    super.initState();
    _current = widget.initial;
    _pc = PageController(initialPage: widget.initial);
  }

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('${_current + 1} / ${widget.urls.length}'),
      ),
      body: PageView.builder(
        controller: _pc,
        itemCount: widget.urls.length,
        onPageChanged: (i) => setState(() => _current = i),
        itemBuilder: (_, i) => InteractiveViewer(
          child: Center(
            child: Image.network(
              widget.urls[i],
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) =>
                  const Icon(Icons.broken_image_outlined,
                      color: Colors.white54, size: 64),
            ),
          ),
        ),
      ),
    );
  }
}
