import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== EVENTS ====================

abstract class PourCardEvent extends Equatable {
  const PourCardEvent();
  @override
  List<Object?> get props => [];
}

class LoadPourCard extends PourCardEvent {
  final int inspectionId;
  const LoadPourCard(this.inspectionId);
  @override
  List<Object?> get props => [inspectionId];
}

class AddPourEntry extends PourCardEvent {
  const AddPourEntry();
}

class RemovePourEntry extends PourCardEvent {
  final int index;
  const RemovePourEntry(this.index);
  @override
  List<Object?> get props => [index];
}

class UpdatePourEntry extends PourCardEvent {
  final int index;
  final PourCardEntry entry;
  const UpdatePourEntry(this.index, this.entry);
  @override
  List<Object?> get props => [index, entry];
}

class UpdatePourCardHeader extends PourCardEvent {
  final String? elementName;
  final String? locationText;
  final String? remarks;
  final String? concreteGrade;
  final String? mixDesignApprovalRef;
  final String? specimenCode;
  const UpdatePourCardHeader({
    this.elementName,
    this.locationText,
    this.remarks,
    this.concreteGrade,
    this.mixDesignApprovalRef,
    this.specimenCode,
  });
  @override
  List<Object?> get props => [elementName, locationText, remarks];
}

class SavePourCard extends PourCardEvent {
  const SavePourCard();
}

class SubmitPourCard extends PourCardEvent {
  const SubmitPourCard();
}

class ApprovePourCard extends PourCardEvent {
  final String? remarks;
  const ApprovePourCard({this.remarks});
  @override
  List<Object?> get props => [remarks];
}

class RejectPourCard extends PourCardEvent {
  final String reason;
  const RejectPourCard(this.reason);
  @override
  List<Object?> get props => [reason];
}

// ==================== STATES ====================

abstract class PourCardState extends Equatable {
  const PourCardState();
  @override
  List<Object?> get props => [];
}

class PourCardInitial extends PourCardState {
  const PourCardInitial();
}

class PourCardLoading extends PourCardState {
  const PourCardLoading();
}

class PourCardLoaded extends PourCardState {
  final QualityPourCard card;
  const PourCardLoaded(this.card);
  @override
  List<Object?> get props => [card];
}

class PourCardSaving extends PourCardState {
  final QualityPourCard card;
  const PourCardSaving(this.card);
  @override
  List<Object?> get props => [card];
}

class PourCardActionSuccess extends PourCardState {
  final String message;
  final QualityPourCard card;
  const PourCardActionSuccess({required this.message, required this.card});
  @override
  List<Object?> get props => [message, card];
}

class PourCardError extends PourCardState {
  final String message;
  const PourCardError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class PourCardBloc extends Bloc<PourCardEvent, PourCardState> {
  final SetuApiClient _api;

  PourCardBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(const PourCardInitial()) {
    on<LoadPourCard>(_onLoad);
    on<AddPourEntry>(_onAddEntry);
    on<RemovePourEntry>(_onRemoveEntry);
    on<UpdatePourEntry>(_onUpdateEntry);
    on<UpdatePourCardHeader>(_onUpdateHeader);
    on<SavePourCard>(_onSave);
    on<SubmitPourCard>(_onSubmit);
    on<ApprovePourCard>(_onApprove);
    on<RejectPourCard>(_onReject);
  }

  QualityPourCard? _currentCard;

  Future<void> _onLoad(LoadPourCard event, Emitter<PourCardState> emit) async {
    emit(const PourCardLoading());
    try {
      final data = await _api.getPourCard(event.inspectionId);
      _currentCard = QualityPourCard.fromJson(data);
      emit(PourCardLoaded(_currentCard!));
    } catch (e) {
      emit(PourCardError(_friendlyError(e)));
    }
  }

  void _onAddEntry(AddPourEntry event, Emitter<PourCardState> emit) {
    if (_currentCard == null) return;
    final entries = List<PourCardEntry>.from(_currentCard!.entries)
      ..add(const PourCardEntry());
    _currentCard = _currentCard!.copyWith(entries: entries);
    emit(PourCardLoaded(_currentCard!));
  }

  void _onRemoveEntry(RemovePourEntry event, Emitter<PourCardState> emit) {
    if (_currentCard == null) return;
    final entries = List<PourCardEntry>.from(_currentCard!.entries);
    if (event.index >= 0 && event.index < entries.length) {
      entries.removeAt(event.index);
    }
    _currentCard = _currentCard!.copyWith(entries: entries);
    emit(PourCardLoaded(_currentCard!));
  }

  void _onUpdateEntry(UpdatePourEntry event, Emitter<PourCardState> emit) {
    if (_currentCard == null) return;
    final entries = List<PourCardEntry>.from(_currentCard!.entries);
    if (event.index >= 0 && event.index < entries.length) {
      entries[event.index] = event.entry;
    }
    _currentCard = _currentCard!.copyWith(entries: entries);
    emit(PourCardLoaded(_currentCard!));
  }

  void _onUpdateHeader(UpdatePourCardHeader event, Emitter<PourCardState> emit) {
    if (_currentCard == null) return;
    _currentCard = _currentCard!.copyWith(
      elementName: event.elementName ?? _currentCard!.elementName,
      locationText: event.locationText ?? _currentCard!.locationText,
      remarks: event.remarks ?? _currentCard!.remarks,
    );
    emit(PourCardLoaded(_currentCard!));
  }

  Future<void> _onSave(SavePourCard event, Emitter<PourCardState> emit) async {
    if (_currentCard == null) return;
    emit(PourCardSaving(_currentCard!));
    try {
      final data = await _api.savePourCard(
        _currentCard!.inspectionId,
        _currentCard!.toSaveJson(),
      );
      _currentCard = QualityPourCard.fromJson(data);
      emit(PourCardActionSuccess(
        message: 'Pour card draft saved',
        card: _currentCard!,
      ));
    } catch (e) {
      emit(PourCardError(_friendlyError(e)));
    }
  }

  Future<void> _onSubmit(SubmitPourCard event, Emitter<PourCardState> emit) async {
    if (_currentCard == null) return;
    emit(PourCardSaving(_currentCard!));
    try {
      final data = await _api.submitPourCard(_currentCard!.inspectionId);
      _currentCard = QualityPourCard.fromJson(data);
      emit(PourCardActionSuccess(
        message: 'Pour card submitted for approval',
        card: _currentCard!,
      ));
    } catch (e) {
      emit(PourCardError(_friendlyError(e)));
    }
  }

  Future<void> _onApprove(ApprovePourCard event, Emitter<PourCardState> emit) async {
    if (_currentCard == null) return;
    emit(PourCardSaving(_currentCard!));
    try {
      final data = await _api.approvePourCard(
        _currentCard!.inspectionId,
        remarks: event.remarks,
      );
      _currentCard = QualityPourCard.fromJson(data);
      emit(PourCardActionSuccess(
        message: 'Pour card approved',
        card: _currentCard!,
      ));
    } catch (e) {
      emit(PourCardError(_friendlyError(e)));
    }
  }

  Future<void> _onReject(RejectPourCard event, Emitter<PourCardState> emit) async {
    if (_currentCard == null) return;
    emit(PourCardSaving(_currentCard!));
    try {
      final data = await _api.rejectPourCard(
        _currentCard!.inspectionId,
        remarks: event.reason,
      );
      _currentCard = QualityPourCard.fromJson(data);
      emit(PourCardActionSuccess(
        message: 'Pour card rejected',
        card: _currentCard!,
      ));
    } catch (e) {
      emit(PourCardError(_friendlyError(e)));
    }
  }

  String _friendlyError(Object e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('401') || msg.contains('unauthorized')) return 'Session expired. Please log in again.';
    if (msg.contains('403') || msg.contains('forbidden')) return 'You do not have permission to perform this action.';
    if (msg.contains('404')) return 'Pour card not found.';
    if (msg.contains('connection') || msg.contains('socket')) return 'No connection. Check your network and try again.';
    return 'An error occurred. Please try again.';
  }
}
