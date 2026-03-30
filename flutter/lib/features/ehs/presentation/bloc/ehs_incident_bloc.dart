import 'dart:convert';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/sync/background_download_service.dart';
import 'package:setu_mobile/features/ehs/data/models/ehs_models.dart';

// ═══════════════════════════════════════════ EVENTS ══════════════════════════

/// Base class for all EHS incident events.
abstract class EhsIncidentEvent extends Equatable {
  const EhsIncidentEvent();
  @override
  List<Object?> get props => [];
}

/// Load the incident list for a project (initial load).
class LoadEhsIncidents extends EhsIncidentEvent {
  final int projectId;
  const LoadEhsIncidents(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// Pull-to-refresh — same as Load but shows a shimmer over the existing list.
class RefreshEhsIncidents extends EhsIncidentEvent {
  final int projectId;
  const RefreshEhsIncidents(this.projectId);
  @override
  List<Object?> get props => [projectId];
}

/// Report a new EHS incident.
///
/// [incidentType] maps to one of the backend enum values via [IncidentType.apiValue].
/// [affectedPersons] is a list of names or IDs (optional).
/// [daysLost] is only relevant for LTI (Lost Time Injury) incidents.
class CreateEhsIncident extends EhsIncidentEvent {
  final int projectId;
  final String incidentDate;
  final IncidentType incidentType;
  final String location;
  final String description;
  final String immediateCause;
  final List<String> affectedPersons;
  final bool firstAidGiven;
  final bool hospitalVisit;
  final int daysLost;

  const CreateEhsIncident({
    required this.projectId,
    required this.incidentDate,
    required this.incidentType,
    required this.location,
    required this.description,
    required this.immediateCause,
    this.affectedPersons = const [],
    this.firstAidGiven = false,
    this.hospitalVisit = false,
    this.daysLost = 0,
  });

  @override
  List<Object?> get props => [projectId, incidentDate, incidentType];
}

// ═══════════════════════════════════════════ STATES ══════════════════════════

/// Base class for all EHS incident states.
abstract class EhsIncidentState extends Equatable {
  const EhsIncidentState();
  @override
  List<Object?> get props => [];
}

class EhsIncidentInitial extends EhsIncidentState {}

/// Loading indicator.
/// [isRefresh] = true → shimmer over existing list.
/// [isRefresh] = false → full-screen spinner.
class EhsIncidentLoading extends EhsIncidentState {
  final bool isRefresh;
  const EhsIncidentLoading({this.isRefresh = false});
}

/// The incident list has been loaded.
/// [fromCache] is true when data came from the local SharedPreferences cache
/// rather than a live server response — the UI shows an offline indicator.
class EhsIncidentLoaded extends EhsIncidentState {
  final List<EhsIncident> incidents;
  final bool fromCache;
  const EhsIncidentLoaded(this.incidents, {this.fromCache = false});
  @override
  List<Object?> get props => [incidents, fromCache];
}

/// An error occurred while loading incidents.
class EhsIncidentError extends EhsIncidentState {
  final String message;
  const EhsIncidentError(this.message);
  @override
  List<Object?> get props => [message];
}

/// A new incident was reported successfully.
class EhsIncidentActionSuccess extends EhsIncidentState {
  final String message;
  const EhsIncidentActionSuccess(this.message);
  @override
  List<Object?> get props => [message];
}

/// Reporting a new incident failed.
class EhsIncidentActionError extends EhsIncidentState {
  final String message;
  const EhsIncidentActionError(this.message);
  @override
  List<Object?> get props => [message];
}

// ═══════════════════════════════════════════ BLOC ════════════════════════════

/// Manages EHS (Environment, Health & Safety) incident reporting.
///
/// Unlike site observations, incidents are NOT offline-first — they are submitted
/// directly to the server because incident records require immediate visibility
/// for site safety teams.
///
/// [IncidentType] values: nearMiss, FAC, MTC, LTI, propertyDamage, environmental.
class EhsIncidentBloc extends Bloc<EhsIncidentEvent, EhsIncidentState> {
  final SetuApiClient _api;

  EhsIncidentBloc({required SetuApiClient apiClient})
      : _api = apiClient,
        super(EhsIncidentInitial()) {
    on<LoadEhsIncidents>(_onLoad);
    on<RefreshEhsIncidents>(_onRefresh);
    on<CreateEhsIncident>(_onCreate);
  }

  /// Initial load — shows a full-screen spinner.
  Future<void> _onLoad(
    LoadEhsIncidents event,
    Emitter<EhsIncidentState> emit,
  ) async {
    emit(const EhsIncidentLoading());
    await _fetch(event.projectId, emit);
  }

  /// Pull-to-refresh — shows a shimmer over the existing list.
  Future<void> _onRefresh(
    RefreshEhsIncidents event,
    Emitter<EhsIncidentState> emit,
  ) async {
    emit(const EhsIncidentLoading(isRefresh: true));
    await _fetch(event.projectId, emit);
  }

  /// Shared fetch implementation called by both Load and Refresh handlers.
  ///
  /// On network failure, falls back to the SharedPreferences cache written by
  /// [BackgroundDownloadService._downloadEhsIncidents]. A [fromCache] flag on
  /// the loaded state tells the UI to show the offline indicator.
  Future<void> _fetch(
    int projectId,
    Emitter<EhsIncidentState> emit,
  ) async {
    try {
      final raw = await _api.getEhsIncidents(projectId);
      final incidents = raw
          .map((e) => EhsIncident.fromJson(e as Map<String, dynamic>))
          .toList();
      // Persist for next offline session.
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          BackgroundDownloadService.ehsIncidentsKey(projectId),
          jsonEncode(raw));
      emit(EhsIncidentLoaded(incidents));
    } catch (_) {
      // Network failed — try the cache written by BackgroundDownloadService.
      try {
        final prefs = await SharedPreferences.getInstance();
        final cached = prefs
            .getString(BackgroundDownloadService.ehsIncidentsKey(projectId));
        if (cached != null) {
          final list = jsonDecode(cached) as List<dynamic>;
          final incidents = list
              .map((e) => EhsIncident.fromJson(e as Map<String, dynamic>))
              .toList();
          emit(EhsIncidentLoaded(incidents, fromCache: true));
          return;
        }
      } catch (_) {
        // Cache read failed — fall through to error state.
      }
      emit(const EhsIncidentError(
          'No connection and no cached data. Connect to load incidents.'));
    }
  }

  /// Submits a new incident report to the server.
  ///
  /// The [IncidentType.apiValue] getter converts the Dart enum to the
  /// backend's string representation (e.g. IncidentType.lti → 'LTI').
  /// [affectedPersons] is omitted from the payload if the list is empty to
  /// avoid sending an unnecessary empty array to the server.
  Future<void> _onCreate(
    CreateEhsIncident event,
    Emitter<EhsIncidentState> emit,
  ) async {
    try {
      await _api.createEhsIncident(
        projectId: event.projectId,
        payload: {
          'projectId': event.projectId,
          'incidentDate': event.incidentDate,
          // Convert enum to the backend's expected string value.
          'incidentType': event.incidentType.apiValue,
          'location': event.location,
          'description': event.description,
          'immediateCause': event.immediateCause,
          // Only include if there are affected persons to report.
          if (event.affectedPersons.isNotEmpty)
            'affectedPersons': event.affectedPersons,
          'firstAidGiven': event.firstAidGiven,
          'hospitalVisit': event.hospitalVisit,
          'daysLost': event.daysLost,
        },
      );
      emit(const EhsIncidentActionSuccess('Incident reported successfully'));
    } catch (e) {
      emit(EhsIncidentActionError('Failed to report incident. $e'));
    }
  }
}
