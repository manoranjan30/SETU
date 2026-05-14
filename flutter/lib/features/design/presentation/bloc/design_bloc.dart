import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/design/data/models/design_models.dart';

// ==================== EVENTS ====================

abstract class DesignEvent extends Equatable {
  const DesignEvent();
  @override
  List<Object?> get props => [];
}

class LoadDesignRegister extends DesignEvent {
  final int projectId;
  final int? categoryId;
  const LoadDesignRegister({required this.projectId, this.categoryId});
  @override
  List<Object?> get props => [projectId, categoryId];
}

class FilterDesignCategory extends DesignEvent {
  final int? categoryId; // null = show all
  const FilterDesignCategory(this.categoryId);
  @override
  List<Object?> get props => [categoryId];
}

class SearchDesignDrawings extends DesignEvent {
  final String query;
  const SearchDesignDrawings(this.query);
  @override
  List<Object?> get props => [query];
}

// ==================== STATES ====================

abstract class DesignState extends Equatable {
  const DesignState();
  @override
  List<Object?> get props => [];
}

class DesignInitial extends DesignState {}

class DesignLoading extends DesignState {}

class DesignLoaded extends DesignState {
  final List<DrawingCategory> categories;
  final List<DrawingRegister> allDrawings;
  final List<DrawingRegister> filtered;
  final int? selectedCategoryId;
  final String searchQuery;

  const DesignLoaded({
    required this.categories,
    required this.allDrawings,
    required this.filtered,
    this.selectedCategoryId,
    this.searchQuery = '',
  });

  DesignLoaded copyWith({
    List<DrawingCategory>? categories,
    List<DrawingRegister>? allDrawings,
    List<DrawingRegister>? filtered,
    int? selectedCategoryId,
    bool clearCategory = false,
    String? searchQuery,
  }) {
    return DesignLoaded(
      categories: categories ?? this.categories,
      allDrawings: allDrawings ?? this.allDrawings,
      filtered: filtered ?? this.filtered,
      selectedCategoryId: clearCategory ? null : (selectedCategoryId ?? this.selectedCategoryId),
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }

  @override
  List<Object?> get props =>
      [categories, allDrawings, filtered, selectedCategoryId, searchQuery];
}

class DesignError extends DesignState {
  final String message;
  const DesignError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class DesignBloc extends Bloc<DesignEvent, DesignState> {
  final SetuApiClient _apiClient;

  DesignBloc({required SetuApiClient apiClient})
      : _apiClient = apiClient,
        super(DesignInitial()) {
    on<LoadDesignRegister>(_onLoad);
    on<FilterDesignCategory>(_onFilter);
    on<SearchDesignDrawings>(_onSearch);
  }

  Future<void> _onLoad(
      LoadDesignRegister event, Emitter<DesignState> emit) async {
    emit(DesignLoading());
    try {
      final results = await Future.wait([
        _apiClient.getDrawingCategories(),
        _apiClient.getDrawingRegister(event.projectId),
      ]);

      final categories = results[0].map(DrawingCategory.fromJson).toList();
      final drawings = results[1].map(DrawingRegister.fromJson).toList();

      emit(DesignLoaded(
        categories: categories,
        allDrawings: drawings,
        filtered: drawings,
      ));
    } catch (e) {
      emit(DesignError(_friendly(e)));
    }
  }

  void _onFilter(FilterDesignCategory event, Emitter<DesignState> emit) {
    final current = state;
    if (current is! DesignLoaded) return;

    final filtered = _applyFilters(
      current.allDrawings,
      categoryId: event.categoryId,
      query: current.searchQuery,
    );

    emit(current.copyWith(
      filtered: filtered,
      selectedCategoryId: event.categoryId,
      clearCategory: event.categoryId == null,
    ));
  }

  void _onSearch(SearchDesignDrawings event, Emitter<DesignState> emit) {
    final current = state;
    if (current is! DesignLoaded) return;

    final filtered = _applyFilters(
      current.allDrawings,
      categoryId: current.selectedCategoryId,
      query: event.query,
    );

    emit(current.copyWith(filtered: filtered, searchQuery: event.query));
  }

  List<DrawingRegister> _applyFilters(
    List<DrawingRegister> drawings, {
    int? categoryId,
    String query = '',
  }) {
    var result = drawings;

    if (categoryId != null) {
      result = result.where((d) => d.categoryId == categoryId).toList();
    }

    final q = query.trim().toLowerCase();
    if (q.isNotEmpty) {
      result = result
          .where((d) =>
              d.title.toLowerCase().contains(q) ||
              d.drawingNumber.toLowerCase().contains(q) ||
              (d.categoryName?.toLowerCase().contains(q) ?? false))
          .toList();
    }

    return result;
  }

  String _friendly(dynamic e) {
    final s = e.toString().toLowerCase();
    if (s.contains('connection') ||
        s.contains('network') ||
        s.contains('socket')) {
      return 'No connection. Check your network and try again.';
    }
    return 'Could not load drawings. Please try again.';
  }
}
