import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/planning/data/models/planning_models.dart';

// ── Events ────────────────────────────────────────────────────────────────────

abstract class IssueTrackerEvent extends Equatable {
  const IssueTrackerEvent();
  @override List<Object?> get props => [];
}

class LoadIssues extends IssueTrackerEvent {
  final int projectId;
  final String? statusFilter;
  const LoadIssues(this.projectId, {this.statusFilter});
  @override List<Object?> get props => [projectId, statusFilter];
}

class RefreshIssues extends IssueTrackerEvent {
  const RefreshIssues();
}

class LoadIssueDetail extends IssueTrackerEvent {
  final int projectId;
  final int issueId;
  const LoadIssueDetail(this.projectId, this.issueId);
  @override List<Object?> get props => [projectId, issueId];
}

class CreateIssue extends IssueTrackerEvent {
  final int projectId;
  final Map<String, dynamic> data;
  const CreateIssue(this.projectId, this.data);
  @override List<Object?> get props => [projectId];
}

class RespondToIssue extends IssueTrackerEvent {
  final int projectId;
  final int issueId;
  final String responseText;
  final String? committedDate;
  const RespondToIssue(this.projectId, this.issueId, this.responseText, {this.committedDate});
  @override List<Object?> get props => [projectId, issueId];
}

class CloseIssue extends IssueTrackerEvent {
  final int projectId;
  final int issueId;
  final String? remarks;
  const CloseIssue(this.projectId, this.issueId, {this.remarks});
  @override List<Object?> get props => [projectId, issueId];
}

// ── States ────────────────────────────────────────────────────────────────────

abstract class IssueTrackerState extends Equatable {
  const IssueTrackerState();
  @override List<Object?> get props => [];
}

class IssueTrackerInitial extends IssueTrackerState { const IssueTrackerInitial(); }
class IssueTrackerLoading extends IssueTrackerState { const IssueTrackerLoading(); }

class IssuesLoaded extends IssueTrackerState {
  final List<IssueTrackerIssue> issues;
  final int projectId;
  final String? activeFilter;
  const IssuesLoaded({required this.issues, required this.projectId, this.activeFilter});
  @override List<Object?> get props => [issues, projectId, activeFilter];
}

class IssueDetailLoaded extends IssueTrackerState {
  final IssueTrackerIssue issue;
  const IssueDetailLoaded(this.issue);
  @override List<Object?> get props => [issue];
}

class IssueTrackerError extends IssueTrackerState {
  final String message;
  const IssueTrackerError(this.message);
  @override List<Object?> get props => [message];
}

class IssueActionSuccess extends IssueTrackerState {
  final String message;
  const IssueActionSuccess(this.message);
  @override List<Object?> get props => [message];
}

// ── Bloc ──────────────────────────────────────────────────────────────────────

class IssueTrackerBloc extends Bloc<IssueTrackerEvent, IssueTrackerState> {
  final SetuApiClient _apiClient;
  int? _currentProjectId;
  String? _currentFilter;

  IssueTrackerBloc({required SetuApiClient apiClient})
      : _apiClient = apiClient,
        super(const IssueTrackerInitial()) {
    on<LoadIssues>(_onLoadIssues);
    on<RefreshIssues>(_onRefresh);
    on<LoadIssueDetail>(_onLoadDetail);
    on<CreateIssue>(_onCreateIssue);
    on<RespondToIssue>(_onRespondToIssue);
    on<CloseIssue>(_onCloseIssue);
  }

  Future<void> _onLoadIssues(LoadIssues event, Emitter<IssueTrackerState> emit) async {
    _currentProjectId = event.projectId;
    _currentFilter = event.statusFilter;
    emit(const IssueTrackerLoading());
    try {
      final raw = await _apiClient.getIssues(event.projectId, status: event.statusFilter);
      final issues = raw
          .map((e) => IssueTrackerIssue.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(IssuesLoaded(issues: issues, projectId: event.projectId, activeFilter: event.statusFilter));
    } catch (e) {
      emit(IssueTrackerError('Failed to load issues: $e'));
    }
  }

  Future<void> _onRefresh(RefreshIssues _, Emitter<IssueTrackerState> emit) async {
    if (_currentProjectId == null) return;
    add(LoadIssues(_currentProjectId!, statusFilter: _currentFilter));
  }

  Future<void> _onLoadDetail(LoadIssueDetail event, Emitter<IssueTrackerState> emit) async {
    emit(const IssueTrackerLoading());
    try {
      final raw = await _apiClient.getIssue(event.projectId, event.issueId);
      emit(IssueDetailLoaded(IssueTrackerIssue.fromJson(raw)));
    } catch (e) {
      emit(IssueTrackerError('Failed to load issue: $e'));
    }
  }

  Future<void> _onCreateIssue(CreateIssue event, Emitter<IssueTrackerState> emit) async {
    try {
      await _apiClient.createIssue(event.projectId, event.data);
      emit(const IssueActionSuccess('Issue raised successfully'));
      add(LoadIssues(event.projectId, statusFilter: _currentFilter));
    } catch (e) {
      emit(IssueTrackerError('Failed to create issue: $e'));
    }
  }

  Future<void> _onRespondToIssue(RespondToIssue event, Emitter<IssueTrackerState> emit) async {
    try {
      await _apiClient.respondToIssue(
        event.projectId, event.issueId,
        responseText: event.responseText,
        committedDate: event.committedDate,
      );
      emit(const IssueActionSuccess('Response submitted'));
      add(LoadIssues(event.projectId, statusFilter: _currentFilter));
    } catch (e) {
      emit(IssueTrackerError('Failed to submit response: $e'));
    }
  }

  Future<void> _onCloseIssue(CloseIssue event, Emitter<IssueTrackerState> emit) async {
    try {
      await _apiClient.closeIssue(event.projectId, event.issueId, remarks: event.remarks);
      emit(const IssueActionSuccess('Issue closed'));
      add(LoadIssues(event.projectId, statusFilter: _currentFilter));
    } catch (e) {
      emit(IssueTrackerError('Failed to close issue: $e'));
    }
  }
}
