import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/quality/data/models/quality_models.dart';

// ==================== EVENTS ====================

abstract class ClearanceCardEvent extends Equatable {
  const ClearanceCardEvent();
  @override
  List<Object?> get props => [];
}

class LoadClearanceCard extends ClearanceCardEvent {
  final int inspectionId;
  const LoadClearanceCard(this.inspectionId);
  @override
  List<Object?> get props => [inspectionId];
}

class UpdateClearanceHeader extends ClearanceCardEvent {
  final String? pourLocation;
  final String? pourNo;
  final String? gradeOfConcrete;
  final String? placementMethod;
  final String? concreteSupplier;
  final String? targetSlump;
  final String? cardDate;
  final String? pourStartTime;
  final String? pourEndTime;
  final double? estimatedConcreteQty;
  final int? cubeMouldCount;
  final int? vibratorCount;

  const UpdateClearanceHeader({
    this.pourLocation,
    this.pourNo,
    this.gradeOfConcrete,
    this.placementMethod,
    this.concreteSupplier,
    this.targetSlump,
    this.cardDate,
    this.pourStartTime,
    this.pourEndTime,
    this.estimatedConcreteQty,
    this.cubeMouldCount,
    this.vibratorCount,
  });
  @override
  List<Object?> get props => [pourLocation, pourNo, gradeOfConcrete];
}

class UpdateAttachment extends ClearanceCardEvent {
  final String key;
  final String value; // 'YES' | 'NO' | 'NA'
  const UpdateAttachment(this.key, this.value);
  @override
  List<Object?> get props => [key, value];
}

class AddSignoff extends ClearanceCardEvent {
  final String department;
  final String? designation;
  final String? personName;
  const AddSignoff({required this.department, this.designation, this.personName});
  @override
  List<Object?> get props => [department, designation, personName];
}

class UpdateSignoffPerson extends ClearanceCardEvent {
  final int index;
  final String personName;
  const UpdateSignoffPerson(this.index, this.personName);
  @override
  List<Object?> get props => [index, personName];
}

class MarkSignoffSigned extends ClearanceCardEvent {
  final int index;
  const MarkSignoffSigned(this.index);
  @override
  List<Object?> get props => [index];
}

class MarkSignoffWaived extends ClearanceCardEvent {
  final int index;
  const MarkSignoffWaived(this.index);
  @override
  List<Object?> get props => [index];
}

class RemoveSignoff extends ClearanceCardEvent {
  final int index;
  const RemoveSignoff(this.index);
  @override
  List<Object?> get props => [index];
}

class SaveClearanceCard extends ClearanceCardEvent {
  const SaveClearanceCard();
}

class SubmitClearanceCard extends ClearanceCardEvent {
  const SubmitClearanceCard();
}

class ApproveClearanceCard extends ClearanceCardEvent {
  final String? remarks;
  const ApproveClearanceCard({this.remarks});
  @override
  List<Object?> get props => [remarks];
}

class RejectClearanceCard extends ClearanceCardEvent {
  final String reason;
  const RejectClearanceCard(this.reason);
  @override
  List<Object?> get props => [reason];
}

// ==================== STATES ====================

abstract class ClearanceCardState extends Equatable {
  const ClearanceCardState();
  @override
  List<Object?> get props => [];
}

class ClearanceCardInitial extends ClearanceCardState {
  const ClearanceCardInitial();
}

class ClearanceCardLoading extends ClearanceCardState {
  const ClearanceCardLoading();
}

class ClearanceCardLoaded extends ClearanceCardState {
  final QualityPrePourClearanceCard card;
  const ClearanceCardLoaded(this.card);
  @override
  List<Object?> get props => [card];
}

class ClearanceCardSaving extends ClearanceCardState {
  final QualityPrePourClearanceCard card;
  const ClearanceCardSaving(this.card);
  @override
  List<Object?> get props => [card];
}

class ClearanceCardActionSuccess extends ClearanceCardState {
  final String message;
  final QualityPrePourClearanceCard card;
  const ClearanceCardActionSuccess({required this.message, required this.card});
  @override
  List<Object?> get props => [message, card];
}

class ClearanceCardError extends ClearanceCardState {
  final String message;
  const ClearanceCardError(this.message);
  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================

class ClearanceCardBloc extends Bloc<ClearanceCardEvent, ClearanceCardState> {
  final SetuApiClient _api;

  ClearanceCardBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(const ClearanceCardInitial()) {
    on<LoadClearanceCard>(_onLoad);
    on<UpdateClearanceHeader>(_onUpdateHeader);
    on<UpdateAttachment>(_onUpdateAttachment);
    on<AddSignoff>(_onAddSignoff);
    on<UpdateSignoffPerson>(_onUpdateSignoffPerson);
    on<MarkSignoffSigned>(_onMarkSigned);
    on<MarkSignoffWaived>(_onMarkWaived);
    on<RemoveSignoff>(_onRemoveSignoff);
    on<SaveClearanceCard>(_onSave);
    on<SubmitClearanceCard>(_onSubmit);
    on<ApproveClearanceCard>(_onApprove);
    on<RejectClearanceCard>(_onReject);
  }

  QualityPrePourClearanceCard? _card;

  Future<void> _onLoad(LoadClearanceCard event, Emitter<ClearanceCardState> emit) async {
    emit(const ClearanceCardLoading());
    try {
      final data = await _api.getClearanceCard(event.inspectionId);
      _card = QualityPrePourClearanceCard.fromJson(data);
      emit(ClearanceCardLoaded(_card!));
    } catch (e) {
      emit(ClearanceCardError(_friendlyError(e)));
    }
  }

  void _onUpdateHeader(UpdateClearanceHeader event, Emitter<ClearanceCardState> emit) {
    if (_card == null) return;
    _card = _card!.copyWith(
      pourLocation: event.pourLocation ?? _card!.pourLocation,
      pourNo: event.pourNo ?? _card!.pourNo,
      gradeOfConcrete: event.gradeOfConcrete ?? _card!.gradeOfConcrete,
      placementMethod: event.placementMethod ?? _card!.placementMethod,
      concreteSupplier: event.concreteSupplier ?? _card!.concreteSupplier,
      targetSlump: event.targetSlump ?? _card!.targetSlump,
      cardDate: event.cardDate ?? _card!.cardDate,
      pourStartTime: event.pourStartTime ?? _card!.pourStartTime,
      pourEndTime: event.pourEndTime ?? _card!.pourEndTime,
      estimatedConcreteQty: event.estimatedConcreteQty ?? _card!.estimatedConcreteQty,
      cubeMouldCount: event.cubeMouldCount ?? _card!.cubeMouldCount,
      vibratorCount: event.vibratorCount ?? _card!.vibratorCount,
    );
    emit(ClearanceCardLoaded(_card!));
  }

  void _onUpdateAttachment(UpdateAttachment event, Emitter<ClearanceCardState> emit) {
    if (_card == null) return;
    final attachments = Map<String, String>.from(_card!.attachments)
      ..[event.key] = event.value;
    _card = _card!.copyWith(attachments: attachments);
    emit(ClearanceCardLoaded(_card!));
  }

  void _onAddSignoff(AddSignoff event, Emitter<ClearanceCardState> emit) {
    if (_card == null) return;
    final signoffs = List<ClearanceSignoff>.from(_card!.signoffs)
      ..add(ClearanceSignoff(
        department: event.department,
        designation: event.designation,
        isActive: true,
        personName: event.personName,
        status: ClearanceSignoffStatus.pending,
      ));
    _card = _card!.copyWith(signoffs: signoffs);
    emit(ClearanceCardLoaded(_card!));
  }

  void _onUpdateSignoffPerson(UpdateSignoffPerson event, Emitter<ClearanceCardState> emit) {
    if (_card == null) return;
    final signoffs = List<ClearanceSignoff>.from(_card!.signoffs);
    if (event.index >= 0 && event.index < signoffs.length) {
      signoffs[event.index] = signoffs[event.index].copyWith(personName: event.personName);
    }
    _card = _card!.copyWith(signoffs: signoffs);
    emit(ClearanceCardLoaded(_card!));
  }

  void _onMarkSigned(MarkSignoffSigned event, Emitter<ClearanceCardState> emit) {
    if (_card == null) return;
    final signoffs = List<ClearanceSignoff>.from(_card!.signoffs);
    if (event.index >= 0 && event.index < signoffs.length) {
      signoffs[event.index] = signoffs[event.index].copyWith(
        status: ClearanceSignoffStatus.signed,
        signedDate: DateTime.now().toIso8601String(),
      );
    }
    _card = _card!.copyWith(signoffs: signoffs);
    emit(ClearanceCardLoaded(_card!));
  }

  void _onMarkWaived(MarkSignoffWaived event, Emitter<ClearanceCardState> emit) {
    if (_card == null) return;
    final signoffs = List<ClearanceSignoff>.from(_card!.signoffs);
    if (event.index >= 0 && event.index < signoffs.length) {
      signoffs[event.index] = signoffs[event.index].copyWith(
        status: ClearanceSignoffStatus.waived,
      );
    }
    _card = _card!.copyWith(signoffs: signoffs);
    emit(ClearanceCardLoaded(_card!));
  }

  void _onRemoveSignoff(RemoveSignoff event, Emitter<ClearanceCardState> emit) {
    if (_card == null) return;
    final signoffs = List<ClearanceSignoff>.from(_card!.signoffs);
    if (event.index >= 0 && event.index < signoffs.length) {
      signoffs.removeAt(event.index);
    }
    _card = _card!.copyWith(signoffs: signoffs);
    emit(ClearanceCardLoaded(_card!));
  }

  Future<void> _onSave(SaveClearanceCard event, Emitter<ClearanceCardState> emit) async {
    if (_card == null) return;
    emit(ClearanceCardSaving(_card!));
    try {
      final data = await _api.saveClearanceCard(
        _card!.inspectionId,
        _card!.toSaveJson(),
      );
      _card = QualityPrePourClearanceCard.fromJson(data);
      emit(ClearanceCardActionSuccess(message: 'Clearance card saved', card: _card!));
    } catch (e) {
      emit(ClearanceCardError(_friendlyError(e)));
    }
  }

  Future<void> _onSubmit(SubmitClearanceCard event, Emitter<ClearanceCardState> emit) async {
    if (_card == null) return;
    emit(ClearanceCardSaving(_card!));
    try {
      final data = await _api.submitClearanceCard(_card!.inspectionId);
      _card = QualityPrePourClearanceCard.fromJson(data);
      emit(ClearanceCardActionSuccess(message: 'Clearance card submitted for approval', card: _card!));
    } catch (e) {
      emit(ClearanceCardError(_friendlyError(e)));
    }
  }

  Future<void> _onApprove(ApproveClearanceCard event, Emitter<ClearanceCardState> emit) async {
    if (_card == null) return;
    emit(ClearanceCardSaving(_card!));
    try {
      final data = await _api.approveClearanceCard(
        _card!.inspectionId,
        remarks: event.remarks,
      );
      _card = QualityPrePourClearanceCard.fromJson(data);
      emit(ClearanceCardActionSuccess(message: 'Clearance card approved', card: _card!));
    } catch (e) {
      emit(ClearanceCardError(_friendlyError(e)));
    }
  }

  Future<void> _onReject(RejectClearanceCard event, Emitter<ClearanceCardState> emit) async {
    if (_card == null) return;
    emit(ClearanceCardSaving(_card!));
    try {
      final data = await _api.rejectClearanceCard(
        _card!.inspectionId,
        remarks: event.reason,
      );
      _card = QualityPrePourClearanceCard.fromJson(data);
      emit(ClearanceCardActionSuccess(message: 'Clearance card rejected', card: _card!));
    } catch (e) {
      emit(ClearanceCardError(_friendlyError(e)));
    }
  }

  String _friendlyError(Object e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('401') || msg.contains('unauthorized')) return 'Session expired. Please log in again.';
    if (msg.contains('403') || msg.contains('forbidden')) return 'You do not have permission to perform this action.';
    if (msg.contains('not activated') || msg.contains('locked')) return 'This card is not yet activated. Wait for the trigger stage to be approved.';
    if (msg.contains('connection') || msg.contains('socket')) return 'No connection. Check your network and try again.';
    return 'An error occurred. Please try again.';
  }
}
