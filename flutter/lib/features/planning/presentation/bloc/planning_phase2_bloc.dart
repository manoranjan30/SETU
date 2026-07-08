import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/planning/data/models/phase2_models.dart';

// ── Events ────────────────────────────────────────────────────────────────────

abstract class Phase2Event extends Equatable {
  const Phase2Event();
  @override List<Object?> get props => [];
}

// Task events
class LoadSummary extends Phase2Event {
  final int projectId;
  const LoadSummary(this.projectId);
  @override List<Object?> get props => [projectId];
}

class LoadTasks extends Phase2Event {
  final int projectId;
  final bool myTasksOnly;
  final String? statusFilter; // 'ACTIVE' | 'COMPLETED' | 'HISTORY' | null (all)
  const LoadTasks(this.projectId, {this.myTasksOnly = false, this.statusFilter});
  @override List<Object?> get props => [projectId, myTasksOnly, statusFilter];
}

class CreateTask extends Phase2Event {
  final int projectId;
  final Map<String, dynamic> data;
  const CreateTask(this.projectId, this.data);
  @override List<Object?> get props => [projectId];
}

class UpdateTaskStatus extends Phase2Event {
  final int projectId;
  final int taskId;
  final String status;
  const UpdateTaskStatus(this.projectId, this.taskId, this.status);
  @override List<Object?> get props => [taskId, status];
}

class CompleteTask extends Phase2Event {
  final int projectId;
  final int taskId;
  const CompleteTask(this.projectId, this.taskId);
  @override List<Object?> get props => [taskId];
}

class ReopenTask extends Phase2Event {
  final int projectId;
  final int taskId;
  const ReopenTask(this.projectId, this.taskId);
  @override List<Object?> get props => [taskId];
}

class DeleteTask extends Phase2Event {
  final int projectId;
  final int taskId;
  const DeleteTask(this.projectId, this.taskId);
  @override List<Object?> get props => [projectId, taskId];
}

// Followup events
class LoadFollowups extends Phase2Event {
  final int projectId;
  final bool myOnly;
  const LoadFollowups(this.projectId, {this.myOnly = false});
  @override List<Object?> get props => [projectId, myOnly];
}

class CreateFollowup extends Phase2Event {
  final int projectId;
  final Map<String, dynamic> data;
  const CreateFollowup(this.projectId, this.data);
  @override List<Object?> get props => [projectId];
}

class CloseFollowup extends Phase2Event {
  final int projectId;
  final int followupId;
  final String? remarks;
  const CloseFollowup(this.projectId, this.followupId, {this.remarks});
  @override List<Object?> get props => [projectId, followupId];
}

class ReopenFollowup extends Phase2Event {
  final int projectId;
  final int followupId;
  const ReopenFollowup(this.projectId, this.followupId);
  @override List<Object?> get props => [projectId, followupId];
}

class SnoozeFollowup extends Phase2Event {
  final int projectId;
  final int followupId;
  final String dueDate;
  final String reminderAt;
  const SnoozeFollowup(this.projectId, this.followupId, {required this.dueDate, required this.reminderAt});
  @override List<Object?> get props => [projectId, followupId];
}

class ConvertFollowupToTask extends Phase2Event {
  final int projectId;
  final int followupId;
  const ConvertFollowupToTask(this.projectId, this.followupId);
  @override List<Object?> get props => [projectId, followupId];
}

class DeleteFollowup extends Phase2Event {
  final int projectId;
  final int followupId;
  const DeleteFollowup(this.projectId, this.followupId);
  @override List<Object?> get props => [projectId, followupId];
}

// Journal events
class LoadJournal extends Phase2Event {
  final int projectId;
  const LoadJournal(this.projectId);
  @override List<Object?> get props => [projectId];
}

class SaveJournalEntry extends Phase2Event {
  final int projectId;
  final Map<String, dynamic> data;
  final int? existingId;
  const SaveJournalEntry(this.projectId, this.data, {this.existingId});
  @override List<Object?> get props => [projectId];
}

class SubmitJournal extends Phase2Event {
  final int projectId;
  final int journalId;
  const SubmitJournal(this.projectId, this.journalId);
  @override List<Object?> get props => [projectId, journalId];
}

class LockJournal extends Phase2Event {
  final int projectId;
  final int journalId;
  const LockJournal(this.projectId, this.journalId);
  @override List<Object?> get props => [projectId, journalId];
}

class ReopenJournal extends Phase2Event {
  final int projectId;
  final int journalId;
  const ReopenJournal(this.projectId, this.journalId);
  @override List<Object?> get props => [projectId, journalId];
}

class UploadJournalPhotos extends Phase2Event {
  final int projectId;
  final int journalId;
  final List<String> filePaths;
  const UploadJournalPhotos(this.projectId, this.journalId, this.filePaths);
  @override List<Object?> get props => [projectId, journalId];
}

// ── States ────────────────────────────────────────────────────────────────────

abstract class Phase2State extends Equatable {
  const Phase2State();
  @override List<Object?> get props => [];
}

class Phase2Initial extends Phase2State { const Phase2Initial(); }
class Phase2Loading extends Phase2State { const Phase2Loading(); }

class SummaryLoaded extends Phase2State {
  final PlanningActionSummary summary;
  const SummaryLoaded(this.summary);
  @override List<Object?> get props => [summary];
}
class Phase2Error extends Phase2State {
  final String message;
  const Phase2Error(this.message);
  @override List<Object?> get props => [message];
}
class Phase2ActionSuccess extends Phase2State {
  final String message;
  const Phase2ActionSuccess(this.message);
  @override List<Object?> get props => [message];
}

class TasksLoaded extends Phase2State {
  final List<ProjectTask> tasks;
  final int projectId;
  final bool myOnly;
  const TasksLoaded({required this.tasks, required this.projectId, this.myOnly = false});
  @override List<Object?> get props => [tasks, projectId, myOnly];
}

class FollowupsLoaded extends Phase2State {
  final List<FollowUpAction> followups;
  final int projectId;
  final bool myOnly;
  const FollowupsLoaded({required this.followups, required this.projectId, this.myOnly = false});
  @override List<Object?> get props => [followups, projectId, myOnly];
}

class JournalLoaded extends Phase2State {
  final List<SiteJournalEntry> entries;
  final SiteJournalEntry? todayEntry;
  final int projectId;
  const JournalLoaded({required this.entries, required this.projectId, this.todayEntry});
  @override List<Object?> get props => [entries, projectId, todayEntry];
}

// ── Bloc ──────────────────────────────────────────────────────────────────────

class PlanningPhase2Bloc extends Bloc<Phase2Event, Phase2State> {
  final SetuApiClient _apiClient;
  bool _tasksMyOnly = false;
  String? _taskStatusFilter;
  bool _followupsMyOnly = false;

  PlanningPhase2Bloc({required SetuApiClient apiClient})
      : _apiClient = apiClient,
        super(const Phase2Initial()) {
    on<LoadSummary>(_onLoadSummary);
    // Tasks
    on<LoadTasks>(_onLoadTasks);
    on<CreateTask>(_onCreateTask);
    on<UpdateTaskStatus>(_onUpdateTaskStatus);
    on<CompleteTask>(_onCompleteTask);
    on<ReopenTask>(_onReopenTask);
    on<DeleteTask>(_onDeleteTask);
    // Followups
    on<LoadFollowups>(_onLoadFollowups);
    on<CreateFollowup>(_onCreateFollowup);
    on<CloseFollowup>(_onCloseFollowup);
    on<ReopenFollowup>(_onReopenFollowup);
    on<SnoozeFollowup>(_onSnoozeFollowup);
    on<ConvertFollowupToTask>(_onConvertFollowupToTask);
    on<DeleteFollowup>(_onDeleteFollowup);
    // Journal
    on<LoadJournal>(_onLoadJournal);
    on<SaveJournalEntry>(_onSaveJournalEntry);
    on<SubmitJournal>(_onSubmitJournal);
    on<LockJournal>(_onLockJournal);
    on<ReopenJournal>(_onReopenJournal);
    on<UploadJournalPhotos>(_onUploadJournalPhotos);
  }

  Future<void> _onLoadSummary(LoadSummary event, Emitter<Phase2State> emit) async {
    try {
      final raw = await _apiClient.getPlanningActionSummary(event.projectId);
      emit(SummaryLoaded(PlanningActionSummary.fromJson(raw)));
    } catch (_) {
      emit(const SummaryLoaded(PlanningActionSummary()));
    }
  }

  Future<void> _onLoadTasks(LoadTasks event, Emitter<Phase2State> emit) async {
    _tasksMyOnly = event.myTasksOnly;
    _taskStatusFilter = event.statusFilter;
    emit(const Phase2Loading());
    try {
      final raw = event.myTasksOnly
          ? await _apiClient.getTasks(event.projectId, subPath: 'my')
          : await _apiClient.getTasks(
              event.projectId,
              subPath: event.statusFilter != null ? _statusToSubPath(event.statusFilter!) : null,
            );
      final tasks = raw.map((e) => ProjectTask.fromJson(e as Map<String, dynamic>)).toList();
      emit(TasksLoaded(tasks: tasks, projectId: event.projectId, myOnly: event.myTasksOnly));
    } catch (e) {
      emit(Phase2Error('Failed to load tasks: $e'));
    }
  }

  Future<void> _onCreateTask(CreateTask event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.createTask(event.projectId, event.data);
      emit(const Phase2ActionSuccess('Task created'));
      add(LoadTasks(event.projectId, myTasksOnly: _tasksMyOnly, statusFilter: _taskStatusFilter));
    } catch (e) {
      emit(Phase2Error('Failed to create task: $e'));
    }
  }

  Future<void> _onUpdateTaskStatus(UpdateTaskStatus event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.updateTaskStatus(event.projectId, event.taskId, event.status);
      emit(const Phase2ActionSuccess('Status updated'));
      add(LoadTasks(event.projectId, myTasksOnly: _tasksMyOnly, statusFilter: _taskStatusFilter));
    } catch (e) {
      emit(Phase2Error('Failed to update task: $e'));
    }
  }

  Future<void> _onDeleteTask(DeleteTask event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.deleteTask(event.projectId, event.taskId);
      emit(const Phase2ActionSuccess('Task deleted'));
      add(LoadTasks(event.projectId, myTasksOnly: _tasksMyOnly));
    } catch (e) {
      emit(Phase2Error('Failed to delete task: $e'));
    }
  }

  static String? _statusToSubPath(String status) => switch (status) {
    'ACTIVE' => 'active',
    'COMPLETED' => 'completed',
    'HISTORY' => 'history',
    _ => null,
  };

  Future<void> _onLoadFollowups(LoadFollowups event, Emitter<Phase2State> emit) async {
    _followupsMyOnly = event.myOnly;
    emit(const Phase2Loading());
    try {
      final raw = await _apiClient.getFollowups(
        event.projectId,
        subPath: event.myOnly ? 'my' : null,
      );
      final followups = raw.map((e) => FollowUpAction.fromJson(e as Map<String, dynamic>)).toList();
      emit(FollowupsLoaded(followups: followups, projectId: event.projectId, myOnly: event.myOnly));
    } catch (e) {
      emit(Phase2Error('Failed to load follow-ups: $e'));
    }
  }

  Future<void> _onCreateFollowup(CreateFollowup event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.createFollowup(event.projectId, event.data);
      emit(const Phase2ActionSuccess('Follow-up created'));
      add(LoadFollowups(event.projectId, myOnly: _followupsMyOnly));
    } catch (e) {
      emit(Phase2Error('Failed to create follow-up: $e'));
    }
  }

  Future<void> _onCloseFollowup(CloseFollowup event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.closeFollowup(event.projectId, event.followupId, remarks: event.remarks);
      emit(const Phase2ActionSuccess('Follow-up closed'));
      add(LoadFollowups(event.projectId, myOnly: _followupsMyOnly));
    } catch (e) {
      emit(Phase2Error('Failed to close follow-up: $e'));
    }
  }

  Future<void> _onDeleteFollowup(DeleteFollowup event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.deleteFollowup(event.projectId, event.followupId);
      emit(const Phase2ActionSuccess('Follow-up deleted'));
      add(LoadFollowups(event.projectId, myOnly: _followupsMyOnly));
    } catch (e) {
      emit(Phase2Error('Failed to delete follow-up: $e'));
    }
  }

  Future<void> _onLoadJournal(LoadJournal event, Emitter<Phase2State> emit) async {
    emit(const Phase2Loading());
    try {
      final results = await Future.wait([
        _apiClient.getJournalEntries(event.projectId),
        _apiClient.getTodayJournal(event.projectId),
      ]);
      final entries = (results[0] as List<dynamic>)
          .map((e) => SiteJournalEntry.fromJson(e as Map<String, dynamic>))
          .toList();
      final today = results[1] != null
          ? SiteJournalEntry.fromJson(results[1] as Map<String, dynamic>)
          : null;
      emit(JournalLoaded(entries: entries, projectId: event.projectId, todayEntry: today));
    } catch (e) {
      emit(Phase2Error('Failed to load journal: $e'));
    }
  }

  Future<void> _onSaveJournalEntry(SaveJournalEntry event, Emitter<Phase2State> emit) async {
    try {
      if (event.existingId != null) {
        await _apiClient.updateJournalEntry(event.projectId, event.existingId!, event.data);
      } else {
        await _apiClient.upsertJournalEntry(event.projectId, event.data);
      }
      await _apiClient.clearCache();
      emit(const Phase2ActionSuccess('Journal saved'));
      add(LoadJournal(event.projectId));
    } catch (e) {
      emit(Phase2Error('Failed to save journal: $e'));
    }
  }

  // ── Task lifecycle ──────────────────────────────────────────────────────────

  Future<void> _onCompleteTask(CompleteTask event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.completeTask(event.projectId, event.taskId);
      emit(const Phase2ActionSuccess('Task completed'));
      add(LoadTasks(event.projectId, myTasksOnly: _tasksMyOnly, statusFilter: _taskStatusFilter));
    } catch (e) {
      emit(Phase2Error('Failed to complete task: $e'));
    }
  }

  Future<void> _onReopenTask(ReopenTask event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.reopenTask(event.projectId, event.taskId);
      emit(const Phase2ActionSuccess('Task reopened'));
      add(LoadTasks(event.projectId, myTasksOnly: _tasksMyOnly, statusFilter: _taskStatusFilter));
    } catch (e) {
      emit(Phase2Error('Failed to reopen task: $e'));
    }
  }

  // ── Follow-up lifecycle ─────────────────────────────────────────────────────

  Future<void> _onReopenFollowup(ReopenFollowup event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.reopenFollowup(event.projectId, event.followupId);
      emit(const Phase2ActionSuccess('Follow-up reopened'));
      add(LoadFollowups(event.projectId, myOnly: _followupsMyOnly));
    } catch (e) {
      emit(Phase2Error('Failed to reopen follow-up: $e'));
    }
  }

  Future<void> _onSnoozeFollowup(SnoozeFollowup event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.snoozeFollowup(event.projectId, event.followupId,
          dueDate: event.dueDate, reminderAt: event.reminderAt);
      emit(const Phase2ActionSuccess('Follow-up snoozed'));
      add(LoadFollowups(event.projectId, myOnly: _followupsMyOnly));
    } catch (e) {
      emit(Phase2Error('Failed to snooze follow-up: $e'));
    }
  }

  Future<void> _onConvertFollowupToTask(ConvertFollowupToTask event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.convertFollowupToTask(event.projectId, event.followupId);
      emit(const Phase2ActionSuccess('Follow-up converted to task'));
      add(LoadFollowups(event.projectId, myOnly: _followupsMyOnly));
    } catch (e) {
      emit(Phase2Error('Failed to convert follow-up: $e'));
    }
  }

  // ── Journal lifecycle ───────────────────────────────────────────────────────

  Future<void> _onSubmitJournal(SubmitJournal event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.submitJournalEntry(event.projectId, event.journalId);
      await _apiClient.clearCache();
      emit(const Phase2ActionSuccess('Journal submitted'));
      add(LoadJournal(event.projectId));
    } catch (e) {
      emit(Phase2Error('Failed to submit journal: $e'));
    }
  }

  Future<void> _onLockJournal(LockJournal event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.lockJournalEntry(event.projectId, event.journalId);
      await _apiClient.clearCache();
      emit(const Phase2ActionSuccess('Journal locked'));
      add(LoadJournal(event.projectId));
    } catch (e) {
      emit(Phase2Error('Failed to lock journal: $e'));
    }
  }

  Future<void> _onReopenJournal(ReopenJournal event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.reopenJournalEntry(event.projectId, event.journalId);
      await _apiClient.clearCache();
      emit(const Phase2ActionSuccess('Journal reopened for editing'));
      add(LoadJournal(event.projectId));
    } catch (e) {
      emit(Phase2Error('Failed to reopen journal: $e'));
    }
  }

  Future<void> _onUploadJournalPhotos(UploadJournalPhotos event, Emitter<Phase2State> emit) async {
    try {
      await _apiClient.uploadJournalPhotos(event.projectId, event.journalId, event.filePaths);
      await _apiClient.clearCache();
      emit(const Phase2ActionSuccess('Photos uploaded'));
      add(LoadJournal(event.projectId));
    } catch (e) {
      emit(Phase2Error('Failed to upload photos: $e'));
    }
  }
}
