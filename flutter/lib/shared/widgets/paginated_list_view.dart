import 'package:flutter/material.dart';

/// Renders a long, already-fully-fetched list in fixed-size windows with
/// infinite scroll, instead of building every item up front.
///
/// Several backend endpoints (EHS incidents, RFI/inspection lists, drawing
/// register, snags, cube test register, progress approvals) currently
/// return the ENTIRE list in one response — there is no `limit`/`offset`
/// support yet. Rather than guess at a server contract that doesn't exist
/// (and risk silently duplicating rows the moment "load more" re-requests
/// data a non-paginating endpoint will just return in full again), this
/// widget does the windowing entirely on the client: it slices the list
/// you already have into pages of [pageSize] and reveals one more page as
/// the user scrolls near the bottom or taps "Load more".
///
/// This is intentionally a drop-in replacement for `ListView.builder` —
/// swap the constructor and nothing else needs to change. When a given
/// backend endpoint later adds real `limit`/`offset` support, the bloc
/// feeding this widget can switch to server-side paging (see
/// [EhsSiteObsBloc]/[QualitySiteObsBloc] for that reference pattern)
/// without any change needed here.
class PaginatedListView<T> extends StatefulWidget {
  final List<T> items;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final Widget Function(BuildContext context)? separatorBuilder;
  final int pageSize;
  final EdgeInsets? padding;
  final ScrollController? controller;
  final Widget? emptyWidget;

  const PaginatedListView({
    super.key,
    required this.items,
    required this.itemBuilder,
    this.separatorBuilder,
    this.pageSize = 50,
    this.padding,
    this.controller,
    this.emptyWidget,
  });

  @override
  State<PaginatedListView<T>> createState() => _PaginatedListViewState<T>();
}

class _PaginatedListViewState<T> extends State<PaginatedListView<T>> {
  late int _visibleCount;
  ScrollController? _ownController;

  ScrollController get _scrollController =>
      widget.controller ?? (_ownController ??= ScrollController());

  @override
  void initState() {
    super.initState();
    _visibleCount = widget.pageSize.clamp(0, widget.items.length);
    _scrollController.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(PaginatedListView<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A fresh fetch (e.g. pull-to-refresh) replaced the underlying list —
    // reset the window rather than keep an arbitrary count from before.
    if (oldWidget.items != widget.items) {
      _visibleCount = widget.pageSize.clamp(0, widget.items.length);
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _ownController?.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final nearBottom = _scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 300;
    if (nearBottom) _loadMore();
  }

  void _loadMore() {
    if (_visibleCount >= widget.items.length) return;
    setState(() {
      _visibleCount = (_visibleCount + widget.pageSize).clamp(0, widget.items.length);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty && widget.emptyWidget != null) {
      return widget.emptyWidget!;
    }
    final hasMore = _visibleCount < widget.items.length;
    final itemCount = _visibleCount + (hasMore ? 1 : 0);

    return ListView.separated(
      controller: _scrollController,
      padding: widget.padding,
      itemCount: itemCount,
      separatorBuilder: (ctx, i) =>
          i >= _visibleCount - 1 ? const SizedBox.shrink() : (widget.separatorBuilder?.call(ctx) ?? const SizedBox.shrink()),
      itemBuilder: (ctx, i) {
        if (i >= _visibleCount) {
          // Trailing "load more" row — shown once the user scrolls into it,
          // and also tappable in case the scroll-triggered load hasn't fired.
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: TextButton.icon(
                onPressed: _loadMore,
                icon: const Icon(Icons.expand_more_rounded, size: 18),
                label: Text('Load ${(widget.items.length - _visibleCount).clamp(0, widget.pageSize)} more '
                    'of ${widget.items.length}'),
              ),
            ),
          );
        }
        return widget.itemBuilder(ctx, widget.items[i], i);
      },
    );
  }
}
