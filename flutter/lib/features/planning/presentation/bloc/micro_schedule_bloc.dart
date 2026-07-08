import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/planning/data/models/micro_schedule_models.dart';

abstract class MicroScheduleEvent extends Equatable {
  const MicroScheduleEvent();
  @override List<Object?> get props => [];
}

class LoadMicroSchedules extends MicroScheduleEvent {
  final int projectId;
  const LoadMicroSchedules(this.projectId);
  @override List<Object?> get props => [projectId];
}

class LoadMicroActivities extends MicroScheduleEvent {
  final int microScheduleId;
  const LoadMicroActivities(this.microScheduleId);
  @override List<Object?> get props => [microScheduleId];
}

class LoadActivityLogs extends MicroScheduleEvent {
  final int microActivityId;
  const LoadActivityLogs(this.microActivityId);
  @override List<Object?> get props => [microActivityId];
}

class SubmitDailyLog extends MicroScheduleEvent {
  final Map<String, dynamic> data;
  const SubmitDailyLog(this.data);
  @override List<Object?> get props => [];
}

class UpdateDailyLog extends MicroScheduleEvent {
  final int logId;
  final Map<String, dynamic> data;
  const UpdateDailyLog(this.logId, this.data);
  @override List<Object?> get props => [logId];
}

abstract class MicroScheduleState extends Equatable {
  const MicroScheduleState();
  @override List<Object?> get props => [];
}

class MicroScheduleInitial extends MicroScheduleState { const MicroScheduleInitial(); }
class MicroScheduleLoading extends MicroScheduleState { const MicroScheduleLoading(); }

class MicroSchedulesLoaded extends MicroScheduleState {
  final List<MicroSchedule> schedules;
  final int projectId;
  const MicroSchedulesLoaded({required this.schedules, required this.projectId});
  @override List<Object?> get props => [schedules, projectId];
}

class MicroActivitiesLoaded extends MicroScheduleState {
  final MicroSchedule schedule;
  final List<MicroActivity> activities;
  const MicroActivitiesLoaded({required this.schedule, required this.activities});
  @override List<Object?> get props => [schedule, activities];
}

class ActivityLogsLoaded extends MicroScheduleState {
  final MicroActivity activity;
  final List<MicroDailyLog> logs;
  const ActivityLogsLoaded({required this.activity, required this.logs});
  @override List<Object?> get props => [activity, logs];
}

class MicroScheduleError extends MicroScheduleState {
  final String message;
  const MicroScheduleError(this.message);
  @override List<Object?> get props => [message];
}

class MicroScheduleActionSuccess extends MicroScheduleState {
  final String message;
  const MicroScheduleActionSuccess(this.message);
  @override List<Object?> get props => [message];
}

class MicroScheduleBloc extends Bloc<MicroScheduleEvent, MicroScheduleState> {
  final SetuApiClient _apiClient;
  int? _currentProjectId;
  MicroActivity? _currentActivity;

  MicroScheduleBloc({required SetuApiClient apiClient})
      : _apiClient = apiClient,
        super(const MicroScheduleInitial()) {
    on<LoadMicroSchedules>(_onLoadSchedules);
    on<LoadMicroActivities>(_onLoadActivities);
    on<LoadActivityLogs>(_onLoadLogs);
    on<SubmitDailyLog>(_onSubmitLog);
    on<UpdateDailyLog>(_onUpdateLog);
  }

  Future<void> _onLoadSchedules(LoadMicroSchedules event, Emitter<MicroScheduleState> emit) async {
    _currentProjectId = event.projectId;
    emit(const MicroScheduleLoading());
    try {
      final raw = await _apiClient.getMicroSchedulesByProject(event.projectId);
      final schedules = raw.map((e) => MicroSchedule.fromJson(e as Map<String, dynamic>)).toList();
      emit(MicroSchedulesLoaded(schedules: schedules, projectId: event.projectId));
    } catch (e) {
      emit(MicroScheduleError('Failed to load schedules: $e'));
    }
  }

  Future<void> _onLoadActivities(LoadMicroActivities event, Emitter<MicroScheduleState> emit) async {
    final currentState = state;
    MicroSchedule? schedule;
    if (currentState is MicroSchedulesLoaded) {
      try { schedule = currentState.schedules.firstWhere((s) => s.id == event.microScheduleId); } catch (_) {}
    }
    emit(const MicroScheduleLoading());
    try {
      final raw = await _apiClient.getMicroScheduleActivities(event.microScheduleId);
      final activities = raw.map((e) => MicroActivity.fromJson(e as Map<String, dynamic>)).toList();
      if (schedule != null) {
        emit(MicroActivitiesLoaded(schedule: schedule, activities: activities));
      } else {
        final placeholder = MicroSchedule(
          id: event.microScheduleId, projectId: _currentProjectId ?? 0,
          parentActivityId: 0, name: 'Schedule', status: MicroScheduleStatus.active,
        );
        emit(MicroActivitiesLoaded(schedule: placeholder, activities: activities));
      }
    } catch (e) {
      emit(MicroScheduleError('Failed to load activities: $e'));
    }
  }

  Future<void> _onLoadLogs(LoadActivityLogs event, Emitter<MicroScheduleState> emit) async {
    final currentState = state;
    MicroActivity? activity;
    if (currentState is MicroActivitiesLoaded) {
      try { activity = currentState.activities.firstWhere((a) => a.id == event.microActivityId); } catch (_) {}
    }
    emit(const MicroScheduleLoading());
    try {
      final raw = await _apiClient.getActivityLogs(event.microActivityId);
      final logs = raw.map((e) => MicroDailyLog.fromJson(e as Map<String, dynamic>)).toList();
      if (activity != null) {
        _currentActivity = activity;
        emit(ActivityLogsLoaded(activity: activity, logs: logs));
      }
    } catch (e) {
      emit(MicroScheduleError('Failed to load logs: $e'));
    }
  }

  Future<void> _onSubmitLog(SubmitDailyLog event, Emitter<MicroScheduleState> emit) async {
    try {
      await _apiClient.createDailyLog(event.data);
      emit(const MicroScheduleActionSuccess('Daily log saved'));
      if (_currentActivity != null) add(LoadActivityLogs(_currentActivity!.id));
    } catch (e) {
      emit(MicroScheduleError('Failed to save log: $e'));
    }
  }

  Future<void> _onUpdateLog(UpdateDailyLog event, Emitter<MicroScheduleState> emit) async {
    try {
      await _apiClient.updateDailyLog(logId: event.logId, updates: event.data);
      emit(const MicroScheduleActionSuccess('Log updated'));
      if (_currentActivity != null) add(LoadActivityLogs(_currentActivity!.id));
    } catch (e) {
      emit(MicroScheduleError('Failed to update log: $e'));
    }
  }
}
