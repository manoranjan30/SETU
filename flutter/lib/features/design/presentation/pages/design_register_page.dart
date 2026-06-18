import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/design/data/models/design_models.dart';
import 'package:setu_mobile/features/design/presentation/bloc/design_bloc.dart';
import 'package:setu_mobile/injection_container.dart';
import 'package:setu_mobile/shared/widgets/paginated_list_view.dart';

class DesignRegisterPage extends StatelessWidget {
  final int projectId;
  final String projectName;

  const DesignRegisterPage({
    super.key,
    required this.projectId,
    required this.projectName,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => DesignBloc(apiClient: sl<SetuApiClient>())
        ..add(LoadDesignRegister(projectId: projectId)),
      child: _DesignRegisterView(
        projectId: projectId,
        projectName: projectName,
      ),
    );
  }
}

class _DesignRegisterView extends StatefulWidget {
  final int projectId;
  final String projectName;

  const _DesignRegisterView({
    required this.projectId,
    required this.projectName,
  });

  @override
  State<_DesignRegisterView> createState() => _DesignRegisterViewState();
}

class _DesignRegisterViewState extends State<_DesignRegisterView> {
  final _searchCtrl = TextEditingController();
  // Track which revisions are currently downloading: revisionId → progress 0.0–1.0
  final Map<int, double> _downloading = {};

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _openWith(DrawingRegister drawing) async {
    final rev = drawing.currentRevision;
    if (rev == null) return;

    setState(() => _downloading[rev.id] = 0.0);

    try {
      final dir = await getTemporaryDirectory();
      // Use originalFileName so the opened app sees the real file name
      final safeFileName = rev.originalFileName.replaceAll(RegExp(r'[^\w.\-]'), '_');
      final savePath = '${dir.path}/$safeFileName';

      await sl<SetuApiClient>().downloadDrawingRevision(
        projectId: widget.projectId,
        revisionId: rev.id,
        savePath: savePath,
        onProgress: (received, total) {
          if (total > 0 && mounted) {
            setState(() => _downloading[rev.id] = received / total);
          }
        },
      );

      if (!mounted) return;
      setState(() => _downloading.remove(rev.id));

      final result = await OpenFile.open(savePath);
      if (!mounted) return;

      // OpenFile returns type=done on success; anything else = no app available
      if (result.type != ResultType.done) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              rev.isDwg
                  ? 'No app installed to open DWG files.\nInstall AutoCAD Mobile or DWG FastView.'
                  : 'Could not open file: ${result.message}',
            ),
            duration: const Duration(seconds: 4),
            backgroundColor: Colors.orange.shade700,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _downloading.remove(rev.id));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Download failed: ${e.toString()}'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Drawing Register',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            Text(widget.projectName,
                style:
                    const TextStyle(fontSize: 11, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          BlocBuilder<DesignBloc, DesignState>(
            builder: (context, state) => IconButton(
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'Refresh',
              onPressed: () => context
                  .read<DesignBloc>()
                  .add(LoadDesignRegister(projectId: widget.projectId)),
            ),
          ),
        ],
      ),
      body: BlocConsumer<DesignBloc, DesignState>(
        listener: (context, state) {
          if (state is DesignError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Colors.red.shade700,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is DesignLoading || state is DesignInitial) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is DesignError) {
            return _ErrorView(
              message: state.message,
              onRetry: () => context
                  .read<DesignBloc>()
                  .add(LoadDesignRegister(projectId: widget.projectId)),
            );
          }
          if (state is DesignLoaded) {
            return _LoadedBody(
              state: state,
              searchCtrl: _searchCtrl,
              downloading: _downloading,
              onOpenWith: _openWith,
              onCategorySelected: (id) => context
                  .read<DesignBloc>()
                  .add(FilterDesignCategory(id)),
              onSearch: (q) => context
                  .read<DesignBloc>()
                  .add(SearchDesignDrawings(q)),
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Loaded body — search bar + category chips + drawing list
// ---------------------------------------------------------------------------

class _LoadedBody extends StatelessWidget {
  final DesignLoaded state;
  final TextEditingController searchCtrl;
  final Map<int, double> downloading;
  final Future<void> Function(DrawingRegister) onOpenWith;
  final void Function(int?) onCategorySelected;
  final void Function(String) onSearch;

  const _LoadedBody({
    required this.state,
    required this.searchCtrl,
    required this.downloading,
    required this.onOpenWith,
    required this.onCategorySelected,
    required this.onSearch,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Search bar ─────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          child: TextField(
            controller: searchCtrl,
            onChanged: onSearch,
            decoration: InputDecoration(
              hintText: 'Search by title or drawing number…',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: searchCtrl.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        searchCtrl.clear();
                        onSearch('');
                      },
                    )
                  : null,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
        ),

        // ── Category filter chips ───────────────────────────────────────
        if (state.categories.isNotEmpty)
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemCount: state.categories.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return _CategoryChip(
                    label: 'All',
                    selected: state.selectedCategoryId == null,
                    onTap: () => onCategorySelected(null),
                  );
                }
                final cat = state.categories[i - 1];
                return _CategoryChip(
                  label: cat.code,
                  tooltip: cat.name,
                  selected: state.selectedCategoryId == cat.id,
                  onTap: () => onCategorySelected(cat.id),
                );
              },
            ),
          ),

        const SizedBox(height: 4),

        // ── Drawing list ───────────────────────────────────────────────
        Expanded(
          child: state.filtered.isEmpty
              ? _EmptyView(hasSearch: state.searchQuery.isNotEmpty ||
                  state.selectedCategoryId != null)
              : PaginatedListView<DrawingRegister>(
                  items: state.filtered,
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                  separatorBuilder: (_) => const SizedBox(height: 8),
                  itemBuilder: (_, drawing, __) => _DrawingCard(
                    drawing: drawing,
                    downloadProgress: drawing.currentRevision != null
                        ? downloading[drawing.currentRevision!.id]
                        : null,
                    onOpenWith: onOpenWith,
                  ),
                ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Category chip
// ---------------------------------------------------------------------------

class _CategoryChip extends StatelessWidget {
  final String label;
  final String? tooltip;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryChip({
    required this.label,
    this.tooltip,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return Tooltip(
      message: tooltip ?? label,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? color : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? color : const Color(0xFFD1D5DB),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : const Color(0xFF374151),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Drawing card
// ---------------------------------------------------------------------------

class _DrawingCard extends StatelessWidget {
  final DrawingRegister drawing;
  final double? downloadProgress; // null = not downloading
  final Future<void> Function(DrawingRegister) onOpenWith;

  const _DrawingCard({
    required this.drawing,
    required this.downloadProgress,
    required this.onOpenWith,
  });

  @override
  Widget build(BuildContext context) {
    final rev = drawing.currentRevision;
    final isDownloading = downloadProgress != null;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: rev != null ? () => onOpenWith(drawing) : null,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header row ───────────────────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // File-type icon
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _fileColor(rev).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      _fileIcon(rev),
                      color: _fileColor(rev),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Drawing number + status badge
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                drawing.drawingNumber,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                            ),
                            _StatusBadge(status: drawing.status),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          drawing.title,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF111827),
                          ),
                        ),
                        if (drawing.categoryName != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              drawing.categoryName!,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF9CA3AF),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),

              // ── Revision info row ────────────────────────────────────
              if (rev != null) ...[
                const SizedBox(height: 10),
                const Divider(height: 1, color: Color(0xFFF3F4F6)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _RevChip(label: 'Rev ${rev.revisionNumber}'),
                    if (rev.revisionDate != null) ...[
                      const SizedBox(width: 6),
                      Text(
                        DateFormat('dd MMM yyyy').format(rev.revisionDate!),
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                    ],
                    const SizedBox(width: 6),
                    Text(
                      rev.fileSizeLabel,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                    const Spacer(),
                    // Open With button / progress indicator
                    if (isDownloading)
                      _DownloadProgress(progress: downloadProgress!)
                    else
                      _OpenWithButton(onTap: () => onOpenWith(drawing)),
                  ],
                ),
              ] else ...[
                const SizedBox(height: 8),
                const Text(
                  'No revision uploaded yet',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF9CA3AF),
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  IconData _fileIcon(DrawingRevision? rev) {
    if (rev == null) return Icons.insert_drive_file_outlined;
    if (rev.isDwg) return Icons.architecture_outlined;
    if (rev.isPdf) return Icons.picture_as_pdf_outlined;
    return Icons.insert_drive_file_outlined;
  }

  Color _fileColor(DrawingRevision? rev) {
    if (rev == null) return const Color(0xFF9CA3AF);
    if (rev.isDwg) return const Color(0xFF1565C0);
    if (rev.isPdf) return const Color(0xFFDC2626);
    return const Color(0xFF6B7280);
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        _label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: _color,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Color get _color => switch (status) {
        'ACTIVE_GFC' => const Color(0xFF15803D),
        'ADVANCE_COPY' => const Color(0xFF1D4ED8),
        'SUPERSEDED' => const Color(0xFFD97706),
        'ON_HOLD' => const Color(0xFFDC2626),
        'REFERENCE_ONLY' => const Color(0xFF7C3AED),
        _ => const Color(0xFF6B7280),
      };

  String get _label => switch (status) {
        'ACTIVE_GFC' => 'GFC',
        'ADVANCE_COPY' => 'ADVANCE',
        'SUPERSEDED' => 'SUPERSEDED',
        'ON_HOLD' => 'ON HOLD',
        'REFERENCE_ONLY' => 'REF ONLY',
        'PLANNED' => 'PLANNED',
        _ => status,
      };
}

// ---------------------------------------------------------------------------
// Revision chip
// ---------------------------------------------------------------------------

class _RevChip extends StatelessWidget {
  final String label;
  const _RevChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: Color(0xFF1D4ED8),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Open With button
// ---------------------------------------------------------------------------

class _OpenWithButton extends StatelessWidget {
  final VoidCallback onTap;
  const _OpenWithButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFF1565C0),
          borderRadius: BorderRadius.circular(7),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.open_in_new_rounded, color: Colors.white, size: 13),
            SizedBox(width: 4),
            Text(
              'Open With',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Download progress indicator
// ---------------------------------------------------------------------------

class _DownloadProgress extends StatelessWidget {
  final double progress;
  const _DownloadProgress({required this.progress});

  @override
  Widget build(BuildContext context) {
    final pct = (progress * 100).toInt();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(
            value: progress > 0 ? progress : null,
            strokeWidth: 2,
            color: const Color(0xFF1565C0),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          progress > 0 ? '$pct%' : 'Starting…',
          style: const TextStyle(
            fontSize: 11,
            color: Color(0xFF1565C0),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Empty / error views
// ---------------------------------------------------------------------------

class _EmptyView extends StatelessWidget {
  final bool hasSearch;
  const _EmptyView({required this.hasSearch});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            hasSearch ? Icons.search_off_rounded : Icons.folder_open_outlined,
            size: 56,
            color: Colors.grey.shade300,
          ),
          const SizedBox(height: 12),
          Text(
            hasSearch
                ? 'No drawings match your search'
                : 'No drawings uploaded yet',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

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
            Icon(Icons.error_outline,
                size: 56,
                color: Theme.of(context).colorScheme.error.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
