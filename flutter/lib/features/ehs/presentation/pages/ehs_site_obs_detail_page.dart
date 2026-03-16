import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/auth/permission_service.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';
import 'package:setu_mobile/features/ehs/presentation/bloc/ehs_site_obs_bloc.dart';
import 'package:setu_mobile/shared/widgets/obs_status_badge.dart';
import 'package:setu_mobile/shared/widgets/photo_gallery_strip.dart';
import 'package:setu_mobile/shared/widgets/rectify_sheet.dart';
import 'package:setu_mobile/shared/widgets/severity_badge.dart';

/// Detail view for a single EHS Site Observation.
class EhsSiteObsDetailPage extends StatelessWidget {
  final EhsSiteObservation obs;
  final int projectId;

  const EhsSiteObsDetailPage({
    super.key,
    required this.obs,
    required this.projectId,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ps = PermissionService.of(context);
    final catEnum = obs.categoryEnum;

    return BlocListener<EhsSiteObsBloc, EhsSiteObsState>(
      listener: (context, state) {
        if (state is EhsSiteObsActionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_successMessage(state.action)),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        } else if (state is EhsSiteObsActionError) {
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
          title: const Text('EHS Observation'),
          actions: [
            if (obs.isOpen && ps.canDeleteEhsObs)
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
            // ── Status + Severity + Category ────────────────────────────────
            Row(
              children: [
                ObsStatusBadge(status: obs.status.label),
                const SizedBox(width: 8),
                SeverityBadge(severity: obs.severity),
                const SizedBox(width: 8),
                _CategoryBadge(catEnum: catEnum),
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
                child: PhotoGalleryStrip(urls: obs.photoUrls),
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
                      PhotoGalleryStrip(urls: obs.rectificationPhotoUrls),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // ── Closure ─────────────────────────────────────────────────────
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
        bottomNavigationBar: _buildActions(context, ps),
      ),
    );
  }

  Widget? _buildActions(BuildContext context, PermissionService ps) {
    final canRectify = obs.isOpen &&
        obs.severity != 'INFO' &&
        ps.canRectifyEhsObs;
    // INFO severity can close directly from OPEN; others must be RECTIFIED first
    final canClose = ps.canCloseEhsObs &&
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
      title: 'Rectify EHS Observation',
      onSubmit: ({required notes, photoUrls = const []}) async {
        context.read<EhsSiteObsBloc>().add(
              RectifyEhsSiteObs(id: obs.id, notes: notes, photoUrls: photoUrls),
            );
      },
    );
  }

  void _close(BuildContext context) {
    final notesCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Close EHS Observation'),
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
              context.read<EhsSiteObsBloc>().add(
                    CloseEhsSiteObs(
                      id: obs.id,
                      closureNotes: notesCtrl.text.trim().isEmpty
                          ? null
                          : notesCtrl.text.trim(),
                    ),
                  );
            },
            child: const Text('Close'),
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
            'Are you sure you want to delete this EHS observation? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context
                  .read<EhsSiteObsBloc>()
                  .add(DeleteEhsSiteObs(id: obs.id));
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

class _CategoryBadge extends StatelessWidget {
  final EhsCategory catEnum;
  const _CategoryBadge({required this.catEnum});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFD97706).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: const Color(0xFFD97706).withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(catEnum.icon, size: 12, color: const Color(0xFFD97706)),
          const SizedBox(width: 4),
          Text(catEnum.label,
              style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFFD97706),
                  fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

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

// _PhotoStrip and _FullscreenGallery replaced by shared PhotoGalleryStrip widget.
