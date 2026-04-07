// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $ProgressEntriesTable extends ProgressEntries
    with TableInfo<$ProgressEntriesTable, ProgressEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ProgressEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _serverIdMeta =
      const VerificationMeta('serverId');
  @override
  late final GeneratedColumn<int> serverId = GeneratedColumn<int>(
      'server_id', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _projectIdMeta =
      const VerificationMeta('projectId');
  @override
  late final GeneratedColumn<int> projectId = GeneratedColumn<int>(
      'project_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _activityIdMeta =
      const VerificationMeta('activityId');
  @override
  late final GeneratedColumn<int> activityId = GeneratedColumn<int>(
      'activity_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _epsNodeIdMeta =
      const VerificationMeta('epsNodeId');
  @override
  late final GeneratedColumn<int> epsNodeId = GeneratedColumn<int>(
      'eps_node_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _boqItemIdMeta =
      const VerificationMeta('boqItemId');
  @override
  late final GeneratedColumn<int> boqItemId = GeneratedColumn<int>(
      'boq_item_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _microActivityIdMeta =
      const VerificationMeta('microActivityId');
  @override
  late final GeneratedColumn<int> microActivityId = GeneratedColumn<int>(
      'micro_activity_id', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _quantityMeta =
      const VerificationMeta('quantity');
  @override
  late final GeneratedColumn<double> quantity = GeneratedColumn<double>(
      'quantity', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _dateMeta = const VerificationMeta('date');
  @override
  late final GeneratedColumn<String> date = GeneratedColumn<String>(
      'date', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _remarksMeta =
      const VerificationMeta('remarks');
  @override
  late final GeneratedColumn<String> remarks = GeneratedColumn<String>(
      'remarks', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _photoPathsMeta =
      const VerificationMeta('photoPaths');
  @override
  late final GeneratedColumn<String> photoPaths = GeneratedColumn<String>(
      'photo_paths', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _syncStatusMeta =
      const VerificationMeta('syncStatus');
  @override
  late final GeneratedColumn<int> syncStatus = GeneratedColumn<int>(
      'sync_status', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _syncedAtMeta =
      const VerificationMeta('syncedAt');
  @override
  late final GeneratedColumn<DateTime> syncedAt = GeneratedColumn<DateTime>(
      'synced_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _syncErrorMeta =
      const VerificationMeta('syncError');
  @override
  late final GeneratedColumn<String> syncError = GeneratedColumn<String>(
      'sync_error', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _retryCountMeta =
      const VerificationMeta('retryCount');
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
      'retry_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _idempotencyKeyMeta =
      const VerificationMeta('idempotencyKey');
  @override
  late final GeneratedColumn<String> idempotencyKey = GeneratedColumn<String>(
      'idempotency_key', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _serverUpdatedAtMeta =
      const VerificationMeta('serverUpdatedAt');
  @override
  late final GeneratedColumn<DateTime> serverUpdatedAt =
      GeneratedColumn<DateTime>('server_updated_at', aliasedName, true,
          type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _localUpdatedAtMeta =
      const VerificationMeta('localUpdatedAt');
  @override
  late final GeneratedColumn<DateTime> localUpdatedAt =
      GeneratedColumn<DateTime>('local_updated_at', aliasedName, false,
          type: DriftSqlType.dateTime,
          requiredDuringInsert: false,
          defaultValue: currentDateAndTime);
  static const VerificationMeta _isDeletedMeta =
      const VerificationMeta('isDeleted');
  @override
  late final GeneratedColumn<int> isDeleted = GeneratedColumn<int>(
      'is_deleted', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  @override
  List<GeneratedColumn> get $columns => [
        id,
        serverId,
        projectId,
        activityId,
        epsNodeId,
        boqItemId,
        microActivityId,
        quantity,
        date,
        remarks,
        photoPaths,
        syncStatus,
        createdAt,
        syncedAt,
        syncError,
        retryCount,
        idempotencyKey,
        serverUpdatedAt,
        localUpdatedAt,
        isDeleted
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'progress_entries';
  @override
  VerificationContext validateIntegrity(Insertable<ProgressEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('server_id')) {
      context.handle(_serverIdMeta,
          serverId.isAcceptableOrUnknown(data['server_id']!, _serverIdMeta));
    }
    if (data.containsKey('project_id')) {
      context.handle(_projectIdMeta,
          projectId.isAcceptableOrUnknown(data['project_id']!, _projectIdMeta));
    } else if (isInserting) {
      context.missing(_projectIdMeta);
    }
    if (data.containsKey('activity_id')) {
      context.handle(
          _activityIdMeta,
          activityId.isAcceptableOrUnknown(
              data['activity_id']!, _activityIdMeta));
    } else if (isInserting) {
      context.missing(_activityIdMeta);
    }
    if (data.containsKey('eps_node_id')) {
      context.handle(
          _epsNodeIdMeta,
          epsNodeId.isAcceptableOrUnknown(
              data['eps_node_id']!, _epsNodeIdMeta));
    } else if (isInserting) {
      context.missing(_epsNodeIdMeta);
    }
    if (data.containsKey('boq_item_id')) {
      context.handle(
          _boqItemIdMeta,
          boqItemId.isAcceptableOrUnknown(
              data['boq_item_id']!, _boqItemIdMeta));
    } else if (isInserting) {
      context.missing(_boqItemIdMeta);
    }
    if (data.containsKey('micro_activity_id')) {
      context.handle(
          _microActivityIdMeta,
          microActivityId.isAcceptableOrUnknown(
              data['micro_activity_id']!, _microActivityIdMeta));
    }
    if (data.containsKey('quantity')) {
      context.handle(_quantityMeta,
          quantity.isAcceptableOrUnknown(data['quantity']!, _quantityMeta));
    } else if (isInserting) {
      context.missing(_quantityMeta);
    }
    if (data.containsKey('date')) {
      context.handle(
          _dateMeta, date.isAcceptableOrUnknown(data['date']!, _dateMeta));
    } else if (isInserting) {
      context.missing(_dateMeta);
    }
    if (data.containsKey('remarks')) {
      context.handle(_remarksMeta,
          remarks.isAcceptableOrUnknown(data['remarks']!, _remarksMeta));
    }
    if (data.containsKey('photo_paths')) {
      context.handle(
          _photoPathsMeta,
          photoPaths.isAcceptableOrUnknown(
              data['photo_paths']!, _photoPathsMeta));
    }
    if (data.containsKey('sync_status')) {
      context.handle(
          _syncStatusMeta,
          syncStatus.isAcceptableOrUnknown(
              data['sync_status']!, _syncStatusMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    if (data.containsKey('synced_at')) {
      context.handle(_syncedAtMeta,
          syncedAt.isAcceptableOrUnknown(data['synced_at']!, _syncedAtMeta));
    }
    if (data.containsKey('sync_error')) {
      context.handle(_syncErrorMeta,
          syncError.isAcceptableOrUnknown(data['sync_error']!, _syncErrorMeta));
    }
    if (data.containsKey('retry_count')) {
      context.handle(
          _retryCountMeta,
          retryCount.isAcceptableOrUnknown(
              data['retry_count']!, _retryCountMeta));
    }
    if (data.containsKey('idempotency_key')) {
      context.handle(
          _idempotencyKeyMeta,
          idempotencyKey.isAcceptableOrUnknown(
              data['idempotency_key']!, _idempotencyKeyMeta));
    }
    if (data.containsKey('server_updated_at')) {
      context.handle(
          _serverUpdatedAtMeta,
          serverUpdatedAt.isAcceptableOrUnknown(
              data['server_updated_at']!, _serverUpdatedAtMeta));
    }
    if (data.containsKey('local_updated_at')) {
      context.handle(
          _localUpdatedAtMeta,
          localUpdatedAt.isAcceptableOrUnknown(
              data['local_updated_at']!, _localUpdatedAtMeta));
    }
    if (data.containsKey('is_deleted')) {
      context.handle(_isDeletedMeta,
          isDeleted.isAcceptableOrUnknown(data['is_deleted']!, _isDeletedMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ProgressEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ProgressEntry(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      serverId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}server_id']),
      projectId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}project_id'])!,
      activityId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}activity_id'])!,
      epsNodeId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}eps_node_id'])!,
      boqItemId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}boq_item_id'])!,
      microActivityId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}micro_activity_id']),
      quantity: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}quantity'])!,
      date: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}date'])!,
      remarks: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}remarks']),
      photoPaths: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}photo_paths']),
      syncStatus: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}sync_status'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      syncedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}synced_at']),
      syncError: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}sync_error']),
      retryCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}retry_count'])!,
      idempotencyKey: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}idempotency_key']),
      serverUpdatedAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}server_updated_at']),
      localUpdatedAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}local_updated_at'])!,
      isDeleted: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}is_deleted'])!,
    );
  }

  @override
  $ProgressEntriesTable createAlias(String alias) {
    return $ProgressEntriesTable(attachedDatabase, alias);
  }
}

class ProgressEntry extends DataClass implements Insertable<ProgressEntry> {
  final int id;

  /// Server-assigned ID returned after a successful sync; null until synced.
  final int? serverId;
  final int projectId;
  final int activityId;
  final int epsNodeId;
  final int boqItemId;

  /// Reused to carry the execution plan ID (planId) when submitting to the
  /// measurements endpoint. Named microActivityId for historical reasons.
  final int? microActivityId;
  final double quantity;
  final String date;
  final String? remarks;
  final String? photoPaths;
  final int syncStatus;
  final DateTime createdAt;
  final DateTime? syncedAt;
  final String? syncError;
  final int retryCount;
  final String? idempotencyKey;

  /// Server's last-modified timestamp — used for delta sync conflict detection.
  final DateTime? serverUpdatedAt;

  /// Client's last-modified timestamp — set on every local create or update.
  final DateTime localUpdatedAt;

  /// Soft-delete flag. 1 = deleted locally, row not yet purged.
  final int isDeleted;
  const ProgressEntry(
      {required this.id,
      this.serverId,
      required this.projectId,
      required this.activityId,
      required this.epsNodeId,
      required this.boqItemId,
      this.microActivityId,
      required this.quantity,
      required this.date,
      this.remarks,
      this.photoPaths,
      required this.syncStatus,
      required this.createdAt,
      this.syncedAt,
      this.syncError,
      required this.retryCount,
      this.idempotencyKey,
      this.serverUpdatedAt,
      required this.localUpdatedAt,
      required this.isDeleted});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    if (!nullToAbsent || serverId != null) {
      map['server_id'] = Variable<int>(serverId);
    }
    map['project_id'] = Variable<int>(projectId);
    map['activity_id'] = Variable<int>(activityId);
    map['eps_node_id'] = Variable<int>(epsNodeId);
    map['boq_item_id'] = Variable<int>(boqItemId);
    if (!nullToAbsent || microActivityId != null) {
      map['micro_activity_id'] = Variable<int>(microActivityId);
    }
    map['quantity'] = Variable<double>(quantity);
    map['date'] = Variable<String>(date);
    if (!nullToAbsent || remarks != null) {
      map['remarks'] = Variable<String>(remarks);
    }
    if (!nullToAbsent || photoPaths != null) {
      map['photo_paths'] = Variable<String>(photoPaths);
    }
    map['sync_status'] = Variable<int>(syncStatus);
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || syncedAt != null) {
      map['synced_at'] = Variable<DateTime>(syncedAt);
    }
    if (!nullToAbsent || syncError != null) {
      map['sync_error'] = Variable<String>(syncError);
    }
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || idempotencyKey != null) {
      map['idempotency_key'] = Variable<String>(idempotencyKey);
    }
    if (!nullToAbsent || serverUpdatedAt != null) {
      map['server_updated_at'] = Variable<DateTime>(serverUpdatedAt);
    }
    map['local_updated_at'] = Variable<DateTime>(localUpdatedAt);
    map['is_deleted'] = Variable<int>(isDeleted);
    return map;
  }

  ProgressEntriesCompanion toCompanion(bool nullToAbsent) {
    return ProgressEntriesCompanion(
      id: Value(id),
      serverId: serverId == null && nullToAbsent
          ? const Value.absent()
          : Value(serverId),
      projectId: Value(projectId),
      activityId: Value(activityId),
      epsNodeId: Value(epsNodeId),
      boqItemId: Value(boqItemId),
      microActivityId: microActivityId == null && nullToAbsent
          ? const Value.absent()
          : Value(microActivityId),
      quantity: Value(quantity),
      date: Value(date),
      remarks: remarks == null && nullToAbsent
          ? const Value.absent()
          : Value(remarks),
      photoPaths: photoPaths == null && nullToAbsent
          ? const Value.absent()
          : Value(photoPaths),
      syncStatus: Value(syncStatus),
      createdAt: Value(createdAt),
      syncedAt: syncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(syncedAt),
      syncError: syncError == null && nullToAbsent
          ? const Value.absent()
          : Value(syncError),
      retryCount: Value(retryCount),
      idempotencyKey: idempotencyKey == null && nullToAbsent
          ? const Value.absent()
          : Value(idempotencyKey),
      serverUpdatedAt: serverUpdatedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(serverUpdatedAt),
      localUpdatedAt: Value(localUpdatedAt),
      isDeleted: Value(isDeleted),
    );
  }

  factory ProgressEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ProgressEntry(
      id: serializer.fromJson<int>(json['id']),
      serverId: serializer.fromJson<int?>(json['serverId']),
      projectId: serializer.fromJson<int>(json['projectId']),
      activityId: serializer.fromJson<int>(json['activityId']),
      epsNodeId: serializer.fromJson<int>(json['epsNodeId']),
      boqItemId: serializer.fromJson<int>(json['boqItemId']),
      microActivityId: serializer.fromJson<int?>(json['microActivityId']),
      quantity: serializer.fromJson<double>(json['quantity']),
      date: serializer.fromJson<String>(json['date']),
      remarks: serializer.fromJson<String?>(json['remarks']),
      photoPaths: serializer.fromJson<String?>(json['photoPaths']),
      syncStatus: serializer.fromJson<int>(json['syncStatus']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      syncedAt: serializer.fromJson<DateTime?>(json['syncedAt']),
      syncError: serializer.fromJson<String?>(json['syncError']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      idempotencyKey: serializer.fromJson<String?>(json['idempotencyKey']),
      serverUpdatedAt: serializer.fromJson<DateTime?>(json['serverUpdatedAt']),
      localUpdatedAt: serializer.fromJson<DateTime>(json['localUpdatedAt']),
      isDeleted: serializer.fromJson<int>(json['isDeleted']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'serverId': serializer.toJson<int?>(serverId),
      'projectId': serializer.toJson<int>(projectId),
      'activityId': serializer.toJson<int>(activityId),
      'epsNodeId': serializer.toJson<int>(epsNodeId),
      'boqItemId': serializer.toJson<int>(boqItemId),
      'microActivityId': serializer.toJson<int?>(microActivityId),
      'quantity': serializer.toJson<double>(quantity),
      'date': serializer.toJson<String>(date),
      'remarks': serializer.toJson<String?>(remarks),
      'photoPaths': serializer.toJson<String?>(photoPaths),
      'syncStatus': serializer.toJson<int>(syncStatus),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'syncedAt': serializer.toJson<DateTime?>(syncedAt),
      'syncError': serializer.toJson<String?>(syncError),
      'retryCount': serializer.toJson<int>(retryCount),
      'idempotencyKey': serializer.toJson<String?>(idempotencyKey),
      'serverUpdatedAt': serializer.toJson<DateTime?>(serverUpdatedAt),
      'localUpdatedAt': serializer.toJson<DateTime>(localUpdatedAt),
      'isDeleted': serializer.toJson<int>(isDeleted),
    };
  }

  ProgressEntry copyWith(
          {int? id,
          Value<int?> serverId = const Value.absent(),
          int? projectId,
          int? activityId,
          int? epsNodeId,
          int? boqItemId,
          Value<int?> microActivityId = const Value.absent(),
          double? quantity,
          String? date,
          Value<String?> remarks = const Value.absent(),
          Value<String?> photoPaths = const Value.absent(),
          int? syncStatus,
          DateTime? createdAt,
          Value<DateTime?> syncedAt = const Value.absent(),
          Value<String?> syncError = const Value.absent(),
          int? retryCount,
          Value<String?> idempotencyKey = const Value.absent(),
          Value<DateTime?> serverUpdatedAt = const Value.absent(),
          DateTime? localUpdatedAt,
          int? isDeleted}) =>
      ProgressEntry(
        id: id ?? this.id,
        serverId: serverId.present ? serverId.value : this.serverId,
        projectId: projectId ?? this.projectId,
        activityId: activityId ?? this.activityId,
        epsNodeId: epsNodeId ?? this.epsNodeId,
        boqItemId: boqItemId ?? this.boqItemId,
        microActivityId: microActivityId.present
            ? microActivityId.value
            : this.microActivityId,
        quantity: quantity ?? this.quantity,
        date: date ?? this.date,
        remarks: remarks.present ? remarks.value : this.remarks,
        photoPaths: photoPaths.present ? photoPaths.value : this.photoPaths,
        syncStatus: syncStatus ?? this.syncStatus,
        createdAt: createdAt ?? this.createdAt,
        syncedAt: syncedAt.present ? syncedAt.value : this.syncedAt,
        syncError: syncError.present ? syncError.value : this.syncError,
        retryCount: retryCount ?? this.retryCount,
        idempotencyKey:
            idempotencyKey.present ? idempotencyKey.value : this.idempotencyKey,
        serverUpdatedAt: serverUpdatedAt.present
            ? serverUpdatedAt.value
            : this.serverUpdatedAt,
        localUpdatedAt: localUpdatedAt ?? this.localUpdatedAt,
        isDeleted: isDeleted ?? this.isDeleted,
      );
  ProgressEntry copyWithCompanion(ProgressEntriesCompanion data) {
    return ProgressEntry(
      id: data.id.present ? data.id.value : this.id,
      serverId: data.serverId.present ? data.serverId.value : this.serverId,
      projectId: data.projectId.present ? data.projectId.value : this.projectId,
      activityId:
          data.activityId.present ? data.activityId.value : this.activityId,
      epsNodeId: data.epsNodeId.present ? data.epsNodeId.value : this.epsNodeId,
      boqItemId: data.boqItemId.present ? data.boqItemId.value : this.boqItemId,
      microActivityId: data.microActivityId.present
          ? data.microActivityId.value
          : this.microActivityId,
      quantity: data.quantity.present ? data.quantity.value : this.quantity,
      date: data.date.present ? data.date.value : this.date,
      remarks: data.remarks.present ? data.remarks.value : this.remarks,
      photoPaths:
          data.photoPaths.present ? data.photoPaths.value : this.photoPaths,
      syncStatus:
          data.syncStatus.present ? data.syncStatus.value : this.syncStatus,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      syncedAt: data.syncedAt.present ? data.syncedAt.value : this.syncedAt,
      syncError: data.syncError.present ? data.syncError.value : this.syncError,
      retryCount:
          data.retryCount.present ? data.retryCount.value : this.retryCount,
      idempotencyKey: data.idempotencyKey.present
          ? data.idempotencyKey.value
          : this.idempotencyKey,
      serverUpdatedAt: data.serverUpdatedAt.present
          ? data.serverUpdatedAt.value
          : this.serverUpdatedAt,
      localUpdatedAt: data.localUpdatedAt.present
          ? data.localUpdatedAt.value
          : this.localUpdatedAt,
      isDeleted: data.isDeleted.present ? data.isDeleted.value : this.isDeleted,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ProgressEntry(')
          ..write('id: $id, ')
          ..write('serverId: $serverId, ')
          ..write('projectId: $projectId, ')
          ..write('activityId: $activityId, ')
          ..write('epsNodeId: $epsNodeId, ')
          ..write('boqItemId: $boqItemId, ')
          ..write('microActivityId: $microActivityId, ')
          ..write('quantity: $quantity, ')
          ..write('date: $date, ')
          ..write('remarks: $remarks, ')
          ..write('photoPaths: $photoPaths, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('syncError: $syncError, ')
          ..write('retryCount: $retryCount, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('serverUpdatedAt: $serverUpdatedAt, ')
          ..write('localUpdatedAt: $localUpdatedAt, ')
          ..write('isDeleted: $isDeleted')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      serverId,
      projectId,
      activityId,
      epsNodeId,
      boqItemId,
      microActivityId,
      quantity,
      date,
      remarks,
      photoPaths,
      syncStatus,
      createdAt,
      syncedAt,
      syncError,
      retryCount,
      idempotencyKey,
      serverUpdatedAt,
      localUpdatedAt,
      isDeleted);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ProgressEntry &&
          other.id == this.id &&
          other.serverId == this.serverId &&
          other.projectId == this.projectId &&
          other.activityId == this.activityId &&
          other.epsNodeId == this.epsNodeId &&
          other.boqItemId == this.boqItemId &&
          other.microActivityId == this.microActivityId &&
          other.quantity == this.quantity &&
          other.date == this.date &&
          other.remarks == this.remarks &&
          other.photoPaths == this.photoPaths &&
          other.syncStatus == this.syncStatus &&
          other.createdAt == this.createdAt &&
          other.syncedAt == this.syncedAt &&
          other.syncError == this.syncError &&
          other.retryCount == this.retryCount &&
          other.idempotencyKey == this.idempotencyKey &&
          other.serverUpdatedAt == this.serverUpdatedAt &&
          other.localUpdatedAt == this.localUpdatedAt &&
          other.isDeleted == this.isDeleted);
}

class ProgressEntriesCompanion extends UpdateCompanion<ProgressEntry> {
  final Value<int> id;
  final Value<int?> serverId;
  final Value<int> projectId;
  final Value<int> activityId;
  final Value<int> epsNodeId;
  final Value<int> boqItemId;
  final Value<int?> microActivityId;
  final Value<double> quantity;
  final Value<String> date;
  final Value<String?> remarks;
  final Value<String?> photoPaths;
  final Value<int> syncStatus;
  final Value<DateTime> createdAt;
  final Value<DateTime?> syncedAt;
  final Value<String?> syncError;
  final Value<int> retryCount;
  final Value<String?> idempotencyKey;
  final Value<DateTime?> serverUpdatedAt;
  final Value<DateTime> localUpdatedAt;
  final Value<int> isDeleted;
  const ProgressEntriesCompanion({
    this.id = const Value.absent(),
    this.serverId = const Value.absent(),
    this.projectId = const Value.absent(),
    this.activityId = const Value.absent(),
    this.epsNodeId = const Value.absent(),
    this.boqItemId = const Value.absent(),
    this.microActivityId = const Value.absent(),
    this.quantity = const Value.absent(),
    this.date = const Value.absent(),
    this.remarks = const Value.absent(),
    this.photoPaths = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.syncError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.idempotencyKey = const Value.absent(),
    this.serverUpdatedAt = const Value.absent(),
    this.localUpdatedAt = const Value.absent(),
    this.isDeleted = const Value.absent(),
  });
  ProgressEntriesCompanion.insert({
    this.id = const Value.absent(),
    this.serverId = const Value.absent(),
    required int projectId,
    required int activityId,
    required int epsNodeId,
    required int boqItemId,
    this.microActivityId = const Value.absent(),
    required double quantity,
    required String date,
    this.remarks = const Value.absent(),
    this.photoPaths = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.syncError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.idempotencyKey = const Value.absent(),
    this.serverUpdatedAt = const Value.absent(),
    this.localUpdatedAt = const Value.absent(),
    this.isDeleted = const Value.absent(),
  })  : projectId = Value(projectId),
        activityId = Value(activityId),
        epsNodeId = Value(epsNodeId),
        boqItemId = Value(boqItemId),
        quantity = Value(quantity),
        date = Value(date);
  static Insertable<ProgressEntry> custom({
    Expression<int>? id,
    Expression<int>? serverId,
    Expression<int>? projectId,
    Expression<int>? activityId,
    Expression<int>? epsNodeId,
    Expression<int>? boqItemId,
    Expression<int>? microActivityId,
    Expression<double>? quantity,
    Expression<String>? date,
    Expression<String>? remarks,
    Expression<String>? photoPaths,
    Expression<int>? syncStatus,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? syncedAt,
    Expression<String>? syncError,
    Expression<int>? retryCount,
    Expression<String>? idempotencyKey,
    Expression<DateTime>? serverUpdatedAt,
    Expression<DateTime>? localUpdatedAt,
    Expression<int>? isDeleted,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (serverId != null) 'server_id': serverId,
      if (projectId != null) 'project_id': projectId,
      if (activityId != null) 'activity_id': activityId,
      if (epsNodeId != null) 'eps_node_id': epsNodeId,
      if (boqItemId != null) 'boq_item_id': boqItemId,
      if (microActivityId != null) 'micro_activity_id': microActivityId,
      if (quantity != null) 'quantity': quantity,
      if (date != null) 'date': date,
      if (remarks != null) 'remarks': remarks,
      if (photoPaths != null) 'photo_paths': photoPaths,
      if (syncStatus != null) 'sync_status': syncStatus,
      if (createdAt != null) 'created_at': createdAt,
      if (syncedAt != null) 'synced_at': syncedAt,
      if (syncError != null) 'sync_error': syncError,
      if (retryCount != null) 'retry_count': retryCount,
      if (idempotencyKey != null) 'idempotency_key': idempotencyKey,
      if (serverUpdatedAt != null) 'server_updated_at': serverUpdatedAt,
      if (localUpdatedAt != null) 'local_updated_at': localUpdatedAt,
      if (isDeleted != null) 'is_deleted': isDeleted,
    });
  }

  ProgressEntriesCompanion copyWith(
      {Value<int>? id,
      Value<int?>? serverId,
      Value<int>? projectId,
      Value<int>? activityId,
      Value<int>? epsNodeId,
      Value<int>? boqItemId,
      Value<int?>? microActivityId,
      Value<double>? quantity,
      Value<String>? date,
      Value<String?>? remarks,
      Value<String?>? photoPaths,
      Value<int>? syncStatus,
      Value<DateTime>? createdAt,
      Value<DateTime?>? syncedAt,
      Value<String?>? syncError,
      Value<int>? retryCount,
      Value<String?>? idempotencyKey,
      Value<DateTime?>? serverUpdatedAt,
      Value<DateTime>? localUpdatedAt,
      Value<int>? isDeleted}) {
    return ProgressEntriesCompanion(
      id: id ?? this.id,
      serverId: serverId ?? this.serverId,
      projectId: projectId ?? this.projectId,
      activityId: activityId ?? this.activityId,
      epsNodeId: epsNodeId ?? this.epsNodeId,
      boqItemId: boqItemId ?? this.boqItemId,
      microActivityId: microActivityId ?? this.microActivityId,
      quantity: quantity ?? this.quantity,
      date: date ?? this.date,
      remarks: remarks ?? this.remarks,
      photoPaths: photoPaths ?? this.photoPaths,
      syncStatus: syncStatus ?? this.syncStatus,
      createdAt: createdAt ?? this.createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
      syncError: syncError ?? this.syncError,
      retryCount: retryCount ?? this.retryCount,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      serverUpdatedAt: serverUpdatedAt ?? this.serverUpdatedAt,
      localUpdatedAt: localUpdatedAt ?? this.localUpdatedAt,
      isDeleted: isDeleted ?? this.isDeleted,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (serverId.present) {
      map['server_id'] = Variable<int>(serverId.value);
    }
    if (projectId.present) {
      map['project_id'] = Variable<int>(projectId.value);
    }
    if (activityId.present) {
      map['activity_id'] = Variable<int>(activityId.value);
    }
    if (epsNodeId.present) {
      map['eps_node_id'] = Variable<int>(epsNodeId.value);
    }
    if (boqItemId.present) {
      map['boq_item_id'] = Variable<int>(boqItemId.value);
    }
    if (microActivityId.present) {
      map['micro_activity_id'] = Variable<int>(microActivityId.value);
    }
    if (quantity.present) {
      map['quantity'] = Variable<double>(quantity.value);
    }
    if (date.present) {
      map['date'] = Variable<String>(date.value);
    }
    if (remarks.present) {
      map['remarks'] = Variable<String>(remarks.value);
    }
    if (photoPaths.present) {
      map['photo_paths'] = Variable<String>(photoPaths.value);
    }
    if (syncStatus.present) {
      map['sync_status'] = Variable<int>(syncStatus.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (syncedAt.present) {
      map['synced_at'] = Variable<DateTime>(syncedAt.value);
    }
    if (syncError.present) {
      map['sync_error'] = Variable<String>(syncError.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (idempotencyKey.present) {
      map['idempotency_key'] = Variable<String>(idempotencyKey.value);
    }
    if (serverUpdatedAt.present) {
      map['server_updated_at'] = Variable<DateTime>(serverUpdatedAt.value);
    }
    if (localUpdatedAt.present) {
      map['local_updated_at'] = Variable<DateTime>(localUpdatedAt.value);
    }
    if (isDeleted.present) {
      map['is_deleted'] = Variable<int>(isDeleted.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ProgressEntriesCompanion(')
          ..write('id: $id, ')
          ..write('serverId: $serverId, ')
          ..write('projectId: $projectId, ')
          ..write('activityId: $activityId, ')
          ..write('epsNodeId: $epsNodeId, ')
          ..write('boqItemId: $boqItemId, ')
          ..write('microActivityId: $microActivityId, ')
          ..write('quantity: $quantity, ')
          ..write('date: $date, ')
          ..write('remarks: $remarks, ')
          ..write('photoPaths: $photoPaths, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('syncError: $syncError, ')
          ..write('retryCount: $retryCount, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('serverUpdatedAt: $serverUpdatedAt, ')
          ..write('localUpdatedAt: $localUpdatedAt, ')
          ..write('isDeleted: $isDeleted')
          ..write(')'))
        .toString();
  }
}

class $DailyLogsTable extends DailyLogs
    with TableInfo<$DailyLogsTable, DailyLog> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DailyLogsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _serverIdMeta =
      const VerificationMeta('serverId');
  @override
  late final GeneratedColumn<int> serverId = GeneratedColumn<int>(
      'server_id', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _microActivityIdMeta =
      const VerificationMeta('microActivityId');
  @override
  late final GeneratedColumn<int> microActivityId = GeneratedColumn<int>(
      'micro_activity_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _logDateMeta =
      const VerificationMeta('logDate');
  @override
  late final GeneratedColumn<String> logDate = GeneratedColumn<String>(
      'log_date', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _plannedQtyMeta =
      const VerificationMeta('plannedQty');
  @override
  late final GeneratedColumn<double> plannedQty = GeneratedColumn<double>(
      'planned_qty', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _actualQtyMeta =
      const VerificationMeta('actualQty');
  @override
  late final GeneratedColumn<double> actualQty = GeneratedColumn<double>(
      'actual_qty', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _laborCountMeta =
      const VerificationMeta('laborCount');
  @override
  late final GeneratedColumn<int> laborCount = GeneratedColumn<int>(
      'labor_count', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _delayReasonIdMeta =
      const VerificationMeta('delayReasonId');
  @override
  late final GeneratedColumn<int> delayReasonId = GeneratedColumn<int>(
      'delay_reason_id', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _delayNotesMeta =
      const VerificationMeta('delayNotes');
  @override
  late final GeneratedColumn<String> delayNotes = GeneratedColumn<String>(
      'delay_notes', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _remarksMeta =
      const VerificationMeta('remarks');
  @override
  late final GeneratedColumn<String> remarks = GeneratedColumn<String>(
      'remarks', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _syncStatusMeta =
      const VerificationMeta('syncStatus');
  @override
  late final GeneratedColumn<int> syncStatus = GeneratedColumn<int>(
      'sync_status', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _syncedAtMeta =
      const VerificationMeta('syncedAt');
  @override
  late final GeneratedColumn<DateTime> syncedAt = GeneratedColumn<DateTime>(
      'synced_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _syncErrorMeta =
      const VerificationMeta('syncError');
  @override
  late final GeneratedColumn<String> syncError = GeneratedColumn<String>(
      'sync_error', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _retryCountMeta =
      const VerificationMeta('retryCount');
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
      'retry_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _idempotencyKeyMeta =
      const VerificationMeta('idempotencyKey');
  @override
  late final GeneratedColumn<String> idempotencyKey = GeneratedColumn<String>(
      'idempotency_key', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _serverUpdatedAtMeta =
      const VerificationMeta('serverUpdatedAt');
  @override
  late final GeneratedColumn<DateTime> serverUpdatedAt =
      GeneratedColumn<DateTime>('server_updated_at', aliasedName, true,
          type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _localUpdatedAtMeta =
      const VerificationMeta('localUpdatedAt');
  @override
  late final GeneratedColumn<DateTime> localUpdatedAt =
      GeneratedColumn<DateTime>('local_updated_at', aliasedName, false,
          type: DriftSqlType.dateTime,
          requiredDuringInsert: false,
          defaultValue: currentDateAndTime);
  static const VerificationMeta _isDeletedMeta =
      const VerificationMeta('isDeleted');
  @override
  late final GeneratedColumn<int> isDeleted = GeneratedColumn<int>(
      'is_deleted', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  @override
  List<GeneratedColumn> get $columns => [
        id,
        serverId,
        microActivityId,
        logDate,
        plannedQty,
        actualQty,
        laborCount,
        delayReasonId,
        delayNotes,
        remarks,
        syncStatus,
        createdAt,
        syncedAt,
        syncError,
        retryCount,
        idempotencyKey,
        serverUpdatedAt,
        localUpdatedAt,
        isDeleted
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'daily_logs';
  @override
  VerificationContext validateIntegrity(Insertable<DailyLog> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('server_id')) {
      context.handle(_serverIdMeta,
          serverId.isAcceptableOrUnknown(data['server_id']!, _serverIdMeta));
    }
    if (data.containsKey('micro_activity_id')) {
      context.handle(
          _microActivityIdMeta,
          microActivityId.isAcceptableOrUnknown(
              data['micro_activity_id']!, _microActivityIdMeta));
    } else if (isInserting) {
      context.missing(_microActivityIdMeta);
    }
    if (data.containsKey('log_date')) {
      context.handle(_logDateMeta,
          logDate.isAcceptableOrUnknown(data['log_date']!, _logDateMeta));
    } else if (isInserting) {
      context.missing(_logDateMeta);
    }
    if (data.containsKey('planned_qty')) {
      context.handle(
          _plannedQtyMeta,
          plannedQty.isAcceptableOrUnknown(
              data['planned_qty']!, _plannedQtyMeta));
    } else if (isInserting) {
      context.missing(_plannedQtyMeta);
    }
    if (data.containsKey('actual_qty')) {
      context.handle(_actualQtyMeta,
          actualQty.isAcceptableOrUnknown(data['actual_qty']!, _actualQtyMeta));
    } else if (isInserting) {
      context.missing(_actualQtyMeta);
    }
    if (data.containsKey('labor_count')) {
      context.handle(
          _laborCountMeta,
          laborCount.isAcceptableOrUnknown(
              data['labor_count']!, _laborCountMeta));
    }
    if (data.containsKey('delay_reason_id')) {
      context.handle(
          _delayReasonIdMeta,
          delayReasonId.isAcceptableOrUnknown(
              data['delay_reason_id']!, _delayReasonIdMeta));
    }
    if (data.containsKey('delay_notes')) {
      context.handle(
          _delayNotesMeta,
          delayNotes.isAcceptableOrUnknown(
              data['delay_notes']!, _delayNotesMeta));
    }
    if (data.containsKey('remarks')) {
      context.handle(_remarksMeta,
          remarks.isAcceptableOrUnknown(data['remarks']!, _remarksMeta));
    }
    if (data.containsKey('sync_status')) {
      context.handle(
          _syncStatusMeta,
          syncStatus.isAcceptableOrUnknown(
              data['sync_status']!, _syncStatusMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    if (data.containsKey('synced_at')) {
      context.handle(_syncedAtMeta,
          syncedAt.isAcceptableOrUnknown(data['synced_at']!, _syncedAtMeta));
    }
    if (data.containsKey('sync_error')) {
      context.handle(_syncErrorMeta,
          syncError.isAcceptableOrUnknown(data['sync_error']!, _syncErrorMeta));
    }
    if (data.containsKey('retry_count')) {
      context.handle(
          _retryCountMeta,
          retryCount.isAcceptableOrUnknown(
              data['retry_count']!, _retryCountMeta));
    }
    if (data.containsKey('idempotency_key')) {
      context.handle(
          _idempotencyKeyMeta,
          idempotencyKey.isAcceptableOrUnknown(
              data['idempotency_key']!, _idempotencyKeyMeta));
    }
    if (data.containsKey('server_updated_at')) {
      context.handle(
          _serverUpdatedAtMeta,
          serverUpdatedAt.isAcceptableOrUnknown(
              data['server_updated_at']!, _serverUpdatedAtMeta));
    }
    if (data.containsKey('local_updated_at')) {
      context.handle(
          _localUpdatedAtMeta,
          localUpdatedAt.isAcceptableOrUnknown(
              data['local_updated_at']!, _localUpdatedAtMeta));
    }
    if (data.containsKey('is_deleted')) {
      context.handle(_isDeletedMeta,
          isDeleted.isAcceptableOrUnknown(data['is_deleted']!, _isDeletedMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DailyLog map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DailyLog(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      serverId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}server_id']),
      microActivityId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}micro_activity_id'])!,
      logDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}log_date'])!,
      plannedQty: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}planned_qty'])!,
      actualQty: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}actual_qty'])!,
      laborCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}labor_count']),
      delayReasonId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}delay_reason_id']),
      delayNotes: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}delay_notes']),
      remarks: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}remarks']),
      syncStatus: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}sync_status'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      syncedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}synced_at']),
      syncError: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}sync_error']),
      retryCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}retry_count'])!,
      idempotencyKey: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}idempotency_key']),
      serverUpdatedAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}server_updated_at']),
      localUpdatedAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}local_updated_at'])!,
      isDeleted: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}is_deleted'])!,
    );
  }

  @override
  $DailyLogsTable createAlias(String alias) {
    return $DailyLogsTable(attachedDatabase, alias);
  }
}

class DailyLog extends DataClass implements Insertable<DailyLog> {
  final int id;
  final int? serverId;
  final int microActivityId;
  final String logDate;
  final double plannedQty;
  final double actualQty;
  final int? laborCount;
  final int? delayReasonId;
  final String? delayNotes;
  final String? remarks;
  final int syncStatus;
  final DateTime createdAt;
  final DateTime? syncedAt;
  final String? syncError;
  final int retryCount;
  final String? idempotencyKey;

  /// Server's last-modified timestamp — used for delta sync conflict detection.
  final DateTime? serverUpdatedAt;

  /// Client's last-modified timestamp — set on every local create or update.
  final DateTime localUpdatedAt;

  /// Soft-delete flag. 1 = deleted locally, row not yet purged.
  final int isDeleted;
  const DailyLog(
      {required this.id,
      this.serverId,
      required this.microActivityId,
      required this.logDate,
      required this.plannedQty,
      required this.actualQty,
      this.laborCount,
      this.delayReasonId,
      this.delayNotes,
      this.remarks,
      required this.syncStatus,
      required this.createdAt,
      this.syncedAt,
      this.syncError,
      required this.retryCount,
      this.idempotencyKey,
      this.serverUpdatedAt,
      required this.localUpdatedAt,
      required this.isDeleted});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    if (!nullToAbsent || serverId != null) {
      map['server_id'] = Variable<int>(serverId);
    }
    map['micro_activity_id'] = Variable<int>(microActivityId);
    map['log_date'] = Variable<String>(logDate);
    map['planned_qty'] = Variable<double>(plannedQty);
    map['actual_qty'] = Variable<double>(actualQty);
    if (!nullToAbsent || laborCount != null) {
      map['labor_count'] = Variable<int>(laborCount);
    }
    if (!nullToAbsent || delayReasonId != null) {
      map['delay_reason_id'] = Variable<int>(delayReasonId);
    }
    if (!nullToAbsent || delayNotes != null) {
      map['delay_notes'] = Variable<String>(delayNotes);
    }
    if (!nullToAbsent || remarks != null) {
      map['remarks'] = Variable<String>(remarks);
    }
    map['sync_status'] = Variable<int>(syncStatus);
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || syncedAt != null) {
      map['synced_at'] = Variable<DateTime>(syncedAt);
    }
    if (!nullToAbsent || syncError != null) {
      map['sync_error'] = Variable<String>(syncError);
    }
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || idempotencyKey != null) {
      map['idempotency_key'] = Variable<String>(idempotencyKey);
    }
    if (!nullToAbsent || serverUpdatedAt != null) {
      map['server_updated_at'] = Variable<DateTime>(serverUpdatedAt);
    }
    map['local_updated_at'] = Variable<DateTime>(localUpdatedAt);
    map['is_deleted'] = Variable<int>(isDeleted);
    return map;
  }

  DailyLogsCompanion toCompanion(bool nullToAbsent) {
    return DailyLogsCompanion(
      id: Value(id),
      serverId: serverId == null && nullToAbsent
          ? const Value.absent()
          : Value(serverId),
      microActivityId: Value(microActivityId),
      logDate: Value(logDate),
      plannedQty: Value(plannedQty),
      actualQty: Value(actualQty),
      laborCount: laborCount == null && nullToAbsent
          ? const Value.absent()
          : Value(laborCount),
      delayReasonId: delayReasonId == null && nullToAbsent
          ? const Value.absent()
          : Value(delayReasonId),
      delayNotes: delayNotes == null && nullToAbsent
          ? const Value.absent()
          : Value(delayNotes),
      remarks: remarks == null && nullToAbsent
          ? const Value.absent()
          : Value(remarks),
      syncStatus: Value(syncStatus),
      createdAt: Value(createdAt),
      syncedAt: syncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(syncedAt),
      syncError: syncError == null && nullToAbsent
          ? const Value.absent()
          : Value(syncError),
      retryCount: Value(retryCount),
      idempotencyKey: idempotencyKey == null && nullToAbsent
          ? const Value.absent()
          : Value(idempotencyKey),
      serverUpdatedAt: serverUpdatedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(serverUpdatedAt),
      localUpdatedAt: Value(localUpdatedAt),
      isDeleted: Value(isDeleted),
    );
  }

  factory DailyLog.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DailyLog(
      id: serializer.fromJson<int>(json['id']),
      serverId: serializer.fromJson<int?>(json['serverId']),
      microActivityId: serializer.fromJson<int>(json['microActivityId']),
      logDate: serializer.fromJson<String>(json['logDate']),
      plannedQty: serializer.fromJson<double>(json['plannedQty']),
      actualQty: serializer.fromJson<double>(json['actualQty']),
      laborCount: serializer.fromJson<int?>(json['laborCount']),
      delayReasonId: serializer.fromJson<int?>(json['delayReasonId']),
      delayNotes: serializer.fromJson<String?>(json['delayNotes']),
      remarks: serializer.fromJson<String?>(json['remarks']),
      syncStatus: serializer.fromJson<int>(json['syncStatus']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      syncedAt: serializer.fromJson<DateTime?>(json['syncedAt']),
      syncError: serializer.fromJson<String?>(json['syncError']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      idempotencyKey: serializer.fromJson<String?>(json['idempotencyKey']),
      serverUpdatedAt: serializer.fromJson<DateTime?>(json['serverUpdatedAt']),
      localUpdatedAt: serializer.fromJson<DateTime>(json['localUpdatedAt']),
      isDeleted: serializer.fromJson<int>(json['isDeleted']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'serverId': serializer.toJson<int?>(serverId),
      'microActivityId': serializer.toJson<int>(microActivityId),
      'logDate': serializer.toJson<String>(logDate),
      'plannedQty': serializer.toJson<double>(plannedQty),
      'actualQty': serializer.toJson<double>(actualQty),
      'laborCount': serializer.toJson<int?>(laborCount),
      'delayReasonId': serializer.toJson<int?>(delayReasonId),
      'delayNotes': serializer.toJson<String?>(delayNotes),
      'remarks': serializer.toJson<String?>(remarks),
      'syncStatus': serializer.toJson<int>(syncStatus),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'syncedAt': serializer.toJson<DateTime?>(syncedAt),
      'syncError': serializer.toJson<String?>(syncError),
      'retryCount': serializer.toJson<int>(retryCount),
      'idempotencyKey': serializer.toJson<String?>(idempotencyKey),
      'serverUpdatedAt': serializer.toJson<DateTime?>(serverUpdatedAt),
      'localUpdatedAt': serializer.toJson<DateTime>(localUpdatedAt),
      'isDeleted': serializer.toJson<int>(isDeleted),
    };
  }

  DailyLog copyWith(
          {int? id,
          Value<int?> serverId = const Value.absent(),
          int? microActivityId,
          String? logDate,
          double? plannedQty,
          double? actualQty,
          Value<int?> laborCount = const Value.absent(),
          Value<int?> delayReasonId = const Value.absent(),
          Value<String?> delayNotes = const Value.absent(),
          Value<String?> remarks = const Value.absent(),
          int? syncStatus,
          DateTime? createdAt,
          Value<DateTime?> syncedAt = const Value.absent(),
          Value<String?> syncError = const Value.absent(),
          int? retryCount,
          Value<String?> idempotencyKey = const Value.absent(),
          Value<DateTime?> serverUpdatedAt = const Value.absent(),
          DateTime? localUpdatedAt,
          int? isDeleted}) =>
      DailyLog(
        id: id ?? this.id,
        serverId: serverId.present ? serverId.value : this.serverId,
        microActivityId: microActivityId ?? this.microActivityId,
        logDate: logDate ?? this.logDate,
        plannedQty: plannedQty ?? this.plannedQty,
        actualQty: actualQty ?? this.actualQty,
        laborCount: laborCount.present ? laborCount.value : this.laborCount,
        delayReasonId:
            delayReasonId.present ? delayReasonId.value : this.delayReasonId,
        delayNotes: delayNotes.present ? delayNotes.value : this.delayNotes,
        remarks: remarks.present ? remarks.value : this.remarks,
        syncStatus: syncStatus ?? this.syncStatus,
        createdAt: createdAt ?? this.createdAt,
        syncedAt: syncedAt.present ? syncedAt.value : this.syncedAt,
        syncError: syncError.present ? syncError.value : this.syncError,
        retryCount: retryCount ?? this.retryCount,
        idempotencyKey:
            idempotencyKey.present ? idempotencyKey.value : this.idempotencyKey,
        serverUpdatedAt: serverUpdatedAt.present
            ? serverUpdatedAt.value
            : this.serverUpdatedAt,
        localUpdatedAt: localUpdatedAt ?? this.localUpdatedAt,
        isDeleted: isDeleted ?? this.isDeleted,
      );
  DailyLog copyWithCompanion(DailyLogsCompanion data) {
    return DailyLog(
      id: data.id.present ? data.id.value : this.id,
      serverId: data.serverId.present ? data.serverId.value : this.serverId,
      microActivityId: data.microActivityId.present
          ? data.microActivityId.value
          : this.microActivityId,
      logDate: data.logDate.present ? data.logDate.value : this.logDate,
      plannedQty:
          data.plannedQty.present ? data.plannedQty.value : this.plannedQty,
      actualQty: data.actualQty.present ? data.actualQty.value : this.actualQty,
      laborCount:
          data.laborCount.present ? data.laborCount.value : this.laborCount,
      delayReasonId: data.delayReasonId.present
          ? data.delayReasonId.value
          : this.delayReasonId,
      delayNotes:
          data.delayNotes.present ? data.delayNotes.value : this.delayNotes,
      remarks: data.remarks.present ? data.remarks.value : this.remarks,
      syncStatus:
          data.syncStatus.present ? data.syncStatus.value : this.syncStatus,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      syncedAt: data.syncedAt.present ? data.syncedAt.value : this.syncedAt,
      syncError: data.syncError.present ? data.syncError.value : this.syncError,
      retryCount:
          data.retryCount.present ? data.retryCount.value : this.retryCount,
      idempotencyKey: data.idempotencyKey.present
          ? data.idempotencyKey.value
          : this.idempotencyKey,
      serverUpdatedAt: data.serverUpdatedAt.present
          ? data.serverUpdatedAt.value
          : this.serverUpdatedAt,
      localUpdatedAt: data.localUpdatedAt.present
          ? data.localUpdatedAt.value
          : this.localUpdatedAt,
      isDeleted: data.isDeleted.present ? data.isDeleted.value : this.isDeleted,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DailyLog(')
          ..write('id: $id, ')
          ..write('serverId: $serverId, ')
          ..write('microActivityId: $microActivityId, ')
          ..write('logDate: $logDate, ')
          ..write('plannedQty: $plannedQty, ')
          ..write('actualQty: $actualQty, ')
          ..write('laborCount: $laborCount, ')
          ..write('delayReasonId: $delayReasonId, ')
          ..write('delayNotes: $delayNotes, ')
          ..write('remarks: $remarks, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('syncError: $syncError, ')
          ..write('retryCount: $retryCount, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('serverUpdatedAt: $serverUpdatedAt, ')
          ..write('localUpdatedAt: $localUpdatedAt, ')
          ..write('isDeleted: $isDeleted')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      serverId,
      microActivityId,
      logDate,
      plannedQty,
      actualQty,
      laborCount,
      delayReasonId,
      delayNotes,
      remarks,
      syncStatus,
      createdAt,
      syncedAt,
      syncError,
      retryCount,
      idempotencyKey,
      serverUpdatedAt,
      localUpdatedAt,
      isDeleted);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DailyLog &&
          other.id == this.id &&
          other.serverId == this.serverId &&
          other.microActivityId == this.microActivityId &&
          other.logDate == this.logDate &&
          other.plannedQty == this.plannedQty &&
          other.actualQty == this.actualQty &&
          other.laborCount == this.laborCount &&
          other.delayReasonId == this.delayReasonId &&
          other.delayNotes == this.delayNotes &&
          other.remarks == this.remarks &&
          other.syncStatus == this.syncStatus &&
          other.createdAt == this.createdAt &&
          other.syncedAt == this.syncedAt &&
          other.syncError == this.syncError &&
          other.retryCount == this.retryCount &&
          other.idempotencyKey == this.idempotencyKey &&
          other.serverUpdatedAt == this.serverUpdatedAt &&
          other.localUpdatedAt == this.localUpdatedAt &&
          other.isDeleted == this.isDeleted);
}

class DailyLogsCompanion extends UpdateCompanion<DailyLog> {
  final Value<int> id;
  final Value<int?> serverId;
  final Value<int> microActivityId;
  final Value<String> logDate;
  final Value<double> plannedQty;
  final Value<double> actualQty;
  final Value<int?> laborCount;
  final Value<int?> delayReasonId;
  final Value<String?> delayNotes;
  final Value<String?> remarks;
  final Value<int> syncStatus;
  final Value<DateTime> createdAt;
  final Value<DateTime?> syncedAt;
  final Value<String?> syncError;
  final Value<int> retryCount;
  final Value<String?> idempotencyKey;
  final Value<DateTime?> serverUpdatedAt;
  final Value<DateTime> localUpdatedAt;
  final Value<int> isDeleted;
  const DailyLogsCompanion({
    this.id = const Value.absent(),
    this.serverId = const Value.absent(),
    this.microActivityId = const Value.absent(),
    this.logDate = const Value.absent(),
    this.plannedQty = const Value.absent(),
    this.actualQty = const Value.absent(),
    this.laborCount = const Value.absent(),
    this.delayReasonId = const Value.absent(),
    this.delayNotes = const Value.absent(),
    this.remarks = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.syncError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.idempotencyKey = const Value.absent(),
    this.serverUpdatedAt = const Value.absent(),
    this.localUpdatedAt = const Value.absent(),
    this.isDeleted = const Value.absent(),
  });
  DailyLogsCompanion.insert({
    this.id = const Value.absent(),
    this.serverId = const Value.absent(),
    required int microActivityId,
    required String logDate,
    required double plannedQty,
    required double actualQty,
    this.laborCount = const Value.absent(),
    this.delayReasonId = const Value.absent(),
    this.delayNotes = const Value.absent(),
    this.remarks = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.syncError = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.idempotencyKey = const Value.absent(),
    this.serverUpdatedAt = const Value.absent(),
    this.localUpdatedAt = const Value.absent(),
    this.isDeleted = const Value.absent(),
  })  : microActivityId = Value(microActivityId),
        logDate = Value(logDate),
        plannedQty = Value(plannedQty),
        actualQty = Value(actualQty);
  static Insertable<DailyLog> custom({
    Expression<int>? id,
    Expression<int>? serverId,
    Expression<int>? microActivityId,
    Expression<String>? logDate,
    Expression<double>? plannedQty,
    Expression<double>? actualQty,
    Expression<int>? laborCount,
    Expression<int>? delayReasonId,
    Expression<String>? delayNotes,
    Expression<String>? remarks,
    Expression<int>? syncStatus,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? syncedAt,
    Expression<String>? syncError,
    Expression<int>? retryCount,
    Expression<String>? idempotencyKey,
    Expression<DateTime>? serverUpdatedAt,
    Expression<DateTime>? localUpdatedAt,
    Expression<int>? isDeleted,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (serverId != null) 'server_id': serverId,
      if (microActivityId != null) 'micro_activity_id': microActivityId,
      if (logDate != null) 'log_date': logDate,
      if (plannedQty != null) 'planned_qty': plannedQty,
      if (actualQty != null) 'actual_qty': actualQty,
      if (laborCount != null) 'labor_count': laborCount,
      if (delayReasonId != null) 'delay_reason_id': delayReasonId,
      if (delayNotes != null) 'delay_notes': delayNotes,
      if (remarks != null) 'remarks': remarks,
      if (syncStatus != null) 'sync_status': syncStatus,
      if (createdAt != null) 'created_at': createdAt,
      if (syncedAt != null) 'synced_at': syncedAt,
      if (syncError != null) 'sync_error': syncError,
      if (retryCount != null) 'retry_count': retryCount,
      if (idempotencyKey != null) 'idempotency_key': idempotencyKey,
      if (serverUpdatedAt != null) 'server_updated_at': serverUpdatedAt,
      if (localUpdatedAt != null) 'local_updated_at': localUpdatedAt,
      if (isDeleted != null) 'is_deleted': isDeleted,
    });
  }

  DailyLogsCompanion copyWith(
      {Value<int>? id,
      Value<int?>? serverId,
      Value<int>? microActivityId,
      Value<String>? logDate,
      Value<double>? plannedQty,
      Value<double>? actualQty,
      Value<int?>? laborCount,
      Value<int?>? delayReasonId,
      Value<String?>? delayNotes,
      Value<String?>? remarks,
      Value<int>? syncStatus,
      Value<DateTime>? createdAt,
      Value<DateTime?>? syncedAt,
      Value<String?>? syncError,
      Value<int>? retryCount,
      Value<String?>? idempotencyKey,
      Value<DateTime?>? serverUpdatedAt,
      Value<DateTime>? localUpdatedAt,
      Value<int>? isDeleted}) {
    return DailyLogsCompanion(
      id: id ?? this.id,
      serverId: serverId ?? this.serverId,
      microActivityId: microActivityId ?? this.microActivityId,
      logDate: logDate ?? this.logDate,
      plannedQty: plannedQty ?? this.plannedQty,
      actualQty: actualQty ?? this.actualQty,
      laborCount: laborCount ?? this.laborCount,
      delayReasonId: delayReasonId ?? this.delayReasonId,
      delayNotes: delayNotes ?? this.delayNotes,
      remarks: remarks ?? this.remarks,
      syncStatus: syncStatus ?? this.syncStatus,
      createdAt: createdAt ?? this.createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
      syncError: syncError ?? this.syncError,
      retryCount: retryCount ?? this.retryCount,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      serverUpdatedAt: serverUpdatedAt ?? this.serverUpdatedAt,
      localUpdatedAt: localUpdatedAt ?? this.localUpdatedAt,
      isDeleted: isDeleted ?? this.isDeleted,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (serverId.present) {
      map['server_id'] = Variable<int>(serverId.value);
    }
    if (microActivityId.present) {
      map['micro_activity_id'] = Variable<int>(microActivityId.value);
    }
    if (logDate.present) {
      map['log_date'] = Variable<String>(logDate.value);
    }
    if (plannedQty.present) {
      map['planned_qty'] = Variable<double>(plannedQty.value);
    }
    if (actualQty.present) {
      map['actual_qty'] = Variable<double>(actualQty.value);
    }
    if (laborCount.present) {
      map['labor_count'] = Variable<int>(laborCount.value);
    }
    if (delayReasonId.present) {
      map['delay_reason_id'] = Variable<int>(delayReasonId.value);
    }
    if (delayNotes.present) {
      map['delay_notes'] = Variable<String>(delayNotes.value);
    }
    if (remarks.present) {
      map['remarks'] = Variable<String>(remarks.value);
    }
    if (syncStatus.present) {
      map['sync_status'] = Variable<int>(syncStatus.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (syncedAt.present) {
      map['synced_at'] = Variable<DateTime>(syncedAt.value);
    }
    if (syncError.present) {
      map['sync_error'] = Variable<String>(syncError.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (idempotencyKey.present) {
      map['idempotency_key'] = Variable<String>(idempotencyKey.value);
    }
    if (serverUpdatedAt.present) {
      map['server_updated_at'] = Variable<DateTime>(serverUpdatedAt.value);
    }
    if (localUpdatedAt.present) {
      map['local_updated_at'] = Variable<DateTime>(localUpdatedAt.value);
    }
    if (isDeleted.present) {
      map['is_deleted'] = Variable<int>(isDeleted.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DailyLogsCompanion(')
          ..write('id: $id, ')
          ..write('serverId: $serverId, ')
          ..write('microActivityId: $microActivityId, ')
          ..write('logDate: $logDate, ')
          ..write('plannedQty: $plannedQty, ')
          ..write('actualQty: $actualQty, ')
          ..write('laborCount: $laborCount, ')
          ..write('delayReasonId: $delayReasonId, ')
          ..write('delayNotes: $delayNotes, ')
          ..write('remarks: $remarks, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('syncError: $syncError, ')
          ..write('retryCount: $retryCount, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('serverUpdatedAt: $serverUpdatedAt, ')
          ..write('localUpdatedAt: $localUpdatedAt, ')
          ..write('isDeleted: $isDeleted')
          ..write(')'))
        .toString();
  }
}

class $SyncQueueTable extends SyncQueue
    with TableInfo<$SyncQueueTable, SyncQueueData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _entityTypeMeta =
      const VerificationMeta('entityType');
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
      'entity_type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityIdMeta =
      const VerificationMeta('entityId');
  @override
  late final GeneratedColumn<int> entityId = GeneratedColumn<int>(
      'entity_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _operationMeta =
      const VerificationMeta('operation');
  @override
  late final GeneratedColumn<String> operation = GeneratedColumn<String>(
      'operation', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _retryCountMeta =
      const VerificationMeta('retryCount');
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
      'retry_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _lastAttemptAtMeta =
      const VerificationMeta('lastAttemptAt');
  @override
  late final GeneratedColumn<DateTime> lastAttemptAt =
      GeneratedColumn<DateTime>('last_attempt_at', aliasedName, true,
          type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _lastErrorMeta =
      const VerificationMeta('lastError');
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
      'last_error', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _priorityMeta =
      const VerificationMeta('priority');
  @override
  late final GeneratedColumn<int> priority = GeneratedColumn<int>(
      'priority', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  @override
  List<GeneratedColumn> get $columns => [
        id,
        entityType,
        entityId,
        operation,
        payload,
        retryCount,
        createdAt,
        lastAttemptAt,
        lastError,
        priority
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_queue';
  @override
  VerificationContext validateIntegrity(Insertable<SyncQueueData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('entity_type')) {
      context.handle(
          _entityTypeMeta,
          entityType.isAcceptableOrUnknown(
              data['entity_type']!, _entityTypeMeta));
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(_entityIdMeta,
          entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta));
    } else if (isInserting) {
      context.missing(_entityIdMeta);
    }
    if (data.containsKey('operation')) {
      context.handle(_operationMeta,
          operation.isAcceptableOrUnknown(data['operation']!, _operationMeta));
    } else if (isInserting) {
      context.missing(_operationMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('retry_count')) {
      context.handle(
          _retryCountMeta,
          retryCount.isAcceptableOrUnknown(
              data['retry_count']!, _retryCountMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    if (data.containsKey('last_attempt_at')) {
      context.handle(
          _lastAttemptAtMeta,
          lastAttemptAt.isAcceptableOrUnknown(
              data['last_attempt_at']!, _lastAttemptAtMeta));
    }
    if (data.containsKey('last_error')) {
      context.handle(_lastErrorMeta,
          lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta));
    }
    if (data.containsKey('priority')) {
      context.handle(_priorityMeta,
          priority.isAcceptableOrUnknown(data['priority']!, _priorityMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SyncQueueData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncQueueData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      entityType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_type'])!,
      entityId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}entity_id'])!,
      operation: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}operation'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
      retryCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}retry_count'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      lastAttemptAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}last_attempt_at']),
      lastError: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}last_error']),
      priority: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}priority'])!,
    );
  }

  @override
  $SyncQueueTable createAlias(String alias) {
    return $SyncQueueTable(attachedDatabase, alias);
  }
}

class SyncQueueData extends DataClass implements Insertable<SyncQueueData> {
  final int id;

  /// Logical type of the operation, e.g. 'progress', 'daily_log',
  /// 'quality_rfi', 'ehs_site_obs_create'. Used as the dispatch key in
  /// [SyncService._processQualityQueue].
  final String entityType;
  final int entityId;
  final String operation;

  /// Full JSON-encoded payload to be sent to the server. Storing the entire
  /// payload avoids the need to re-query the source table at sync time.
  final String payload;
  final int retryCount;
  final DateTime createdAt;
  final DateTime? lastAttemptAt;
  final String? lastError;

  /// Higher priority items are processed first. Used to ensure user-initiated
  /// operations (e.g. RFI raises) complete before background refreshes.
  final int priority;
  const SyncQueueData(
      {required this.id,
      required this.entityType,
      required this.entityId,
      required this.operation,
      required this.payload,
      required this.retryCount,
      required this.createdAt,
      this.lastAttemptAt,
      this.lastError,
      required this.priority});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['entity_type'] = Variable<String>(entityType);
    map['entity_id'] = Variable<int>(entityId);
    map['operation'] = Variable<String>(operation);
    map['payload'] = Variable<String>(payload);
    map['retry_count'] = Variable<int>(retryCount);
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || lastAttemptAt != null) {
      map['last_attempt_at'] = Variable<DateTime>(lastAttemptAt);
    }
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    map['priority'] = Variable<int>(priority);
    return map;
  }

  SyncQueueCompanion toCompanion(bool nullToAbsent) {
    return SyncQueueCompanion(
      id: Value(id),
      entityType: Value(entityType),
      entityId: Value(entityId),
      operation: Value(operation),
      payload: Value(payload),
      retryCount: Value(retryCount),
      createdAt: Value(createdAt),
      lastAttemptAt: lastAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastAttemptAt),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      priority: Value(priority),
    );
  }

  factory SyncQueueData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncQueueData(
      id: serializer.fromJson<int>(json['id']),
      entityType: serializer.fromJson<String>(json['entityType']),
      entityId: serializer.fromJson<int>(json['entityId']),
      operation: serializer.fromJson<String>(json['operation']),
      payload: serializer.fromJson<String>(json['payload']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      lastAttemptAt: serializer.fromJson<DateTime?>(json['lastAttemptAt']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      priority: serializer.fromJson<int>(json['priority']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'entityType': serializer.toJson<String>(entityType),
      'entityId': serializer.toJson<int>(entityId),
      'operation': serializer.toJson<String>(operation),
      'payload': serializer.toJson<String>(payload),
      'retryCount': serializer.toJson<int>(retryCount),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'lastAttemptAt': serializer.toJson<DateTime?>(lastAttemptAt),
      'lastError': serializer.toJson<String?>(lastError),
      'priority': serializer.toJson<int>(priority),
    };
  }

  SyncQueueData copyWith(
          {int? id,
          String? entityType,
          int? entityId,
          String? operation,
          String? payload,
          int? retryCount,
          DateTime? createdAt,
          Value<DateTime?> lastAttemptAt = const Value.absent(),
          Value<String?> lastError = const Value.absent(),
          int? priority}) =>
      SyncQueueData(
        id: id ?? this.id,
        entityType: entityType ?? this.entityType,
        entityId: entityId ?? this.entityId,
        operation: operation ?? this.operation,
        payload: payload ?? this.payload,
        retryCount: retryCount ?? this.retryCount,
        createdAt: createdAt ?? this.createdAt,
        lastAttemptAt:
            lastAttemptAt.present ? lastAttemptAt.value : this.lastAttemptAt,
        lastError: lastError.present ? lastError.value : this.lastError,
        priority: priority ?? this.priority,
      );
  SyncQueueData copyWithCompanion(SyncQueueCompanion data) {
    return SyncQueueData(
      id: data.id.present ? data.id.value : this.id,
      entityType:
          data.entityType.present ? data.entityType.value : this.entityType,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      operation: data.operation.present ? data.operation.value : this.operation,
      payload: data.payload.present ? data.payload.value : this.payload,
      retryCount:
          data.retryCount.present ? data.retryCount.value : this.retryCount,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      lastAttemptAt: data.lastAttemptAt.present
          ? data.lastAttemptAt.value
          : this.lastAttemptAt,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      priority: data.priority.present ? data.priority.value : this.priority,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncQueueData(')
          ..write('id: $id, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('operation: $operation, ')
          ..write('payload: $payload, ')
          ..write('retryCount: $retryCount, ')
          ..write('createdAt: $createdAt, ')
          ..write('lastAttemptAt: $lastAttemptAt, ')
          ..write('lastError: $lastError, ')
          ..write('priority: $priority')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, entityType, entityId, operation, payload,
      retryCount, createdAt, lastAttemptAt, lastError, priority);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncQueueData &&
          other.id == this.id &&
          other.entityType == this.entityType &&
          other.entityId == this.entityId &&
          other.operation == this.operation &&
          other.payload == this.payload &&
          other.retryCount == this.retryCount &&
          other.createdAt == this.createdAt &&
          other.lastAttemptAt == this.lastAttemptAt &&
          other.lastError == this.lastError &&
          other.priority == this.priority);
}

class SyncQueueCompanion extends UpdateCompanion<SyncQueueData> {
  final Value<int> id;
  final Value<String> entityType;
  final Value<int> entityId;
  final Value<String> operation;
  final Value<String> payload;
  final Value<int> retryCount;
  final Value<DateTime> createdAt;
  final Value<DateTime?> lastAttemptAt;
  final Value<String?> lastError;
  final Value<int> priority;
  const SyncQueueCompanion({
    this.id = const Value.absent(),
    this.entityType = const Value.absent(),
    this.entityId = const Value.absent(),
    this.operation = const Value.absent(),
    this.payload = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.lastAttemptAt = const Value.absent(),
    this.lastError = const Value.absent(),
    this.priority = const Value.absent(),
  });
  SyncQueueCompanion.insert({
    this.id = const Value.absent(),
    required String entityType,
    required int entityId,
    required String operation,
    required String payload,
    this.retryCount = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.lastAttemptAt = const Value.absent(),
    this.lastError = const Value.absent(),
    this.priority = const Value.absent(),
  })  : entityType = Value(entityType),
        entityId = Value(entityId),
        operation = Value(operation),
        payload = Value(payload);
  static Insertable<SyncQueueData> custom({
    Expression<int>? id,
    Expression<String>? entityType,
    Expression<int>? entityId,
    Expression<String>? operation,
    Expression<String>? payload,
    Expression<int>? retryCount,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? lastAttemptAt,
    Expression<String>? lastError,
    Expression<int>? priority,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (entityType != null) 'entity_type': entityType,
      if (entityId != null) 'entity_id': entityId,
      if (operation != null) 'operation': operation,
      if (payload != null) 'payload': payload,
      if (retryCount != null) 'retry_count': retryCount,
      if (createdAt != null) 'created_at': createdAt,
      if (lastAttemptAt != null) 'last_attempt_at': lastAttemptAt,
      if (lastError != null) 'last_error': lastError,
      if (priority != null) 'priority': priority,
    });
  }

  SyncQueueCompanion copyWith(
      {Value<int>? id,
      Value<String>? entityType,
      Value<int>? entityId,
      Value<String>? operation,
      Value<String>? payload,
      Value<int>? retryCount,
      Value<DateTime>? createdAt,
      Value<DateTime?>? lastAttemptAt,
      Value<String?>? lastError,
      Value<int>? priority}) {
    return SyncQueueCompanion(
      id: id ?? this.id,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      operation: operation ?? this.operation,
      payload: payload ?? this.payload,
      retryCount: retryCount ?? this.retryCount,
      createdAt: createdAt ?? this.createdAt,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      lastError: lastError ?? this.lastError,
      priority: priority ?? this.priority,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<int>(entityId.value);
    }
    if (operation.present) {
      map['operation'] = Variable<String>(operation.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (lastAttemptAt.present) {
      map['last_attempt_at'] = Variable<DateTime>(lastAttemptAt.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (priority.present) {
      map['priority'] = Variable<int>(priority.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncQueueCompanion(')
          ..write('id: $id, ')
          ..write('entityType: $entityType, ')
          ..write('entityId: $entityId, ')
          ..write('operation: $operation, ')
          ..write('payload: $payload, ')
          ..write('retryCount: $retryCount, ')
          ..write('createdAt: $createdAt, ')
          ..write('lastAttemptAt: $lastAttemptAt, ')
          ..write('lastError: $lastError, ')
          ..write('priority: $priority')
          ..write(')'))
        .toString();
  }
}

class $CachedProjectsTable extends CachedProjects
    with TableInfo<$CachedProjectsTable, CachedProject> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedProjectsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
      'code', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _startDateMeta =
      const VerificationMeta('startDate');
  @override
  late final GeneratedColumn<String> startDate = GeneratedColumn<String>(
      'start_date', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _endDateMeta =
      const VerificationMeta('endDate');
  @override
  late final GeneratedColumn<String> endDate = GeneratedColumn<String>(
      'end_date', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _rawDataMeta =
      const VerificationMeta('rawData');
  @override
  late final GeneratedColumn<String> rawData = GeneratedColumn<String>(
      'raw_data', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns =>
      [id, name, code, status, startDate, endDate, rawData, cachedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_projects';
  @override
  VerificationContext validateIntegrity(Insertable<CachedProject> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('code')) {
      context.handle(
          _codeMeta, code.isAcceptableOrUnknown(data['code']!, _codeMeta));
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('start_date')) {
      context.handle(_startDateMeta,
          startDate.isAcceptableOrUnknown(data['start_date']!, _startDateMeta));
    }
    if (data.containsKey('end_date')) {
      context.handle(_endDateMeta,
          endDate.isAcceptableOrUnknown(data['end_date']!, _endDateMeta));
    }
    if (data.containsKey('raw_data')) {
      context.handle(_rawDataMeta,
          rawData.isAcceptableOrUnknown(data['raw_data']!, _rawDataMeta));
    } else if (isInserting) {
      context.missing(_rawDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedProject map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedProject(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      code: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}code']),
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status']),
      startDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}start_date']),
      endDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}end_date']),
      rawData: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}raw_data'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedProjectsTable createAlias(String alias) {
    return $CachedProjectsTable(attachedDatabase, alias);
  }
}

class CachedProject extends DataClass implements Insertable<CachedProject> {
  final int id;
  final String name;
  final String? code;
  final String? status;
  final String? startDate;
  final String? endDate;
  final String rawData;
  final DateTime cachedAt;
  const CachedProject(
      {required this.id,
      required this.name,
      this.code,
      this.status,
      this.startDate,
      this.endDate,
      required this.rawData,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || code != null) {
      map['code'] = Variable<String>(code);
    }
    if (!nullToAbsent || status != null) {
      map['status'] = Variable<String>(status);
    }
    if (!nullToAbsent || startDate != null) {
      map['start_date'] = Variable<String>(startDate);
    }
    if (!nullToAbsent || endDate != null) {
      map['end_date'] = Variable<String>(endDate);
    }
    map['raw_data'] = Variable<String>(rawData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedProjectsCompanion toCompanion(bool nullToAbsent) {
    return CachedProjectsCompanion(
      id: Value(id),
      name: Value(name),
      code: code == null && nullToAbsent ? const Value.absent() : Value(code),
      status:
          status == null && nullToAbsent ? const Value.absent() : Value(status),
      startDate: startDate == null && nullToAbsent
          ? const Value.absent()
          : Value(startDate),
      endDate: endDate == null && nullToAbsent
          ? const Value.absent()
          : Value(endDate),
      rawData: Value(rawData),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedProject.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedProject(
      id: serializer.fromJson<int>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      code: serializer.fromJson<String?>(json['code']),
      status: serializer.fromJson<String?>(json['status']),
      startDate: serializer.fromJson<String?>(json['startDate']),
      endDate: serializer.fromJson<String?>(json['endDate']),
      rawData: serializer.fromJson<String>(json['rawData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'name': serializer.toJson<String>(name),
      'code': serializer.toJson<String?>(code),
      'status': serializer.toJson<String?>(status),
      'startDate': serializer.toJson<String?>(startDate),
      'endDate': serializer.toJson<String?>(endDate),
      'rawData': serializer.toJson<String>(rawData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedProject copyWith(
          {int? id,
          String? name,
          Value<String?> code = const Value.absent(),
          Value<String?> status = const Value.absent(),
          Value<String?> startDate = const Value.absent(),
          Value<String?> endDate = const Value.absent(),
          String? rawData,
          DateTime? cachedAt}) =>
      CachedProject(
        id: id ?? this.id,
        name: name ?? this.name,
        code: code.present ? code.value : this.code,
        status: status.present ? status.value : this.status,
        startDate: startDate.present ? startDate.value : this.startDate,
        endDate: endDate.present ? endDate.value : this.endDate,
        rawData: rawData ?? this.rawData,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedProject copyWithCompanion(CachedProjectsCompanion data) {
    return CachedProject(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      code: data.code.present ? data.code.value : this.code,
      status: data.status.present ? data.status.value : this.status,
      startDate: data.startDate.present ? data.startDate.value : this.startDate,
      endDate: data.endDate.present ? data.endDate.value : this.endDate,
      rawData: data.rawData.present ? data.rawData.value : this.rawData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedProject(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('code: $code, ')
          ..write('status: $status, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id, name, code, status, startDate, endDate, rawData, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedProject &&
          other.id == this.id &&
          other.name == this.name &&
          other.code == this.code &&
          other.status == this.status &&
          other.startDate == this.startDate &&
          other.endDate == this.endDate &&
          other.rawData == this.rawData &&
          other.cachedAt == this.cachedAt);
}

class CachedProjectsCompanion extends UpdateCompanion<CachedProject> {
  final Value<int> id;
  final Value<String> name;
  final Value<String?> code;
  final Value<String?> status;
  final Value<String?> startDate;
  final Value<String?> endDate;
  final Value<String> rawData;
  final Value<DateTime> cachedAt;
  const CachedProjectsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.code = const Value.absent(),
    this.status = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.rawData = const Value.absent(),
    this.cachedAt = const Value.absent(),
  });
  CachedProjectsCompanion.insert({
    this.id = const Value.absent(),
    required String name,
    this.code = const Value.absent(),
    this.status = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    required String rawData,
    this.cachedAt = const Value.absent(),
  })  : name = Value(name),
        rawData = Value(rawData);
  static Insertable<CachedProject> custom({
    Expression<int>? id,
    Expression<String>? name,
    Expression<String>? code,
    Expression<String>? status,
    Expression<String>? startDate,
    Expression<String>? endDate,
    Expression<String>? rawData,
    Expression<DateTime>? cachedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (code != null) 'code': code,
      if (status != null) 'status': status,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (rawData != null) 'raw_data': rawData,
      if (cachedAt != null) 'cached_at': cachedAt,
    });
  }

  CachedProjectsCompanion copyWith(
      {Value<int>? id,
      Value<String>? name,
      Value<String?>? code,
      Value<String?>? status,
      Value<String?>? startDate,
      Value<String?>? endDate,
      Value<String>? rawData,
      Value<DateTime>? cachedAt}) {
    return CachedProjectsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      code: code ?? this.code,
      status: status ?? this.status,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      rawData: rawData ?? this.rawData,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (startDate.present) {
      map['start_date'] = Variable<String>(startDate.value);
    }
    if (endDate.present) {
      map['end_date'] = Variable<String>(endDate.value);
    }
    if (rawData.present) {
      map['raw_data'] = Variable<String>(rawData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedProjectsCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('code: $code, ')
          ..write('status: $status, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }
}

class $CachedActivitiesTable extends CachedActivities
    with TableInfo<$CachedActivitiesTable, CachedActivity> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedActivitiesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _projectIdMeta =
      const VerificationMeta('projectId');
  @override
  late final GeneratedColumn<int> projectId = GeneratedColumn<int>(
      'project_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _epsNodeIdMeta =
      const VerificationMeta('epsNodeId');
  @override
  late final GeneratedColumn<int> epsNodeId = GeneratedColumn<int>(
      'eps_node_id', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _startDateMeta =
      const VerificationMeta('startDate');
  @override
  late final GeneratedColumn<String> startDate = GeneratedColumn<String>(
      'start_date', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _endDateMeta =
      const VerificationMeta('endDate');
  @override
  late final GeneratedColumn<String> endDate = GeneratedColumn<String>(
      'end_date', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _progressMeta =
      const VerificationMeta('progress');
  @override
  late final GeneratedColumn<double> progress = GeneratedColumn<double>(
      'progress', aliasedName, false,
      type: DriftSqlType.double,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _rawDataMeta =
      const VerificationMeta('rawData');
  @override
  late final GeneratedColumn<String> rawData = GeneratedColumn<String>(
      'raw_data', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        projectId,
        epsNodeId,
        name,
        status,
        startDate,
        endDate,
        progress,
        rawData,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_activities';
  @override
  VerificationContext validateIntegrity(Insertable<CachedActivity> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('project_id')) {
      context.handle(_projectIdMeta,
          projectId.isAcceptableOrUnknown(data['project_id']!, _projectIdMeta));
    } else if (isInserting) {
      context.missing(_projectIdMeta);
    }
    if (data.containsKey('eps_node_id')) {
      context.handle(
          _epsNodeIdMeta,
          epsNodeId.isAcceptableOrUnknown(
              data['eps_node_id']!, _epsNodeIdMeta));
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('start_date')) {
      context.handle(_startDateMeta,
          startDate.isAcceptableOrUnknown(data['start_date']!, _startDateMeta));
    }
    if (data.containsKey('end_date')) {
      context.handle(_endDateMeta,
          endDate.isAcceptableOrUnknown(data['end_date']!, _endDateMeta));
    }
    if (data.containsKey('progress')) {
      context.handle(_progressMeta,
          progress.isAcceptableOrUnknown(data['progress']!, _progressMeta));
    }
    if (data.containsKey('raw_data')) {
      context.handle(_rawDataMeta,
          rawData.isAcceptableOrUnknown(data['raw_data']!, _rawDataMeta));
    } else if (isInserting) {
      context.missing(_rawDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedActivity map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedActivity(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      projectId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}project_id'])!,
      epsNodeId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}eps_node_id']),
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status']),
      startDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}start_date']),
      endDate: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}end_date']),
      progress: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}progress'])!,
      rawData: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}raw_data'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedActivitiesTable createAlias(String alias) {
    return $CachedActivitiesTable(attachedDatabase, alias);
  }
}

class CachedActivity extends DataClass implements Insertable<CachedActivity> {
  final int id;
  final int projectId;
  final int? epsNodeId;
  final String name;
  final String? status;
  final String? startDate;
  final String? endDate;
  final double progress;
  final String rawData;
  final DateTime cachedAt;
  const CachedActivity(
      {required this.id,
      required this.projectId,
      this.epsNodeId,
      required this.name,
      this.status,
      this.startDate,
      this.endDate,
      required this.progress,
      required this.rawData,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['project_id'] = Variable<int>(projectId);
    if (!nullToAbsent || epsNodeId != null) {
      map['eps_node_id'] = Variable<int>(epsNodeId);
    }
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || status != null) {
      map['status'] = Variable<String>(status);
    }
    if (!nullToAbsent || startDate != null) {
      map['start_date'] = Variable<String>(startDate);
    }
    if (!nullToAbsent || endDate != null) {
      map['end_date'] = Variable<String>(endDate);
    }
    map['progress'] = Variable<double>(progress);
    map['raw_data'] = Variable<String>(rawData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedActivitiesCompanion toCompanion(bool nullToAbsent) {
    return CachedActivitiesCompanion(
      id: Value(id),
      projectId: Value(projectId),
      epsNodeId: epsNodeId == null && nullToAbsent
          ? const Value.absent()
          : Value(epsNodeId),
      name: Value(name),
      status:
          status == null && nullToAbsent ? const Value.absent() : Value(status),
      startDate: startDate == null && nullToAbsent
          ? const Value.absent()
          : Value(startDate),
      endDate: endDate == null && nullToAbsent
          ? const Value.absent()
          : Value(endDate),
      progress: Value(progress),
      rawData: Value(rawData),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedActivity.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedActivity(
      id: serializer.fromJson<int>(json['id']),
      projectId: serializer.fromJson<int>(json['projectId']),
      epsNodeId: serializer.fromJson<int?>(json['epsNodeId']),
      name: serializer.fromJson<String>(json['name']),
      status: serializer.fromJson<String?>(json['status']),
      startDate: serializer.fromJson<String?>(json['startDate']),
      endDate: serializer.fromJson<String?>(json['endDate']),
      progress: serializer.fromJson<double>(json['progress']),
      rawData: serializer.fromJson<String>(json['rawData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'projectId': serializer.toJson<int>(projectId),
      'epsNodeId': serializer.toJson<int?>(epsNodeId),
      'name': serializer.toJson<String>(name),
      'status': serializer.toJson<String?>(status),
      'startDate': serializer.toJson<String?>(startDate),
      'endDate': serializer.toJson<String?>(endDate),
      'progress': serializer.toJson<double>(progress),
      'rawData': serializer.toJson<String>(rawData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedActivity copyWith(
          {int? id,
          int? projectId,
          Value<int?> epsNodeId = const Value.absent(),
          String? name,
          Value<String?> status = const Value.absent(),
          Value<String?> startDate = const Value.absent(),
          Value<String?> endDate = const Value.absent(),
          double? progress,
          String? rawData,
          DateTime? cachedAt}) =>
      CachedActivity(
        id: id ?? this.id,
        projectId: projectId ?? this.projectId,
        epsNodeId: epsNodeId.present ? epsNodeId.value : this.epsNodeId,
        name: name ?? this.name,
        status: status.present ? status.value : this.status,
        startDate: startDate.present ? startDate.value : this.startDate,
        endDate: endDate.present ? endDate.value : this.endDate,
        progress: progress ?? this.progress,
        rawData: rawData ?? this.rawData,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedActivity copyWithCompanion(CachedActivitiesCompanion data) {
    return CachedActivity(
      id: data.id.present ? data.id.value : this.id,
      projectId: data.projectId.present ? data.projectId.value : this.projectId,
      epsNodeId: data.epsNodeId.present ? data.epsNodeId.value : this.epsNodeId,
      name: data.name.present ? data.name.value : this.name,
      status: data.status.present ? data.status.value : this.status,
      startDate: data.startDate.present ? data.startDate.value : this.startDate,
      endDate: data.endDate.present ? data.endDate.value : this.endDate,
      progress: data.progress.present ? data.progress.value : this.progress,
      rawData: data.rawData.present ? data.rawData.value : this.rawData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedActivity(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('epsNodeId: $epsNodeId, ')
          ..write('name: $name, ')
          ..write('status: $status, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('progress: $progress, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, projectId, epsNodeId, name, status,
      startDate, endDate, progress, rawData, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedActivity &&
          other.id == this.id &&
          other.projectId == this.projectId &&
          other.epsNodeId == this.epsNodeId &&
          other.name == this.name &&
          other.status == this.status &&
          other.startDate == this.startDate &&
          other.endDate == this.endDate &&
          other.progress == this.progress &&
          other.rawData == this.rawData &&
          other.cachedAt == this.cachedAt);
}

class CachedActivitiesCompanion extends UpdateCompanion<CachedActivity> {
  final Value<int> id;
  final Value<int> projectId;
  final Value<int?> epsNodeId;
  final Value<String> name;
  final Value<String?> status;
  final Value<String?> startDate;
  final Value<String?> endDate;
  final Value<double> progress;
  final Value<String> rawData;
  final Value<DateTime> cachedAt;
  const CachedActivitiesCompanion({
    this.id = const Value.absent(),
    this.projectId = const Value.absent(),
    this.epsNodeId = const Value.absent(),
    this.name = const Value.absent(),
    this.status = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.progress = const Value.absent(),
    this.rawData = const Value.absent(),
    this.cachedAt = const Value.absent(),
  });
  CachedActivitiesCompanion.insert({
    this.id = const Value.absent(),
    required int projectId,
    this.epsNodeId = const Value.absent(),
    required String name,
    this.status = const Value.absent(),
    this.startDate = const Value.absent(),
    this.endDate = const Value.absent(),
    this.progress = const Value.absent(),
    required String rawData,
    this.cachedAt = const Value.absent(),
  })  : projectId = Value(projectId),
        name = Value(name),
        rawData = Value(rawData);
  static Insertable<CachedActivity> custom({
    Expression<int>? id,
    Expression<int>? projectId,
    Expression<int>? epsNodeId,
    Expression<String>? name,
    Expression<String>? status,
    Expression<String>? startDate,
    Expression<String>? endDate,
    Expression<double>? progress,
    Expression<String>? rawData,
    Expression<DateTime>? cachedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (projectId != null) 'project_id': projectId,
      if (epsNodeId != null) 'eps_node_id': epsNodeId,
      if (name != null) 'name': name,
      if (status != null) 'status': status,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (progress != null) 'progress': progress,
      if (rawData != null) 'raw_data': rawData,
      if (cachedAt != null) 'cached_at': cachedAt,
    });
  }

  CachedActivitiesCompanion copyWith(
      {Value<int>? id,
      Value<int>? projectId,
      Value<int?>? epsNodeId,
      Value<String>? name,
      Value<String?>? status,
      Value<String?>? startDate,
      Value<String?>? endDate,
      Value<double>? progress,
      Value<String>? rawData,
      Value<DateTime>? cachedAt}) {
    return CachedActivitiesCompanion(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      epsNodeId: epsNodeId ?? this.epsNodeId,
      name: name ?? this.name,
      status: status ?? this.status,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      progress: progress ?? this.progress,
      rawData: rawData ?? this.rawData,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (projectId.present) {
      map['project_id'] = Variable<int>(projectId.value);
    }
    if (epsNodeId.present) {
      map['eps_node_id'] = Variable<int>(epsNodeId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (startDate.present) {
      map['start_date'] = Variable<String>(startDate.value);
    }
    if (endDate.present) {
      map['end_date'] = Variable<String>(endDate.value);
    }
    if (progress.present) {
      map['progress'] = Variable<double>(progress.value);
    }
    if (rawData.present) {
      map['raw_data'] = Variable<String>(rawData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedActivitiesCompanion(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('epsNodeId: $epsNodeId, ')
          ..write('name: $name, ')
          ..write('status: $status, ')
          ..write('startDate: $startDate, ')
          ..write('endDate: $endDate, ')
          ..write('progress: $progress, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }
}

class $CachedBoqItemsTable extends CachedBoqItems
    with TableInfo<$CachedBoqItemsTable, CachedBoqItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedBoqItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _projectIdMeta =
      const VerificationMeta('projectId');
  @override
  late final GeneratedColumn<int> projectId = GeneratedColumn<int>(
      'project_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _unitMeta = const VerificationMeta('unit');
  @override
  late final GeneratedColumn<String> unit = GeneratedColumn<String>(
      'unit', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _quantityMeta =
      const VerificationMeta('quantity');
  @override
  late final GeneratedColumn<double> quantity = GeneratedColumn<double>(
      'quantity', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _rateMeta = const VerificationMeta('rate');
  @override
  late final GeneratedColumn<double> rate = GeneratedColumn<double>(
      'rate', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _rawDataMeta =
      const VerificationMeta('rawData');
  @override
  late final GeneratedColumn<String> rawData = GeneratedColumn<String>(
      'raw_data', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns =>
      [id, projectId, name, unit, quantity, rate, rawData, cachedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_boq_items';
  @override
  VerificationContext validateIntegrity(Insertable<CachedBoqItem> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('project_id')) {
      context.handle(_projectIdMeta,
          projectId.isAcceptableOrUnknown(data['project_id']!, _projectIdMeta));
    } else if (isInserting) {
      context.missing(_projectIdMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('unit')) {
      context.handle(
          _unitMeta, unit.isAcceptableOrUnknown(data['unit']!, _unitMeta));
    }
    if (data.containsKey('quantity')) {
      context.handle(_quantityMeta,
          quantity.isAcceptableOrUnknown(data['quantity']!, _quantityMeta));
    } else if (isInserting) {
      context.missing(_quantityMeta);
    }
    if (data.containsKey('rate')) {
      context.handle(
          _rateMeta, rate.isAcceptableOrUnknown(data['rate']!, _rateMeta));
    }
    if (data.containsKey('raw_data')) {
      context.handle(_rawDataMeta,
          rawData.isAcceptableOrUnknown(data['raw_data']!, _rawDataMeta));
    } else if (isInserting) {
      context.missing(_rawDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedBoqItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedBoqItem(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      projectId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}project_id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      unit: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}unit']),
      quantity: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}quantity'])!,
      rate: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}rate']),
      rawData: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}raw_data'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedBoqItemsTable createAlias(String alias) {
    return $CachedBoqItemsTable(attachedDatabase, alias);
  }
}

class CachedBoqItem extends DataClass implements Insertable<CachedBoqItem> {
  final int id;
  final int projectId;
  final String name;
  final String? unit;
  final double quantity;
  final double? rate;
  final String rawData;
  final DateTime cachedAt;
  const CachedBoqItem(
      {required this.id,
      required this.projectId,
      required this.name,
      this.unit,
      required this.quantity,
      this.rate,
      required this.rawData,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['project_id'] = Variable<int>(projectId);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || unit != null) {
      map['unit'] = Variable<String>(unit);
    }
    map['quantity'] = Variable<double>(quantity);
    if (!nullToAbsent || rate != null) {
      map['rate'] = Variable<double>(rate);
    }
    map['raw_data'] = Variable<String>(rawData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedBoqItemsCompanion toCompanion(bool nullToAbsent) {
    return CachedBoqItemsCompanion(
      id: Value(id),
      projectId: Value(projectId),
      name: Value(name),
      unit: unit == null && nullToAbsent ? const Value.absent() : Value(unit),
      quantity: Value(quantity),
      rate: rate == null && nullToAbsent ? const Value.absent() : Value(rate),
      rawData: Value(rawData),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedBoqItem.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedBoqItem(
      id: serializer.fromJson<int>(json['id']),
      projectId: serializer.fromJson<int>(json['projectId']),
      name: serializer.fromJson<String>(json['name']),
      unit: serializer.fromJson<String?>(json['unit']),
      quantity: serializer.fromJson<double>(json['quantity']),
      rate: serializer.fromJson<double?>(json['rate']),
      rawData: serializer.fromJson<String>(json['rawData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'projectId': serializer.toJson<int>(projectId),
      'name': serializer.toJson<String>(name),
      'unit': serializer.toJson<String?>(unit),
      'quantity': serializer.toJson<double>(quantity),
      'rate': serializer.toJson<double?>(rate),
      'rawData': serializer.toJson<String>(rawData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedBoqItem copyWith(
          {int? id,
          int? projectId,
          String? name,
          Value<String?> unit = const Value.absent(),
          double? quantity,
          Value<double?> rate = const Value.absent(),
          String? rawData,
          DateTime? cachedAt}) =>
      CachedBoqItem(
        id: id ?? this.id,
        projectId: projectId ?? this.projectId,
        name: name ?? this.name,
        unit: unit.present ? unit.value : this.unit,
        quantity: quantity ?? this.quantity,
        rate: rate.present ? rate.value : this.rate,
        rawData: rawData ?? this.rawData,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedBoqItem copyWithCompanion(CachedBoqItemsCompanion data) {
    return CachedBoqItem(
      id: data.id.present ? data.id.value : this.id,
      projectId: data.projectId.present ? data.projectId.value : this.projectId,
      name: data.name.present ? data.name.value : this.name,
      unit: data.unit.present ? data.unit.value : this.unit,
      quantity: data.quantity.present ? data.quantity.value : this.quantity,
      rate: data.rate.present ? data.rate.value : this.rate,
      rawData: data.rawData.present ? data.rawData.value : this.rawData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedBoqItem(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('name: $name, ')
          ..write('unit: $unit, ')
          ..write('quantity: $quantity, ')
          ..write('rate: $rate, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, projectId, name, unit, quantity, rate, rawData, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedBoqItem &&
          other.id == this.id &&
          other.projectId == this.projectId &&
          other.name == this.name &&
          other.unit == this.unit &&
          other.quantity == this.quantity &&
          other.rate == this.rate &&
          other.rawData == this.rawData &&
          other.cachedAt == this.cachedAt);
}

class CachedBoqItemsCompanion extends UpdateCompanion<CachedBoqItem> {
  final Value<int> id;
  final Value<int> projectId;
  final Value<String> name;
  final Value<String?> unit;
  final Value<double> quantity;
  final Value<double?> rate;
  final Value<String> rawData;
  final Value<DateTime> cachedAt;
  const CachedBoqItemsCompanion({
    this.id = const Value.absent(),
    this.projectId = const Value.absent(),
    this.name = const Value.absent(),
    this.unit = const Value.absent(),
    this.quantity = const Value.absent(),
    this.rate = const Value.absent(),
    this.rawData = const Value.absent(),
    this.cachedAt = const Value.absent(),
  });
  CachedBoqItemsCompanion.insert({
    this.id = const Value.absent(),
    required int projectId,
    required String name,
    this.unit = const Value.absent(),
    required double quantity,
    this.rate = const Value.absent(),
    required String rawData,
    this.cachedAt = const Value.absent(),
  })  : projectId = Value(projectId),
        name = Value(name),
        quantity = Value(quantity),
        rawData = Value(rawData);
  static Insertable<CachedBoqItem> custom({
    Expression<int>? id,
    Expression<int>? projectId,
    Expression<String>? name,
    Expression<String>? unit,
    Expression<double>? quantity,
    Expression<double>? rate,
    Expression<String>? rawData,
    Expression<DateTime>? cachedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (projectId != null) 'project_id': projectId,
      if (name != null) 'name': name,
      if (unit != null) 'unit': unit,
      if (quantity != null) 'quantity': quantity,
      if (rate != null) 'rate': rate,
      if (rawData != null) 'raw_data': rawData,
      if (cachedAt != null) 'cached_at': cachedAt,
    });
  }

  CachedBoqItemsCompanion copyWith(
      {Value<int>? id,
      Value<int>? projectId,
      Value<String>? name,
      Value<String?>? unit,
      Value<double>? quantity,
      Value<double?>? rate,
      Value<String>? rawData,
      Value<DateTime>? cachedAt}) {
    return CachedBoqItemsCompanion(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      name: name ?? this.name,
      unit: unit ?? this.unit,
      quantity: quantity ?? this.quantity,
      rate: rate ?? this.rate,
      rawData: rawData ?? this.rawData,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (projectId.present) {
      map['project_id'] = Variable<int>(projectId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (unit.present) {
      map['unit'] = Variable<String>(unit.value);
    }
    if (quantity.present) {
      map['quantity'] = Variable<double>(quantity.value);
    }
    if (rate.present) {
      map['rate'] = Variable<double>(rate.value);
    }
    if (rawData.present) {
      map['raw_data'] = Variable<String>(rawData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedBoqItemsCompanion(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('name: $name, ')
          ..write('unit: $unit, ')
          ..write('quantity: $quantity, ')
          ..write('rate: $rate, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }
}

class $CachedEpsNodesTable extends CachedEpsNodes
    with TableInfo<$CachedEpsNodesTable, CachedEpsNode> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedEpsNodesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _projectIdMeta =
      const VerificationMeta('projectId');
  @override
  late final GeneratedColumn<int> projectId = GeneratedColumn<int>(
      'project_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _parentIdMeta =
      const VerificationMeta('parentId');
  @override
  late final GeneratedColumn<int> parentId = GeneratedColumn<int>(
      'parent_id', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
      'code', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
      'type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _progressMeta =
      const VerificationMeta('progress');
  @override
  late final GeneratedColumn<double> progress = GeneratedColumn<double>(
      'progress', aliasedName, false,
      type: DriftSqlType.double,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _rawDataMeta =
      const VerificationMeta('rawData');
  @override
  late final GeneratedColumn<String> rawData = GeneratedColumn<String>(
      'raw_data', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns =>
      [id, projectId, parentId, name, code, type, progress, rawData, cachedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_eps_nodes';
  @override
  VerificationContext validateIntegrity(Insertable<CachedEpsNode> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('project_id')) {
      context.handle(_projectIdMeta,
          projectId.isAcceptableOrUnknown(data['project_id']!, _projectIdMeta));
    } else if (isInserting) {
      context.missing(_projectIdMeta);
    }
    if (data.containsKey('parent_id')) {
      context.handle(_parentIdMeta,
          parentId.isAcceptableOrUnknown(data['parent_id']!, _parentIdMeta));
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('code')) {
      context.handle(
          _codeMeta, code.isAcceptableOrUnknown(data['code']!, _codeMeta));
    }
    if (data.containsKey('type')) {
      context.handle(
          _typeMeta, type.isAcceptableOrUnknown(data['type']!, _typeMeta));
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('progress')) {
      context.handle(_progressMeta,
          progress.isAcceptableOrUnknown(data['progress']!, _progressMeta));
    }
    if (data.containsKey('raw_data')) {
      context.handle(_rawDataMeta,
          rawData.isAcceptableOrUnknown(data['raw_data']!, _rawDataMeta));
    } else if (isInserting) {
      context.missing(_rawDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedEpsNode map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedEpsNode(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      projectId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}project_id'])!,
      parentId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}parent_id']),
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      code: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}code']),
      type: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}type'])!,
      progress: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}progress'])!,
      rawData: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}raw_data'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedEpsNodesTable createAlias(String alias) {
    return $CachedEpsNodesTable(attachedDatabase, alias);
  }
}

class CachedEpsNode extends DataClass implements Insertable<CachedEpsNode> {
  final int id;
  final int projectId;

  /// Null for root-level nodes; set for all child nodes.
  final int? parentId;
  final String name;
  final String? code;
  final String type;
  final double progress;
  final String rawData;
  final DateTime cachedAt;
  const CachedEpsNode(
      {required this.id,
      required this.projectId,
      this.parentId,
      required this.name,
      this.code,
      required this.type,
      required this.progress,
      required this.rawData,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['project_id'] = Variable<int>(projectId);
    if (!nullToAbsent || parentId != null) {
      map['parent_id'] = Variable<int>(parentId);
    }
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || code != null) {
      map['code'] = Variable<String>(code);
    }
    map['type'] = Variable<String>(type);
    map['progress'] = Variable<double>(progress);
    map['raw_data'] = Variable<String>(rawData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedEpsNodesCompanion toCompanion(bool nullToAbsent) {
    return CachedEpsNodesCompanion(
      id: Value(id),
      projectId: Value(projectId),
      parentId: parentId == null && nullToAbsent
          ? const Value.absent()
          : Value(parentId),
      name: Value(name),
      code: code == null && nullToAbsent ? const Value.absent() : Value(code),
      type: Value(type),
      progress: Value(progress),
      rawData: Value(rawData),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedEpsNode.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedEpsNode(
      id: serializer.fromJson<int>(json['id']),
      projectId: serializer.fromJson<int>(json['projectId']),
      parentId: serializer.fromJson<int?>(json['parentId']),
      name: serializer.fromJson<String>(json['name']),
      code: serializer.fromJson<String?>(json['code']),
      type: serializer.fromJson<String>(json['type']),
      progress: serializer.fromJson<double>(json['progress']),
      rawData: serializer.fromJson<String>(json['rawData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'projectId': serializer.toJson<int>(projectId),
      'parentId': serializer.toJson<int?>(parentId),
      'name': serializer.toJson<String>(name),
      'code': serializer.toJson<String?>(code),
      'type': serializer.toJson<String>(type),
      'progress': serializer.toJson<double>(progress),
      'rawData': serializer.toJson<String>(rawData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedEpsNode copyWith(
          {int? id,
          int? projectId,
          Value<int?> parentId = const Value.absent(),
          String? name,
          Value<String?> code = const Value.absent(),
          String? type,
          double? progress,
          String? rawData,
          DateTime? cachedAt}) =>
      CachedEpsNode(
        id: id ?? this.id,
        projectId: projectId ?? this.projectId,
        parentId: parentId.present ? parentId.value : this.parentId,
        name: name ?? this.name,
        code: code.present ? code.value : this.code,
        type: type ?? this.type,
        progress: progress ?? this.progress,
        rawData: rawData ?? this.rawData,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedEpsNode copyWithCompanion(CachedEpsNodesCompanion data) {
    return CachedEpsNode(
      id: data.id.present ? data.id.value : this.id,
      projectId: data.projectId.present ? data.projectId.value : this.projectId,
      parentId: data.parentId.present ? data.parentId.value : this.parentId,
      name: data.name.present ? data.name.value : this.name,
      code: data.code.present ? data.code.value : this.code,
      type: data.type.present ? data.type.value : this.type,
      progress: data.progress.present ? data.progress.value : this.progress,
      rawData: data.rawData.present ? data.rawData.value : this.rawData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedEpsNode(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('parentId: $parentId, ')
          ..write('name: $name, ')
          ..write('code: $code, ')
          ..write('type: $type, ')
          ..write('progress: $progress, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id, projectId, parentId, name, code, type, progress, rawData, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedEpsNode &&
          other.id == this.id &&
          other.projectId == this.projectId &&
          other.parentId == this.parentId &&
          other.name == this.name &&
          other.code == this.code &&
          other.type == this.type &&
          other.progress == this.progress &&
          other.rawData == this.rawData &&
          other.cachedAt == this.cachedAt);
}

class CachedEpsNodesCompanion extends UpdateCompanion<CachedEpsNode> {
  final Value<int> id;
  final Value<int> projectId;
  final Value<int?> parentId;
  final Value<String> name;
  final Value<String?> code;
  final Value<String> type;
  final Value<double> progress;
  final Value<String> rawData;
  final Value<DateTime> cachedAt;
  const CachedEpsNodesCompanion({
    this.id = const Value.absent(),
    this.projectId = const Value.absent(),
    this.parentId = const Value.absent(),
    this.name = const Value.absent(),
    this.code = const Value.absent(),
    this.type = const Value.absent(),
    this.progress = const Value.absent(),
    this.rawData = const Value.absent(),
    this.cachedAt = const Value.absent(),
  });
  CachedEpsNodesCompanion.insert({
    this.id = const Value.absent(),
    required int projectId,
    this.parentId = const Value.absent(),
    required String name,
    this.code = const Value.absent(),
    required String type,
    this.progress = const Value.absent(),
    required String rawData,
    this.cachedAt = const Value.absent(),
  })  : projectId = Value(projectId),
        name = Value(name),
        type = Value(type),
        rawData = Value(rawData);
  static Insertable<CachedEpsNode> custom({
    Expression<int>? id,
    Expression<int>? projectId,
    Expression<int>? parentId,
    Expression<String>? name,
    Expression<String>? code,
    Expression<String>? type,
    Expression<double>? progress,
    Expression<String>? rawData,
    Expression<DateTime>? cachedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (projectId != null) 'project_id': projectId,
      if (parentId != null) 'parent_id': parentId,
      if (name != null) 'name': name,
      if (code != null) 'code': code,
      if (type != null) 'type': type,
      if (progress != null) 'progress': progress,
      if (rawData != null) 'raw_data': rawData,
      if (cachedAt != null) 'cached_at': cachedAt,
    });
  }

  CachedEpsNodesCompanion copyWith(
      {Value<int>? id,
      Value<int>? projectId,
      Value<int?>? parentId,
      Value<String>? name,
      Value<String?>? code,
      Value<String>? type,
      Value<double>? progress,
      Value<String>? rawData,
      Value<DateTime>? cachedAt}) {
    return CachedEpsNodesCompanion(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      parentId: parentId ?? this.parentId,
      name: name ?? this.name,
      code: code ?? this.code,
      type: type ?? this.type,
      progress: progress ?? this.progress,
      rawData: rawData ?? this.rawData,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (projectId.present) {
      map['project_id'] = Variable<int>(projectId.value);
    }
    if (parentId.present) {
      map['parent_id'] = Variable<int>(parentId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (progress.present) {
      map['progress'] = Variable<double>(progress.value);
    }
    if (rawData.present) {
      map['raw_data'] = Variable<String>(rawData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedEpsNodesCompanion(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('parentId: $parentId, ')
          ..write('name: $name, ')
          ..write('code: $code, ')
          ..write('type: $type, ')
          ..write('progress: $progress, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }
}

class $CachedQualityActivityListsTable extends CachedQualityActivityLists
    with
        TableInfo<$CachedQualityActivityListsTable, CachedQualityActivityList> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedQualityActivityListsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _projectIdMeta =
      const VerificationMeta('projectId');
  @override
  late final GeneratedColumn<int> projectId = GeneratedColumn<int>(
      'project_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _epsNodeIdMeta =
      const VerificationMeta('epsNodeId');
  @override
  late final GeneratedColumn<int> epsNodeId = GeneratedColumn<int>(
      'eps_node_id', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _descriptionMeta =
      const VerificationMeta('description');
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
      'description', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _activityCountMeta =
      const VerificationMeta('activityCount');
  @override
  late final GeneratedColumn<int> activityCount = GeneratedColumn<int>(
      'activity_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _rawDataMeta =
      const VerificationMeta('rawData');
  @override
  late final GeneratedColumn<String> rawData = GeneratedColumn<String>(
      'raw_data', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        projectId,
        epsNodeId,
        name,
        description,
        activityCount,
        rawData,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_quality_activity_lists';
  @override
  VerificationContext validateIntegrity(
      Insertable<CachedQualityActivityList> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('project_id')) {
      context.handle(_projectIdMeta,
          projectId.isAcceptableOrUnknown(data['project_id']!, _projectIdMeta));
    } else if (isInserting) {
      context.missing(_projectIdMeta);
    }
    if (data.containsKey('eps_node_id')) {
      context.handle(
          _epsNodeIdMeta,
          epsNodeId.isAcceptableOrUnknown(
              data['eps_node_id']!, _epsNodeIdMeta));
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('description')) {
      context.handle(
          _descriptionMeta,
          description.isAcceptableOrUnknown(
              data['description']!, _descriptionMeta));
    }
    if (data.containsKey('activity_count')) {
      context.handle(
          _activityCountMeta,
          activityCount.isAcceptableOrUnknown(
              data['activity_count']!, _activityCountMeta));
    }
    if (data.containsKey('raw_data')) {
      context.handle(_rawDataMeta,
          rawData.isAcceptableOrUnknown(data['raw_data']!, _rawDataMeta));
    } else if (isInserting) {
      context.missing(_rawDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedQualityActivityList map(Map<String, dynamic> data,
      {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedQualityActivityList(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      projectId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}project_id'])!,
      epsNodeId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}eps_node_id']),
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      description: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}description']),
      activityCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}activity_count'])!,
      rawData: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}raw_data'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedQualityActivityListsTable createAlias(String alias) {
    return $CachedQualityActivityListsTable(attachedDatabase, alias);
  }
}

class CachedQualityActivityList extends DataClass
    implements Insertable<CachedQualityActivityList> {
  final int id;
  final int projectId;

  /// Optional — when non-null, the list is specific to this EPS node (e.g. a
  /// floor-level inspection checklist).
  final int? epsNodeId;
  final String name;
  final String? description;

  /// Denormalised count so the list view can show "12 activities" without
  /// loading the activities themselves.
  final int activityCount;
  final String rawData;
  final DateTime cachedAt;
  const CachedQualityActivityList(
      {required this.id,
      required this.projectId,
      this.epsNodeId,
      required this.name,
      this.description,
      required this.activityCount,
      required this.rawData,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['project_id'] = Variable<int>(projectId);
    if (!nullToAbsent || epsNodeId != null) {
      map['eps_node_id'] = Variable<int>(epsNodeId);
    }
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || description != null) {
      map['description'] = Variable<String>(description);
    }
    map['activity_count'] = Variable<int>(activityCount);
    map['raw_data'] = Variable<String>(rawData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedQualityActivityListsCompanion toCompanion(bool nullToAbsent) {
    return CachedQualityActivityListsCompanion(
      id: Value(id),
      projectId: Value(projectId),
      epsNodeId: epsNodeId == null && nullToAbsent
          ? const Value.absent()
          : Value(epsNodeId),
      name: Value(name),
      description: description == null && nullToAbsent
          ? const Value.absent()
          : Value(description),
      activityCount: Value(activityCount),
      rawData: Value(rawData),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedQualityActivityList.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedQualityActivityList(
      id: serializer.fromJson<int>(json['id']),
      projectId: serializer.fromJson<int>(json['projectId']),
      epsNodeId: serializer.fromJson<int?>(json['epsNodeId']),
      name: serializer.fromJson<String>(json['name']),
      description: serializer.fromJson<String?>(json['description']),
      activityCount: serializer.fromJson<int>(json['activityCount']),
      rawData: serializer.fromJson<String>(json['rawData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'projectId': serializer.toJson<int>(projectId),
      'epsNodeId': serializer.toJson<int?>(epsNodeId),
      'name': serializer.toJson<String>(name),
      'description': serializer.toJson<String?>(description),
      'activityCount': serializer.toJson<int>(activityCount),
      'rawData': serializer.toJson<String>(rawData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedQualityActivityList copyWith(
          {int? id,
          int? projectId,
          Value<int?> epsNodeId = const Value.absent(),
          String? name,
          Value<String?> description = const Value.absent(),
          int? activityCount,
          String? rawData,
          DateTime? cachedAt}) =>
      CachedQualityActivityList(
        id: id ?? this.id,
        projectId: projectId ?? this.projectId,
        epsNodeId: epsNodeId.present ? epsNodeId.value : this.epsNodeId,
        name: name ?? this.name,
        description: description.present ? description.value : this.description,
        activityCount: activityCount ?? this.activityCount,
        rawData: rawData ?? this.rawData,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedQualityActivityList copyWithCompanion(
      CachedQualityActivityListsCompanion data) {
    return CachedQualityActivityList(
      id: data.id.present ? data.id.value : this.id,
      projectId: data.projectId.present ? data.projectId.value : this.projectId,
      epsNodeId: data.epsNodeId.present ? data.epsNodeId.value : this.epsNodeId,
      name: data.name.present ? data.name.value : this.name,
      description:
          data.description.present ? data.description.value : this.description,
      activityCount: data.activityCount.present
          ? data.activityCount.value
          : this.activityCount,
      rawData: data.rawData.present ? data.rawData.value : this.rawData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedQualityActivityList(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('epsNodeId: $epsNodeId, ')
          ..write('name: $name, ')
          ..write('description: $description, ')
          ..write('activityCount: $activityCount, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, projectId, epsNodeId, name, description,
      activityCount, rawData, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedQualityActivityList &&
          other.id == this.id &&
          other.projectId == this.projectId &&
          other.epsNodeId == this.epsNodeId &&
          other.name == this.name &&
          other.description == this.description &&
          other.activityCount == this.activityCount &&
          other.rawData == this.rawData &&
          other.cachedAt == this.cachedAt);
}

class CachedQualityActivityListsCompanion
    extends UpdateCompanion<CachedQualityActivityList> {
  final Value<int> id;
  final Value<int> projectId;
  final Value<int?> epsNodeId;
  final Value<String> name;
  final Value<String?> description;
  final Value<int> activityCount;
  final Value<String> rawData;
  final Value<DateTime> cachedAt;
  const CachedQualityActivityListsCompanion({
    this.id = const Value.absent(),
    this.projectId = const Value.absent(),
    this.epsNodeId = const Value.absent(),
    this.name = const Value.absent(),
    this.description = const Value.absent(),
    this.activityCount = const Value.absent(),
    this.rawData = const Value.absent(),
    this.cachedAt = const Value.absent(),
  });
  CachedQualityActivityListsCompanion.insert({
    this.id = const Value.absent(),
    required int projectId,
    this.epsNodeId = const Value.absent(),
    required String name,
    this.description = const Value.absent(),
    this.activityCount = const Value.absent(),
    required String rawData,
    this.cachedAt = const Value.absent(),
  })  : projectId = Value(projectId),
        name = Value(name),
        rawData = Value(rawData);
  static Insertable<CachedQualityActivityList> custom({
    Expression<int>? id,
    Expression<int>? projectId,
    Expression<int>? epsNodeId,
    Expression<String>? name,
    Expression<String>? description,
    Expression<int>? activityCount,
    Expression<String>? rawData,
    Expression<DateTime>? cachedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (projectId != null) 'project_id': projectId,
      if (epsNodeId != null) 'eps_node_id': epsNodeId,
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (activityCount != null) 'activity_count': activityCount,
      if (rawData != null) 'raw_data': rawData,
      if (cachedAt != null) 'cached_at': cachedAt,
    });
  }

  CachedQualityActivityListsCompanion copyWith(
      {Value<int>? id,
      Value<int>? projectId,
      Value<int?>? epsNodeId,
      Value<String>? name,
      Value<String?>? description,
      Value<int>? activityCount,
      Value<String>? rawData,
      Value<DateTime>? cachedAt}) {
    return CachedQualityActivityListsCompanion(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      epsNodeId: epsNodeId ?? this.epsNodeId,
      name: name ?? this.name,
      description: description ?? this.description,
      activityCount: activityCount ?? this.activityCount,
      rawData: rawData ?? this.rawData,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (projectId.present) {
      map['project_id'] = Variable<int>(projectId.value);
    }
    if (epsNodeId.present) {
      map['eps_node_id'] = Variable<int>(epsNodeId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (activityCount.present) {
      map['activity_count'] = Variable<int>(activityCount.value);
    }
    if (rawData.present) {
      map['raw_data'] = Variable<String>(rawData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedQualityActivityListsCompanion(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('epsNodeId: $epsNodeId, ')
          ..write('name: $name, ')
          ..write('description: $description, ')
          ..write('activityCount: $activityCount, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }
}

class $CachedQualityActivitiesTable extends CachedQualityActivities
    with TableInfo<$CachedQualityActivitiesTable, CachedQualityActivity> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedQualityActivitiesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _listIdMeta = const VerificationMeta('listId');
  @override
  late final GeneratedColumn<int> listId = GeneratedColumn<int>(
      'list_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _projectIdMeta =
      const VerificationMeta('projectId');
  @override
  late final GeneratedColumn<int> projectId = GeneratedColumn<int>(
      'project_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _epsNodeIdMeta =
      const VerificationMeta('epsNodeId');
  @override
  late final GeneratedColumn<int> epsNodeId = GeneratedColumn<int>(
      'eps_node_id', aliasedName, true,
      type: DriftSqlType.int, requiredDuringInsert: false);
  static const VerificationMeta _sequenceMeta =
      const VerificationMeta('sequence');
  @override
  late final GeneratedColumn<int> sequence = GeneratedColumn<int>(
      'sequence', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _activityNameMeta =
      const VerificationMeta('activityName');
  @override
  late final GeneratedColumn<String> activityName = GeneratedColumn<String>(
      'activity_name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('NOT_STARTED'));
  static const VerificationMeta _holdPointMeta =
      const VerificationMeta('holdPoint');
  @override
  late final GeneratedColumn<int> holdPoint = GeneratedColumn<int>(
      'hold_point', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _witnessPointMeta =
      const VerificationMeta('witnessPoint');
  @override
  late final GeneratedColumn<int> witnessPoint = GeneratedColumn<int>(
      'witness_point', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _rawDataMeta =
      const VerificationMeta('rawData');
  @override
  late final GeneratedColumn<String> rawData = GeneratedColumn<String>(
      'raw_data', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        listId,
        projectId,
        epsNodeId,
        sequence,
        activityName,
        status,
        holdPoint,
        witnessPoint,
        rawData,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_quality_activities';
  @override
  VerificationContext validateIntegrity(
      Insertable<CachedQualityActivity> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('list_id')) {
      context.handle(_listIdMeta,
          listId.isAcceptableOrUnknown(data['list_id']!, _listIdMeta));
    } else if (isInserting) {
      context.missing(_listIdMeta);
    }
    if (data.containsKey('project_id')) {
      context.handle(_projectIdMeta,
          projectId.isAcceptableOrUnknown(data['project_id']!, _projectIdMeta));
    } else if (isInserting) {
      context.missing(_projectIdMeta);
    }
    if (data.containsKey('eps_node_id')) {
      context.handle(
          _epsNodeIdMeta,
          epsNodeId.isAcceptableOrUnknown(
              data['eps_node_id']!, _epsNodeIdMeta));
    }
    if (data.containsKey('sequence')) {
      context.handle(_sequenceMeta,
          sequence.isAcceptableOrUnknown(data['sequence']!, _sequenceMeta));
    }
    if (data.containsKey('activity_name')) {
      context.handle(
          _activityNameMeta,
          activityName.isAcceptableOrUnknown(
              data['activity_name']!, _activityNameMeta));
    } else if (isInserting) {
      context.missing(_activityNameMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('hold_point')) {
      context.handle(_holdPointMeta,
          holdPoint.isAcceptableOrUnknown(data['hold_point']!, _holdPointMeta));
    }
    if (data.containsKey('witness_point')) {
      context.handle(
          _witnessPointMeta,
          witnessPoint.isAcceptableOrUnknown(
              data['witness_point']!, _witnessPointMeta));
    }
    if (data.containsKey('raw_data')) {
      context.handle(_rawDataMeta,
          rawData.isAcceptableOrUnknown(data['raw_data']!, _rawDataMeta));
    } else if (isInserting) {
      context.missing(_rawDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedQualityActivity map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedQualityActivity(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      listId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}list_id'])!,
      projectId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}project_id'])!,
      epsNodeId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}eps_node_id']),
      sequence: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}sequence'])!,
      activityName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}activity_name'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      holdPoint: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}hold_point'])!,
      witnessPoint: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}witness_point'])!,
      rawData: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}raw_data'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedQualityActivitiesTable createAlias(String alias) {
    return $CachedQualityActivitiesTable(attachedDatabase, alias);
  }
}

class CachedQualityActivity extends DataClass
    implements Insertable<CachedQualityActivity> {
  final int id;
  final int listId;
  final int projectId;
  final int? epsNodeId;

  /// Display order within the checklist — the UI sorts ascending by this value.
  final int sequence;
  final String activityName;

  /// Lifecycle state: NOT_STARTED → IN_PROGRESS → PENDING_INSPECTION →
  /// APPROVED / REJECTED.
  final String status;

  /// 1 if this is a hold point (work must stop until approved), else 0.
  final int holdPoint;

  /// 1 if this is a witness point (third party should observe), else 0.
  final int witnessPoint;
  final String rawData;
  final DateTime cachedAt;
  const CachedQualityActivity(
      {required this.id,
      required this.listId,
      required this.projectId,
      this.epsNodeId,
      required this.sequence,
      required this.activityName,
      required this.status,
      required this.holdPoint,
      required this.witnessPoint,
      required this.rawData,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['list_id'] = Variable<int>(listId);
    map['project_id'] = Variable<int>(projectId);
    if (!nullToAbsent || epsNodeId != null) {
      map['eps_node_id'] = Variable<int>(epsNodeId);
    }
    map['sequence'] = Variable<int>(sequence);
    map['activity_name'] = Variable<String>(activityName);
    map['status'] = Variable<String>(status);
    map['hold_point'] = Variable<int>(holdPoint);
    map['witness_point'] = Variable<int>(witnessPoint);
    map['raw_data'] = Variable<String>(rawData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedQualityActivitiesCompanion toCompanion(bool nullToAbsent) {
    return CachedQualityActivitiesCompanion(
      id: Value(id),
      listId: Value(listId),
      projectId: Value(projectId),
      epsNodeId: epsNodeId == null && nullToAbsent
          ? const Value.absent()
          : Value(epsNodeId),
      sequence: Value(sequence),
      activityName: Value(activityName),
      status: Value(status),
      holdPoint: Value(holdPoint),
      witnessPoint: Value(witnessPoint),
      rawData: Value(rawData),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedQualityActivity.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedQualityActivity(
      id: serializer.fromJson<int>(json['id']),
      listId: serializer.fromJson<int>(json['listId']),
      projectId: serializer.fromJson<int>(json['projectId']),
      epsNodeId: serializer.fromJson<int?>(json['epsNodeId']),
      sequence: serializer.fromJson<int>(json['sequence']),
      activityName: serializer.fromJson<String>(json['activityName']),
      status: serializer.fromJson<String>(json['status']),
      holdPoint: serializer.fromJson<int>(json['holdPoint']),
      witnessPoint: serializer.fromJson<int>(json['witnessPoint']),
      rawData: serializer.fromJson<String>(json['rawData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'listId': serializer.toJson<int>(listId),
      'projectId': serializer.toJson<int>(projectId),
      'epsNodeId': serializer.toJson<int?>(epsNodeId),
      'sequence': serializer.toJson<int>(sequence),
      'activityName': serializer.toJson<String>(activityName),
      'status': serializer.toJson<String>(status),
      'holdPoint': serializer.toJson<int>(holdPoint),
      'witnessPoint': serializer.toJson<int>(witnessPoint),
      'rawData': serializer.toJson<String>(rawData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedQualityActivity copyWith(
          {int? id,
          int? listId,
          int? projectId,
          Value<int?> epsNodeId = const Value.absent(),
          int? sequence,
          String? activityName,
          String? status,
          int? holdPoint,
          int? witnessPoint,
          String? rawData,
          DateTime? cachedAt}) =>
      CachedQualityActivity(
        id: id ?? this.id,
        listId: listId ?? this.listId,
        projectId: projectId ?? this.projectId,
        epsNodeId: epsNodeId.present ? epsNodeId.value : this.epsNodeId,
        sequence: sequence ?? this.sequence,
        activityName: activityName ?? this.activityName,
        status: status ?? this.status,
        holdPoint: holdPoint ?? this.holdPoint,
        witnessPoint: witnessPoint ?? this.witnessPoint,
        rawData: rawData ?? this.rawData,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedQualityActivity copyWithCompanion(
      CachedQualityActivitiesCompanion data) {
    return CachedQualityActivity(
      id: data.id.present ? data.id.value : this.id,
      listId: data.listId.present ? data.listId.value : this.listId,
      projectId: data.projectId.present ? data.projectId.value : this.projectId,
      epsNodeId: data.epsNodeId.present ? data.epsNodeId.value : this.epsNodeId,
      sequence: data.sequence.present ? data.sequence.value : this.sequence,
      activityName: data.activityName.present
          ? data.activityName.value
          : this.activityName,
      status: data.status.present ? data.status.value : this.status,
      holdPoint: data.holdPoint.present ? data.holdPoint.value : this.holdPoint,
      witnessPoint: data.witnessPoint.present
          ? data.witnessPoint.value
          : this.witnessPoint,
      rawData: data.rawData.present ? data.rawData.value : this.rawData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedQualityActivity(')
          ..write('id: $id, ')
          ..write('listId: $listId, ')
          ..write('projectId: $projectId, ')
          ..write('epsNodeId: $epsNodeId, ')
          ..write('sequence: $sequence, ')
          ..write('activityName: $activityName, ')
          ..write('status: $status, ')
          ..write('holdPoint: $holdPoint, ')
          ..write('witnessPoint: $witnessPoint, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, listId, projectId, epsNodeId, sequence,
      activityName, status, holdPoint, witnessPoint, rawData, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedQualityActivity &&
          other.id == this.id &&
          other.listId == this.listId &&
          other.projectId == this.projectId &&
          other.epsNodeId == this.epsNodeId &&
          other.sequence == this.sequence &&
          other.activityName == this.activityName &&
          other.status == this.status &&
          other.holdPoint == this.holdPoint &&
          other.witnessPoint == this.witnessPoint &&
          other.rawData == this.rawData &&
          other.cachedAt == this.cachedAt);
}

class CachedQualityActivitiesCompanion
    extends UpdateCompanion<CachedQualityActivity> {
  final Value<int> id;
  final Value<int> listId;
  final Value<int> projectId;
  final Value<int?> epsNodeId;
  final Value<int> sequence;
  final Value<String> activityName;
  final Value<String> status;
  final Value<int> holdPoint;
  final Value<int> witnessPoint;
  final Value<String> rawData;
  final Value<DateTime> cachedAt;
  const CachedQualityActivitiesCompanion({
    this.id = const Value.absent(),
    this.listId = const Value.absent(),
    this.projectId = const Value.absent(),
    this.epsNodeId = const Value.absent(),
    this.sequence = const Value.absent(),
    this.activityName = const Value.absent(),
    this.status = const Value.absent(),
    this.holdPoint = const Value.absent(),
    this.witnessPoint = const Value.absent(),
    this.rawData = const Value.absent(),
    this.cachedAt = const Value.absent(),
  });
  CachedQualityActivitiesCompanion.insert({
    this.id = const Value.absent(),
    required int listId,
    required int projectId,
    this.epsNodeId = const Value.absent(),
    this.sequence = const Value.absent(),
    required String activityName,
    this.status = const Value.absent(),
    this.holdPoint = const Value.absent(),
    this.witnessPoint = const Value.absent(),
    required String rawData,
    this.cachedAt = const Value.absent(),
  })  : listId = Value(listId),
        projectId = Value(projectId),
        activityName = Value(activityName),
        rawData = Value(rawData);
  static Insertable<CachedQualityActivity> custom({
    Expression<int>? id,
    Expression<int>? listId,
    Expression<int>? projectId,
    Expression<int>? epsNodeId,
    Expression<int>? sequence,
    Expression<String>? activityName,
    Expression<String>? status,
    Expression<int>? holdPoint,
    Expression<int>? witnessPoint,
    Expression<String>? rawData,
    Expression<DateTime>? cachedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (listId != null) 'list_id': listId,
      if (projectId != null) 'project_id': projectId,
      if (epsNodeId != null) 'eps_node_id': epsNodeId,
      if (sequence != null) 'sequence': sequence,
      if (activityName != null) 'activity_name': activityName,
      if (status != null) 'status': status,
      if (holdPoint != null) 'hold_point': holdPoint,
      if (witnessPoint != null) 'witness_point': witnessPoint,
      if (rawData != null) 'raw_data': rawData,
      if (cachedAt != null) 'cached_at': cachedAt,
    });
  }

  CachedQualityActivitiesCompanion copyWith(
      {Value<int>? id,
      Value<int>? listId,
      Value<int>? projectId,
      Value<int?>? epsNodeId,
      Value<int>? sequence,
      Value<String>? activityName,
      Value<String>? status,
      Value<int>? holdPoint,
      Value<int>? witnessPoint,
      Value<String>? rawData,
      Value<DateTime>? cachedAt}) {
    return CachedQualityActivitiesCompanion(
      id: id ?? this.id,
      listId: listId ?? this.listId,
      projectId: projectId ?? this.projectId,
      epsNodeId: epsNodeId ?? this.epsNodeId,
      sequence: sequence ?? this.sequence,
      activityName: activityName ?? this.activityName,
      status: status ?? this.status,
      holdPoint: holdPoint ?? this.holdPoint,
      witnessPoint: witnessPoint ?? this.witnessPoint,
      rawData: rawData ?? this.rawData,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (listId.present) {
      map['list_id'] = Variable<int>(listId.value);
    }
    if (projectId.present) {
      map['project_id'] = Variable<int>(projectId.value);
    }
    if (epsNodeId.present) {
      map['eps_node_id'] = Variable<int>(epsNodeId.value);
    }
    if (sequence.present) {
      map['sequence'] = Variable<int>(sequence.value);
    }
    if (activityName.present) {
      map['activity_name'] = Variable<String>(activityName.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (holdPoint.present) {
      map['hold_point'] = Variable<int>(holdPoint.value);
    }
    if (witnessPoint.present) {
      map['witness_point'] = Variable<int>(witnessPoint.value);
    }
    if (rawData.present) {
      map['raw_data'] = Variable<String>(rawData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedQualityActivitiesCompanion(')
          ..write('id: $id, ')
          ..write('listId: $listId, ')
          ..write('projectId: $projectId, ')
          ..write('epsNodeId: $epsNodeId, ')
          ..write('sequence: $sequence, ')
          ..write('activityName: $activityName, ')
          ..write('status: $status, ')
          ..write('holdPoint: $holdPoint, ')
          ..write('witnessPoint: $witnessPoint, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }
}

class $CachedQualitySiteObsTable extends CachedQualitySiteObs
    with TableInfo<$CachedQualitySiteObsTable, CachedQualitySiteOb> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedQualitySiteObsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _projectIdMeta =
      const VerificationMeta('projectId');
  @override
  late final GeneratedColumn<int> projectId = GeneratedColumn<int>(
      'project_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _severityMeta =
      const VerificationMeta('severity');
  @override
  late final GeneratedColumn<String> severity = GeneratedColumn<String>(
      'severity', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _rawDataMeta =
      const VerificationMeta('rawData');
  @override
  late final GeneratedColumn<String> rawData = GeneratedColumn<String>(
      'raw_data', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns =>
      [id, projectId, status, severity, rawData, cachedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_quality_site_obs';
  @override
  VerificationContext validateIntegrity(
      Insertable<CachedQualitySiteOb> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('project_id')) {
      context.handle(_projectIdMeta,
          projectId.isAcceptableOrUnknown(data['project_id']!, _projectIdMeta));
    } else if (isInserting) {
      context.missing(_projectIdMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('severity')) {
      context.handle(_severityMeta,
          severity.isAcceptableOrUnknown(data['severity']!, _severityMeta));
    }
    if (data.containsKey('raw_data')) {
      context.handle(_rawDataMeta,
          rawData.isAcceptableOrUnknown(data['raw_data']!, _rawDataMeta));
    } else if (isInserting) {
      context.missing(_rawDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedQualitySiteOb map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedQualitySiteOb(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      projectId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}project_id'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      severity: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}severity']),
      rawData: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}raw_data'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedQualitySiteObsTable createAlias(String alias) {
    return $CachedQualitySiteObsTable(attachedDatabase, alias);
  }
}

class CachedQualitySiteOb extends DataClass
    implements Insertable<CachedQualitySiteOb> {
  /// UUID assigned by the server — stored as text to avoid int overflow on
  /// 64-bit UUIDs and to match the server's string type.
  final String id;
  final int projectId;
  final String status;
  final String? severity;
  final String rawData;
  final DateTime cachedAt;
  const CachedQualitySiteOb(
      {required this.id,
      required this.projectId,
      required this.status,
      this.severity,
      required this.rawData,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['project_id'] = Variable<int>(projectId);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || severity != null) {
      map['severity'] = Variable<String>(severity);
    }
    map['raw_data'] = Variable<String>(rawData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedQualitySiteObsCompanion toCompanion(bool nullToAbsent) {
    return CachedQualitySiteObsCompanion(
      id: Value(id),
      projectId: Value(projectId),
      status: Value(status),
      severity: severity == null && nullToAbsent
          ? const Value.absent()
          : Value(severity),
      rawData: Value(rawData),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedQualitySiteOb.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedQualitySiteOb(
      id: serializer.fromJson<String>(json['id']),
      projectId: serializer.fromJson<int>(json['projectId']),
      status: serializer.fromJson<String>(json['status']),
      severity: serializer.fromJson<String?>(json['severity']),
      rawData: serializer.fromJson<String>(json['rawData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'projectId': serializer.toJson<int>(projectId),
      'status': serializer.toJson<String>(status),
      'severity': serializer.toJson<String?>(severity),
      'rawData': serializer.toJson<String>(rawData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedQualitySiteOb copyWith(
          {String? id,
          int? projectId,
          String? status,
          Value<String?> severity = const Value.absent(),
          String? rawData,
          DateTime? cachedAt}) =>
      CachedQualitySiteOb(
        id: id ?? this.id,
        projectId: projectId ?? this.projectId,
        status: status ?? this.status,
        severity: severity.present ? severity.value : this.severity,
        rawData: rawData ?? this.rawData,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedQualitySiteOb copyWithCompanion(CachedQualitySiteObsCompanion data) {
    return CachedQualitySiteOb(
      id: data.id.present ? data.id.value : this.id,
      projectId: data.projectId.present ? data.projectId.value : this.projectId,
      status: data.status.present ? data.status.value : this.status,
      severity: data.severity.present ? data.severity.value : this.severity,
      rawData: data.rawData.present ? data.rawData.value : this.rawData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedQualitySiteOb(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('status: $status, ')
          ..write('severity: $severity, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, projectId, status, severity, rawData, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedQualitySiteOb &&
          other.id == this.id &&
          other.projectId == this.projectId &&
          other.status == this.status &&
          other.severity == this.severity &&
          other.rawData == this.rawData &&
          other.cachedAt == this.cachedAt);
}

class CachedQualitySiteObsCompanion
    extends UpdateCompanion<CachedQualitySiteOb> {
  final Value<String> id;
  final Value<int> projectId;
  final Value<String> status;
  final Value<String?> severity;
  final Value<String> rawData;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedQualitySiteObsCompanion({
    this.id = const Value.absent(),
    this.projectId = const Value.absent(),
    this.status = const Value.absent(),
    this.severity = const Value.absent(),
    this.rawData = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedQualitySiteObsCompanion.insert({
    required String id,
    required int projectId,
    required String status,
    this.severity = const Value.absent(),
    required String rawData,
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        projectId = Value(projectId),
        status = Value(status),
        rawData = Value(rawData);
  static Insertable<CachedQualitySiteOb> custom({
    Expression<String>? id,
    Expression<int>? projectId,
    Expression<String>? status,
    Expression<String>? severity,
    Expression<String>? rawData,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (projectId != null) 'project_id': projectId,
      if (status != null) 'status': status,
      if (severity != null) 'severity': severity,
      if (rawData != null) 'raw_data': rawData,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedQualitySiteObsCompanion copyWith(
      {Value<String>? id,
      Value<int>? projectId,
      Value<String>? status,
      Value<String?>? severity,
      Value<String>? rawData,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedQualitySiteObsCompanion(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      status: status ?? this.status,
      severity: severity ?? this.severity,
      rawData: rawData ?? this.rawData,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (projectId.present) {
      map['project_id'] = Variable<int>(projectId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (severity.present) {
      map['severity'] = Variable<String>(severity.value);
    }
    if (rawData.present) {
      map['raw_data'] = Variable<String>(rawData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedQualitySiteObsCompanion(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('status: $status, ')
          ..write('severity: $severity, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedEhsSiteObsTable extends CachedEhsSiteObs
    with TableInfo<$CachedEhsSiteObsTable, CachedEhsSiteOb> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedEhsSiteObsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _projectIdMeta =
      const VerificationMeta('projectId');
  @override
  late final GeneratedColumn<int> projectId = GeneratedColumn<int>(
      'project_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _severityMeta =
      const VerificationMeta('severity');
  @override
  late final GeneratedColumn<String> severity = GeneratedColumn<String>(
      'severity', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _rawDataMeta =
      const VerificationMeta('rawData');
  @override
  late final GeneratedColumn<String> rawData = GeneratedColumn<String>(
      'raw_data', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns =>
      [id, projectId, status, severity, rawData, cachedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_ehs_site_obs';
  @override
  VerificationContext validateIntegrity(Insertable<CachedEhsSiteOb> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('project_id')) {
      context.handle(_projectIdMeta,
          projectId.isAcceptableOrUnknown(data['project_id']!, _projectIdMeta));
    } else if (isInserting) {
      context.missing(_projectIdMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('severity')) {
      context.handle(_severityMeta,
          severity.isAcceptableOrUnknown(data['severity']!, _severityMeta));
    }
    if (data.containsKey('raw_data')) {
      context.handle(_rawDataMeta,
          rawData.isAcceptableOrUnknown(data['raw_data']!, _rawDataMeta));
    } else if (isInserting) {
      context.missing(_rawDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedEhsSiteOb map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedEhsSiteOb(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      projectId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}project_id'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      severity: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}severity']),
      rawData: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}raw_data'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $CachedEhsSiteObsTable createAlias(String alias) {
    return $CachedEhsSiteObsTable(attachedDatabase, alias);
  }
}

class CachedEhsSiteOb extends DataClass implements Insertable<CachedEhsSiteOb> {
  final String id;
  final int projectId;
  final String status;
  final String? severity;
  final String rawData;
  final DateTime cachedAt;
  const CachedEhsSiteOb(
      {required this.id,
      required this.projectId,
      required this.status,
      this.severity,
      required this.rawData,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['project_id'] = Variable<int>(projectId);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || severity != null) {
      map['severity'] = Variable<String>(severity);
    }
    map['raw_data'] = Variable<String>(rawData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    return map;
  }

  CachedEhsSiteObsCompanion toCompanion(bool nullToAbsent) {
    return CachedEhsSiteObsCompanion(
      id: Value(id),
      projectId: Value(projectId),
      status: Value(status),
      severity: severity == null && nullToAbsent
          ? const Value.absent()
          : Value(severity),
      rawData: Value(rawData),
      cachedAt: Value(cachedAt),
    );
  }

  factory CachedEhsSiteOb.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedEhsSiteOb(
      id: serializer.fromJson<String>(json['id']),
      projectId: serializer.fromJson<int>(json['projectId']),
      status: serializer.fromJson<String>(json['status']),
      severity: serializer.fromJson<String?>(json['severity']),
      rawData: serializer.fromJson<String>(json['rawData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'projectId': serializer.toJson<int>(projectId),
      'status': serializer.toJson<String>(status),
      'severity': serializer.toJson<String?>(severity),
      'rawData': serializer.toJson<String>(rawData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
    };
  }

  CachedEhsSiteOb copyWith(
          {String? id,
          int? projectId,
          String? status,
          Value<String?> severity = const Value.absent(),
          String? rawData,
          DateTime? cachedAt}) =>
      CachedEhsSiteOb(
        id: id ?? this.id,
        projectId: projectId ?? this.projectId,
        status: status ?? this.status,
        severity: severity.present ? severity.value : this.severity,
        rawData: rawData ?? this.rawData,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  CachedEhsSiteOb copyWithCompanion(CachedEhsSiteObsCompanion data) {
    return CachedEhsSiteOb(
      id: data.id.present ? data.id.value : this.id,
      projectId: data.projectId.present ? data.projectId.value : this.projectId,
      status: data.status.present ? data.status.value : this.status,
      severity: data.severity.present ? data.severity.value : this.severity,
      rawData: data.rawData.present ? data.rawData.value : this.rawData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedEhsSiteOb(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('status: $status, ')
          ..write('severity: $severity, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, projectId, status, severity, rawData, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedEhsSiteOb &&
          other.id == this.id &&
          other.projectId == this.projectId &&
          other.status == this.status &&
          other.severity == this.severity &&
          other.rawData == this.rawData &&
          other.cachedAt == this.cachedAt);
}

class CachedEhsSiteObsCompanion extends UpdateCompanion<CachedEhsSiteOb> {
  final Value<String> id;
  final Value<int> projectId;
  final Value<String> status;
  final Value<String?> severity;
  final Value<String> rawData;
  final Value<DateTime> cachedAt;
  final Value<int> rowid;
  const CachedEhsSiteObsCompanion({
    this.id = const Value.absent(),
    this.projectId = const Value.absent(),
    this.status = const Value.absent(),
    this.severity = const Value.absent(),
    this.rawData = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedEhsSiteObsCompanion.insert({
    required String id,
    required int projectId,
    required String status,
    this.severity = const Value.absent(),
    required String rawData,
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        projectId = Value(projectId),
        status = Value(status),
        rawData = Value(rawData);
  static Insertable<CachedEhsSiteOb> custom({
    Expression<String>? id,
    Expression<int>? projectId,
    Expression<String>? status,
    Expression<String>? severity,
    Expression<String>? rawData,
    Expression<DateTime>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (projectId != null) 'project_id': projectId,
      if (status != null) 'status': status,
      if (severity != null) 'severity': severity,
      if (rawData != null) 'raw_data': rawData,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedEhsSiteObsCompanion copyWith(
      {Value<String>? id,
      Value<int>? projectId,
      Value<String>? status,
      Value<String?>? severity,
      Value<String>? rawData,
      Value<DateTime>? cachedAt,
      Value<int>? rowid}) {
    return CachedEhsSiteObsCompanion(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      status: status ?? this.status,
      severity: severity ?? this.severity,
      rawData: rawData ?? this.rawData,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (projectId.present) {
      map['project_id'] = Variable<int>(projectId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (severity.present) {
      map['severity'] = Variable<String>(severity.value);
    }
    if (rawData.present) {
      map['raw_data'] = Variable<String>(rawData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedEhsSiteObsCompanion(')
          ..write('id: $id, ')
          ..write('projectId: $projectId, ')
          ..write('status: $status, ')
          ..write('severity: $severity, ')
          ..write('rawData: $rawData, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $ProgressEntriesTable progressEntries =
      $ProgressEntriesTable(this);
  late final $DailyLogsTable dailyLogs = $DailyLogsTable(this);
  late final $SyncQueueTable syncQueue = $SyncQueueTable(this);
  late final $CachedProjectsTable cachedProjects = $CachedProjectsTable(this);
  late final $CachedActivitiesTable cachedActivities =
      $CachedActivitiesTable(this);
  late final $CachedBoqItemsTable cachedBoqItems = $CachedBoqItemsTable(this);
  late final $CachedEpsNodesTable cachedEpsNodes = $CachedEpsNodesTable(this);
  late final $CachedQualityActivityListsTable cachedQualityActivityLists =
      $CachedQualityActivityListsTable(this);
  late final $CachedQualityActivitiesTable cachedQualityActivities =
      $CachedQualityActivitiesTable(this);
  late final $CachedQualitySiteObsTable cachedQualitySiteObs =
      $CachedQualitySiteObsTable(this);
  late final $CachedEhsSiteObsTable cachedEhsSiteObs =
      $CachedEhsSiteObsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
        progressEntries,
        dailyLogs,
        syncQueue,
        cachedProjects,
        cachedActivities,
        cachedBoqItems,
        cachedEpsNodes,
        cachedQualityActivityLists,
        cachedQualityActivities,
        cachedQualitySiteObs,
        cachedEhsSiteObs
      ];
}

typedef $$ProgressEntriesTableCreateCompanionBuilder = ProgressEntriesCompanion
    Function({
  Value<int> id,
  Value<int?> serverId,
  required int projectId,
  required int activityId,
  required int epsNodeId,
  required int boqItemId,
  Value<int?> microActivityId,
  required double quantity,
  required String date,
  Value<String?> remarks,
  Value<String?> photoPaths,
  Value<int> syncStatus,
  Value<DateTime> createdAt,
  Value<DateTime?> syncedAt,
  Value<String?> syncError,
  Value<int> retryCount,
  Value<String?> idempotencyKey,
  Value<DateTime?> serverUpdatedAt,
  Value<DateTime> localUpdatedAt,
  Value<int> isDeleted,
});
typedef $$ProgressEntriesTableUpdateCompanionBuilder = ProgressEntriesCompanion
    Function({
  Value<int> id,
  Value<int?> serverId,
  Value<int> projectId,
  Value<int> activityId,
  Value<int> epsNodeId,
  Value<int> boqItemId,
  Value<int?> microActivityId,
  Value<double> quantity,
  Value<String> date,
  Value<String?> remarks,
  Value<String?> photoPaths,
  Value<int> syncStatus,
  Value<DateTime> createdAt,
  Value<DateTime?> syncedAt,
  Value<String?> syncError,
  Value<int> retryCount,
  Value<String?> idempotencyKey,
  Value<DateTime?> serverUpdatedAt,
  Value<DateTime> localUpdatedAt,
  Value<int> isDeleted,
});

class $$ProgressEntriesTableFilterComposer
    extends Composer<_$AppDatabase, $ProgressEntriesTable> {
  $$ProgressEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get serverId => $composableBuilder(
      column: $table.serverId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get activityId => $composableBuilder(
      column: $table.activityId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get epsNodeId => $composableBuilder(
      column: $table.epsNodeId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get boqItemId => $composableBuilder(
      column: $table.boqItemId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get microActivityId => $composableBuilder(
      column: $table.microActivityId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get quantity => $composableBuilder(
      column: $table.quantity, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get date => $composableBuilder(
      column: $table.date, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get remarks => $composableBuilder(
      column: $table.remarks, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get photoPaths => $composableBuilder(
      column: $table.photoPaths, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get syncedAt => $composableBuilder(
      column: $table.syncedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get syncError => $composableBuilder(
      column: $table.syncError, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get idempotencyKey => $composableBuilder(
      column: $table.idempotencyKey,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get serverUpdatedAt => $composableBuilder(
      column: $table.serverUpdatedAt,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get localUpdatedAt => $composableBuilder(
      column: $table.localUpdatedAt,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get isDeleted => $composableBuilder(
      column: $table.isDeleted, builder: (column) => ColumnFilters(column));
}

class $$ProgressEntriesTableOrderingComposer
    extends Composer<_$AppDatabase, $ProgressEntriesTable> {
  $$ProgressEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get serverId => $composableBuilder(
      column: $table.serverId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get activityId => $composableBuilder(
      column: $table.activityId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get epsNodeId => $composableBuilder(
      column: $table.epsNodeId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get boqItemId => $composableBuilder(
      column: $table.boqItemId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get microActivityId => $composableBuilder(
      column: $table.microActivityId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get quantity => $composableBuilder(
      column: $table.quantity, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get date => $composableBuilder(
      column: $table.date, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get remarks => $composableBuilder(
      column: $table.remarks, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get photoPaths => $composableBuilder(
      column: $table.photoPaths, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get syncedAt => $composableBuilder(
      column: $table.syncedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get syncError => $composableBuilder(
      column: $table.syncError, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get idempotencyKey => $composableBuilder(
      column: $table.idempotencyKey,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get serverUpdatedAt => $composableBuilder(
      column: $table.serverUpdatedAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get localUpdatedAt => $composableBuilder(
      column: $table.localUpdatedAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get isDeleted => $composableBuilder(
      column: $table.isDeleted, builder: (column) => ColumnOrderings(column));
}

class $$ProgressEntriesTableAnnotationComposer
    extends Composer<_$AppDatabase, $ProgressEntriesTable> {
  $$ProgressEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get serverId =>
      $composableBuilder(column: $table.serverId, builder: (column) => column);

  GeneratedColumn<int> get projectId =>
      $composableBuilder(column: $table.projectId, builder: (column) => column);

  GeneratedColumn<int> get activityId => $composableBuilder(
      column: $table.activityId, builder: (column) => column);

  GeneratedColumn<int> get epsNodeId =>
      $composableBuilder(column: $table.epsNodeId, builder: (column) => column);

  GeneratedColumn<int> get boqItemId =>
      $composableBuilder(column: $table.boqItemId, builder: (column) => column);

  GeneratedColumn<int> get microActivityId => $composableBuilder(
      column: $table.microActivityId, builder: (column) => column);

  GeneratedColumn<double> get quantity =>
      $composableBuilder(column: $table.quantity, builder: (column) => column);

  GeneratedColumn<String> get date =>
      $composableBuilder(column: $table.date, builder: (column) => column);

  GeneratedColumn<String> get remarks =>
      $composableBuilder(column: $table.remarks, builder: (column) => column);

  GeneratedColumn<String> get photoPaths => $composableBuilder(
      column: $table.photoPaths, builder: (column) => column);

  GeneratedColumn<int> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get syncedAt =>
      $composableBuilder(column: $table.syncedAt, builder: (column) => column);

  GeneratedColumn<String> get syncError =>
      $composableBuilder(column: $table.syncError, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => column);

  GeneratedColumn<String> get idempotencyKey => $composableBuilder(
      column: $table.idempotencyKey, builder: (column) => column);

  GeneratedColumn<DateTime> get serverUpdatedAt => $composableBuilder(
      column: $table.serverUpdatedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get localUpdatedAt => $composableBuilder(
      column: $table.localUpdatedAt, builder: (column) => column);

  GeneratedColumn<int> get isDeleted =>
      $composableBuilder(column: $table.isDeleted, builder: (column) => column);
}

class $$ProgressEntriesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $ProgressEntriesTable,
    ProgressEntry,
    $$ProgressEntriesTableFilterComposer,
    $$ProgressEntriesTableOrderingComposer,
    $$ProgressEntriesTableAnnotationComposer,
    $$ProgressEntriesTableCreateCompanionBuilder,
    $$ProgressEntriesTableUpdateCompanionBuilder,
    (
      ProgressEntry,
      BaseReferences<_$AppDatabase, $ProgressEntriesTable, ProgressEntry>
    ),
    ProgressEntry,
    PrefetchHooks Function()> {
  $$ProgressEntriesTableTableManager(
      _$AppDatabase db, $ProgressEntriesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ProgressEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ProgressEntriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ProgressEntriesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int?> serverId = const Value.absent(),
            Value<int> projectId = const Value.absent(),
            Value<int> activityId = const Value.absent(),
            Value<int> epsNodeId = const Value.absent(),
            Value<int> boqItemId = const Value.absent(),
            Value<int?> microActivityId = const Value.absent(),
            Value<double> quantity = const Value.absent(),
            Value<String> date = const Value.absent(),
            Value<String?> remarks = const Value.absent(),
            Value<String?> photoPaths = const Value.absent(),
            Value<int> syncStatus = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> syncedAt = const Value.absent(),
            Value<String?> syncError = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            Value<String?> idempotencyKey = const Value.absent(),
            Value<DateTime?> serverUpdatedAt = const Value.absent(),
            Value<DateTime> localUpdatedAt = const Value.absent(),
            Value<int> isDeleted = const Value.absent(),
          }) =>
              ProgressEntriesCompanion(
            id: id,
            serverId: serverId,
            projectId: projectId,
            activityId: activityId,
            epsNodeId: epsNodeId,
            boqItemId: boqItemId,
            microActivityId: microActivityId,
            quantity: quantity,
            date: date,
            remarks: remarks,
            photoPaths: photoPaths,
            syncStatus: syncStatus,
            createdAt: createdAt,
            syncedAt: syncedAt,
            syncError: syncError,
            retryCount: retryCount,
            idempotencyKey: idempotencyKey,
            serverUpdatedAt: serverUpdatedAt,
            localUpdatedAt: localUpdatedAt,
            isDeleted: isDeleted,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int?> serverId = const Value.absent(),
            required int projectId,
            required int activityId,
            required int epsNodeId,
            required int boqItemId,
            Value<int?> microActivityId = const Value.absent(),
            required double quantity,
            required String date,
            Value<String?> remarks = const Value.absent(),
            Value<String?> photoPaths = const Value.absent(),
            Value<int> syncStatus = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> syncedAt = const Value.absent(),
            Value<String?> syncError = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            Value<String?> idempotencyKey = const Value.absent(),
            Value<DateTime?> serverUpdatedAt = const Value.absent(),
            Value<DateTime> localUpdatedAt = const Value.absent(),
            Value<int> isDeleted = const Value.absent(),
          }) =>
              ProgressEntriesCompanion.insert(
            id: id,
            serverId: serverId,
            projectId: projectId,
            activityId: activityId,
            epsNodeId: epsNodeId,
            boqItemId: boqItemId,
            microActivityId: microActivityId,
            quantity: quantity,
            date: date,
            remarks: remarks,
            photoPaths: photoPaths,
            syncStatus: syncStatus,
            createdAt: createdAt,
            syncedAt: syncedAt,
            syncError: syncError,
            retryCount: retryCount,
            idempotencyKey: idempotencyKey,
            serverUpdatedAt: serverUpdatedAt,
            localUpdatedAt: localUpdatedAt,
            isDeleted: isDeleted,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ProgressEntriesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $ProgressEntriesTable,
    ProgressEntry,
    $$ProgressEntriesTableFilterComposer,
    $$ProgressEntriesTableOrderingComposer,
    $$ProgressEntriesTableAnnotationComposer,
    $$ProgressEntriesTableCreateCompanionBuilder,
    $$ProgressEntriesTableUpdateCompanionBuilder,
    (
      ProgressEntry,
      BaseReferences<_$AppDatabase, $ProgressEntriesTable, ProgressEntry>
    ),
    ProgressEntry,
    PrefetchHooks Function()>;
typedef $$DailyLogsTableCreateCompanionBuilder = DailyLogsCompanion Function({
  Value<int> id,
  Value<int?> serverId,
  required int microActivityId,
  required String logDate,
  required double plannedQty,
  required double actualQty,
  Value<int?> laborCount,
  Value<int?> delayReasonId,
  Value<String?> delayNotes,
  Value<String?> remarks,
  Value<int> syncStatus,
  Value<DateTime> createdAt,
  Value<DateTime?> syncedAt,
  Value<String?> syncError,
  Value<int> retryCount,
  Value<String?> idempotencyKey,
  Value<DateTime?> serverUpdatedAt,
  Value<DateTime> localUpdatedAt,
  Value<int> isDeleted,
});
typedef $$DailyLogsTableUpdateCompanionBuilder = DailyLogsCompanion Function({
  Value<int> id,
  Value<int?> serverId,
  Value<int> microActivityId,
  Value<String> logDate,
  Value<double> plannedQty,
  Value<double> actualQty,
  Value<int?> laborCount,
  Value<int?> delayReasonId,
  Value<String?> delayNotes,
  Value<String?> remarks,
  Value<int> syncStatus,
  Value<DateTime> createdAt,
  Value<DateTime?> syncedAt,
  Value<String?> syncError,
  Value<int> retryCount,
  Value<String?> idempotencyKey,
  Value<DateTime?> serverUpdatedAt,
  Value<DateTime> localUpdatedAt,
  Value<int> isDeleted,
});

class $$DailyLogsTableFilterComposer
    extends Composer<_$AppDatabase, $DailyLogsTable> {
  $$DailyLogsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get serverId => $composableBuilder(
      column: $table.serverId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get microActivityId => $composableBuilder(
      column: $table.microActivityId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get logDate => $composableBuilder(
      column: $table.logDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get plannedQty => $composableBuilder(
      column: $table.plannedQty, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get actualQty => $composableBuilder(
      column: $table.actualQty, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get laborCount => $composableBuilder(
      column: $table.laborCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get delayReasonId => $composableBuilder(
      column: $table.delayReasonId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get delayNotes => $composableBuilder(
      column: $table.delayNotes, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get remarks => $composableBuilder(
      column: $table.remarks, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get syncedAt => $composableBuilder(
      column: $table.syncedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get syncError => $composableBuilder(
      column: $table.syncError, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get idempotencyKey => $composableBuilder(
      column: $table.idempotencyKey,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get serverUpdatedAt => $composableBuilder(
      column: $table.serverUpdatedAt,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get localUpdatedAt => $composableBuilder(
      column: $table.localUpdatedAt,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get isDeleted => $composableBuilder(
      column: $table.isDeleted, builder: (column) => ColumnFilters(column));
}

class $$DailyLogsTableOrderingComposer
    extends Composer<_$AppDatabase, $DailyLogsTable> {
  $$DailyLogsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get serverId => $composableBuilder(
      column: $table.serverId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get microActivityId => $composableBuilder(
      column: $table.microActivityId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get logDate => $composableBuilder(
      column: $table.logDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get plannedQty => $composableBuilder(
      column: $table.plannedQty, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get actualQty => $composableBuilder(
      column: $table.actualQty, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get laborCount => $composableBuilder(
      column: $table.laborCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get delayReasonId => $composableBuilder(
      column: $table.delayReasonId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get delayNotes => $composableBuilder(
      column: $table.delayNotes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get remarks => $composableBuilder(
      column: $table.remarks, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get syncedAt => $composableBuilder(
      column: $table.syncedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get syncError => $composableBuilder(
      column: $table.syncError, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get idempotencyKey => $composableBuilder(
      column: $table.idempotencyKey,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get serverUpdatedAt => $composableBuilder(
      column: $table.serverUpdatedAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get localUpdatedAt => $composableBuilder(
      column: $table.localUpdatedAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get isDeleted => $composableBuilder(
      column: $table.isDeleted, builder: (column) => ColumnOrderings(column));
}

class $$DailyLogsTableAnnotationComposer
    extends Composer<_$AppDatabase, $DailyLogsTable> {
  $$DailyLogsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get serverId =>
      $composableBuilder(column: $table.serverId, builder: (column) => column);

  GeneratedColumn<int> get microActivityId => $composableBuilder(
      column: $table.microActivityId, builder: (column) => column);

  GeneratedColumn<String> get logDate =>
      $composableBuilder(column: $table.logDate, builder: (column) => column);

  GeneratedColumn<double> get plannedQty => $composableBuilder(
      column: $table.plannedQty, builder: (column) => column);

  GeneratedColumn<double> get actualQty =>
      $composableBuilder(column: $table.actualQty, builder: (column) => column);

  GeneratedColumn<int> get laborCount => $composableBuilder(
      column: $table.laborCount, builder: (column) => column);

  GeneratedColumn<int> get delayReasonId => $composableBuilder(
      column: $table.delayReasonId, builder: (column) => column);

  GeneratedColumn<String> get delayNotes => $composableBuilder(
      column: $table.delayNotes, builder: (column) => column);

  GeneratedColumn<String> get remarks =>
      $composableBuilder(column: $table.remarks, builder: (column) => column);

  GeneratedColumn<int> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get syncedAt =>
      $composableBuilder(column: $table.syncedAt, builder: (column) => column);

  GeneratedColumn<String> get syncError =>
      $composableBuilder(column: $table.syncError, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => column);

  GeneratedColumn<String> get idempotencyKey => $composableBuilder(
      column: $table.idempotencyKey, builder: (column) => column);

  GeneratedColumn<DateTime> get serverUpdatedAt => $composableBuilder(
      column: $table.serverUpdatedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get localUpdatedAt => $composableBuilder(
      column: $table.localUpdatedAt, builder: (column) => column);

  GeneratedColumn<int> get isDeleted =>
      $composableBuilder(column: $table.isDeleted, builder: (column) => column);
}

class $$DailyLogsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $DailyLogsTable,
    DailyLog,
    $$DailyLogsTableFilterComposer,
    $$DailyLogsTableOrderingComposer,
    $$DailyLogsTableAnnotationComposer,
    $$DailyLogsTableCreateCompanionBuilder,
    $$DailyLogsTableUpdateCompanionBuilder,
    (DailyLog, BaseReferences<_$AppDatabase, $DailyLogsTable, DailyLog>),
    DailyLog,
    PrefetchHooks Function()> {
  $$DailyLogsTableTableManager(_$AppDatabase db, $DailyLogsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DailyLogsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DailyLogsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DailyLogsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int?> serverId = const Value.absent(),
            Value<int> microActivityId = const Value.absent(),
            Value<String> logDate = const Value.absent(),
            Value<double> plannedQty = const Value.absent(),
            Value<double> actualQty = const Value.absent(),
            Value<int?> laborCount = const Value.absent(),
            Value<int?> delayReasonId = const Value.absent(),
            Value<String?> delayNotes = const Value.absent(),
            Value<String?> remarks = const Value.absent(),
            Value<int> syncStatus = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> syncedAt = const Value.absent(),
            Value<String?> syncError = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            Value<String?> idempotencyKey = const Value.absent(),
            Value<DateTime?> serverUpdatedAt = const Value.absent(),
            Value<DateTime> localUpdatedAt = const Value.absent(),
            Value<int> isDeleted = const Value.absent(),
          }) =>
              DailyLogsCompanion(
            id: id,
            serverId: serverId,
            microActivityId: microActivityId,
            logDate: logDate,
            plannedQty: plannedQty,
            actualQty: actualQty,
            laborCount: laborCount,
            delayReasonId: delayReasonId,
            delayNotes: delayNotes,
            remarks: remarks,
            syncStatus: syncStatus,
            createdAt: createdAt,
            syncedAt: syncedAt,
            syncError: syncError,
            retryCount: retryCount,
            idempotencyKey: idempotencyKey,
            serverUpdatedAt: serverUpdatedAt,
            localUpdatedAt: localUpdatedAt,
            isDeleted: isDeleted,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int?> serverId = const Value.absent(),
            required int microActivityId,
            required String logDate,
            required double plannedQty,
            required double actualQty,
            Value<int?> laborCount = const Value.absent(),
            Value<int?> delayReasonId = const Value.absent(),
            Value<String?> delayNotes = const Value.absent(),
            Value<String?> remarks = const Value.absent(),
            Value<int> syncStatus = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> syncedAt = const Value.absent(),
            Value<String?> syncError = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            Value<String?> idempotencyKey = const Value.absent(),
            Value<DateTime?> serverUpdatedAt = const Value.absent(),
            Value<DateTime> localUpdatedAt = const Value.absent(),
            Value<int> isDeleted = const Value.absent(),
          }) =>
              DailyLogsCompanion.insert(
            id: id,
            serverId: serverId,
            microActivityId: microActivityId,
            logDate: logDate,
            plannedQty: plannedQty,
            actualQty: actualQty,
            laborCount: laborCount,
            delayReasonId: delayReasonId,
            delayNotes: delayNotes,
            remarks: remarks,
            syncStatus: syncStatus,
            createdAt: createdAt,
            syncedAt: syncedAt,
            syncError: syncError,
            retryCount: retryCount,
            idempotencyKey: idempotencyKey,
            serverUpdatedAt: serverUpdatedAt,
            localUpdatedAt: localUpdatedAt,
            isDeleted: isDeleted,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$DailyLogsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $DailyLogsTable,
    DailyLog,
    $$DailyLogsTableFilterComposer,
    $$DailyLogsTableOrderingComposer,
    $$DailyLogsTableAnnotationComposer,
    $$DailyLogsTableCreateCompanionBuilder,
    $$DailyLogsTableUpdateCompanionBuilder,
    (DailyLog, BaseReferences<_$AppDatabase, $DailyLogsTable, DailyLog>),
    DailyLog,
    PrefetchHooks Function()>;
typedef $$SyncQueueTableCreateCompanionBuilder = SyncQueueCompanion Function({
  Value<int> id,
  required String entityType,
  required int entityId,
  required String operation,
  required String payload,
  Value<int> retryCount,
  Value<DateTime> createdAt,
  Value<DateTime?> lastAttemptAt,
  Value<String?> lastError,
  Value<int> priority,
});
typedef $$SyncQueueTableUpdateCompanionBuilder = SyncQueueCompanion Function({
  Value<int> id,
  Value<String> entityType,
  Value<int> entityId,
  Value<String> operation,
  Value<String> payload,
  Value<int> retryCount,
  Value<DateTime> createdAt,
  Value<DateTime?> lastAttemptAt,
  Value<String?> lastError,
  Value<int> priority,
});

class $$SyncQueueTableFilterComposer
    extends Composer<_$AppDatabase, $SyncQueueTable> {
  $$SyncQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get operation => $composableBuilder(
      column: $table.operation, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastAttemptAt => $composableBuilder(
      column: $table.lastAttemptAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get priority => $composableBuilder(
      column: $table.priority, builder: (column) => ColumnFilters(column));
}

class $$SyncQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncQueueTable> {
  $$SyncQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get operation => $composableBuilder(
      column: $table.operation, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastAttemptAt => $composableBuilder(
      column: $table.lastAttemptAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get priority => $composableBuilder(
      column: $table.priority, builder: (column) => ColumnOrderings(column));
}

class $$SyncQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncQueueTable> {
  $$SyncQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get entityType => $composableBuilder(
      column: $table.entityType, builder: (column) => column);

  GeneratedColumn<int> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get operation =>
      $composableBuilder(column: $table.operation, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
      column: $table.retryCount, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get lastAttemptAt => $composableBuilder(
      column: $table.lastAttemptAt, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<int> get priority =>
      $composableBuilder(column: $table.priority, builder: (column) => column);
}

class $$SyncQueueTableTableManager extends RootTableManager<
    _$AppDatabase,
    $SyncQueueTable,
    SyncQueueData,
    $$SyncQueueTableFilterComposer,
    $$SyncQueueTableOrderingComposer,
    $$SyncQueueTableAnnotationComposer,
    $$SyncQueueTableCreateCompanionBuilder,
    $$SyncQueueTableUpdateCompanionBuilder,
    (
      SyncQueueData,
      BaseReferences<_$AppDatabase, $SyncQueueTable, SyncQueueData>
    ),
    SyncQueueData,
    PrefetchHooks Function()> {
  $$SyncQueueTableTableManager(_$AppDatabase db, $SyncQueueTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncQueueTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncQueueTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<String> entityType = const Value.absent(),
            Value<int> entityId = const Value.absent(),
            Value<String> operation = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<int> retryCount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> lastAttemptAt = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
            Value<int> priority = const Value.absent(),
          }) =>
              SyncQueueCompanion(
            id: id,
            entityType: entityType,
            entityId: entityId,
            operation: operation,
            payload: payload,
            retryCount: retryCount,
            createdAt: createdAt,
            lastAttemptAt: lastAttemptAt,
            lastError: lastError,
            priority: priority,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required String entityType,
            required int entityId,
            required String operation,
            required String payload,
            Value<int> retryCount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> lastAttemptAt = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
            Value<int> priority = const Value.absent(),
          }) =>
              SyncQueueCompanion.insert(
            id: id,
            entityType: entityType,
            entityId: entityId,
            operation: operation,
            payload: payload,
            retryCount: retryCount,
            createdAt: createdAt,
            lastAttemptAt: lastAttemptAt,
            lastError: lastError,
            priority: priority,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SyncQueueTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $SyncQueueTable,
    SyncQueueData,
    $$SyncQueueTableFilterComposer,
    $$SyncQueueTableOrderingComposer,
    $$SyncQueueTableAnnotationComposer,
    $$SyncQueueTableCreateCompanionBuilder,
    $$SyncQueueTableUpdateCompanionBuilder,
    (
      SyncQueueData,
      BaseReferences<_$AppDatabase, $SyncQueueTable, SyncQueueData>
    ),
    SyncQueueData,
    PrefetchHooks Function()>;
typedef $$CachedProjectsTableCreateCompanionBuilder = CachedProjectsCompanion
    Function({
  Value<int> id,
  required String name,
  Value<String?> code,
  Value<String?> status,
  Value<String?> startDate,
  Value<String?> endDate,
  required String rawData,
  Value<DateTime> cachedAt,
});
typedef $$CachedProjectsTableUpdateCompanionBuilder = CachedProjectsCompanion
    Function({
  Value<int> id,
  Value<String> name,
  Value<String?> code,
  Value<String?> status,
  Value<String?> startDate,
  Value<String?> endDate,
  Value<String> rawData,
  Value<DateTime> cachedAt,
});

class $$CachedProjectsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedProjectsTable> {
  $$CachedProjectsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get code => $composableBuilder(
      column: $table.code, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get startDate => $composableBuilder(
      column: $table.startDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get endDate => $composableBuilder(
      column: $table.endDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedProjectsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedProjectsTable> {
  $$CachedProjectsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get code => $composableBuilder(
      column: $table.code, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get startDate => $composableBuilder(
      column: $table.startDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get endDate => $composableBuilder(
      column: $table.endDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedProjectsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedProjectsTable> {
  $$CachedProjectsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => column);

  GeneratedColumn<String> get endDate =>
      $composableBuilder(column: $table.endDate, builder: (column) => column);

  GeneratedColumn<String> get rawData =>
      $composableBuilder(column: $table.rawData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedProjectsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedProjectsTable,
    CachedProject,
    $$CachedProjectsTableFilterComposer,
    $$CachedProjectsTableOrderingComposer,
    $$CachedProjectsTableAnnotationComposer,
    $$CachedProjectsTableCreateCompanionBuilder,
    $$CachedProjectsTableUpdateCompanionBuilder,
    (
      CachedProject,
      BaseReferences<_$AppDatabase, $CachedProjectsTable, CachedProject>
    ),
    CachedProject,
    PrefetchHooks Function()> {
  $$CachedProjectsTableTableManager(
      _$AppDatabase db, $CachedProjectsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedProjectsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedProjectsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedProjectsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String?> code = const Value.absent(),
            Value<String?> status = const Value.absent(),
            Value<String?> startDate = const Value.absent(),
            Value<String?> endDate = const Value.absent(),
            Value<String> rawData = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedProjectsCompanion(
            id: id,
            name: name,
            code: code,
            status: status,
            startDate: startDate,
            endDate: endDate,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required String name,
            Value<String?> code = const Value.absent(),
            Value<String?> status = const Value.absent(),
            Value<String?> startDate = const Value.absent(),
            Value<String?> endDate = const Value.absent(),
            required String rawData,
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedProjectsCompanion.insert(
            id: id,
            name: name,
            code: code,
            status: status,
            startDate: startDate,
            endDate: endDate,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedProjectsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedProjectsTable,
    CachedProject,
    $$CachedProjectsTableFilterComposer,
    $$CachedProjectsTableOrderingComposer,
    $$CachedProjectsTableAnnotationComposer,
    $$CachedProjectsTableCreateCompanionBuilder,
    $$CachedProjectsTableUpdateCompanionBuilder,
    (
      CachedProject,
      BaseReferences<_$AppDatabase, $CachedProjectsTable, CachedProject>
    ),
    CachedProject,
    PrefetchHooks Function()>;
typedef $$CachedActivitiesTableCreateCompanionBuilder
    = CachedActivitiesCompanion Function({
  Value<int> id,
  required int projectId,
  Value<int?> epsNodeId,
  required String name,
  Value<String?> status,
  Value<String?> startDate,
  Value<String?> endDate,
  Value<double> progress,
  required String rawData,
  Value<DateTime> cachedAt,
});
typedef $$CachedActivitiesTableUpdateCompanionBuilder
    = CachedActivitiesCompanion Function({
  Value<int> id,
  Value<int> projectId,
  Value<int?> epsNodeId,
  Value<String> name,
  Value<String?> status,
  Value<String?> startDate,
  Value<String?> endDate,
  Value<double> progress,
  Value<String> rawData,
  Value<DateTime> cachedAt,
});

class $$CachedActivitiesTableFilterComposer
    extends Composer<_$AppDatabase, $CachedActivitiesTable> {
  $$CachedActivitiesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get epsNodeId => $composableBuilder(
      column: $table.epsNodeId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get startDate => $composableBuilder(
      column: $table.startDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get endDate => $composableBuilder(
      column: $table.endDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get progress => $composableBuilder(
      column: $table.progress, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedActivitiesTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedActivitiesTable> {
  $$CachedActivitiesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get epsNodeId => $composableBuilder(
      column: $table.epsNodeId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get startDate => $composableBuilder(
      column: $table.startDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get endDate => $composableBuilder(
      column: $table.endDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get progress => $composableBuilder(
      column: $table.progress, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedActivitiesTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedActivitiesTable> {
  $$CachedActivitiesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get projectId =>
      $composableBuilder(column: $table.projectId, builder: (column) => column);

  GeneratedColumn<int> get epsNodeId =>
      $composableBuilder(column: $table.epsNodeId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => column);

  GeneratedColumn<String> get endDate =>
      $composableBuilder(column: $table.endDate, builder: (column) => column);

  GeneratedColumn<double> get progress =>
      $composableBuilder(column: $table.progress, builder: (column) => column);

  GeneratedColumn<String> get rawData =>
      $composableBuilder(column: $table.rawData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedActivitiesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedActivitiesTable,
    CachedActivity,
    $$CachedActivitiesTableFilterComposer,
    $$CachedActivitiesTableOrderingComposer,
    $$CachedActivitiesTableAnnotationComposer,
    $$CachedActivitiesTableCreateCompanionBuilder,
    $$CachedActivitiesTableUpdateCompanionBuilder,
    (
      CachedActivity,
      BaseReferences<_$AppDatabase, $CachedActivitiesTable, CachedActivity>
    ),
    CachedActivity,
    PrefetchHooks Function()> {
  $$CachedActivitiesTableTableManager(
      _$AppDatabase db, $CachedActivitiesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedActivitiesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedActivitiesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedActivitiesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> projectId = const Value.absent(),
            Value<int?> epsNodeId = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String?> status = const Value.absent(),
            Value<String?> startDate = const Value.absent(),
            Value<String?> endDate = const Value.absent(),
            Value<double> progress = const Value.absent(),
            Value<String> rawData = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedActivitiesCompanion(
            id: id,
            projectId: projectId,
            epsNodeId: epsNodeId,
            name: name,
            status: status,
            startDate: startDate,
            endDate: endDate,
            progress: progress,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int projectId,
            Value<int?> epsNodeId = const Value.absent(),
            required String name,
            Value<String?> status = const Value.absent(),
            Value<String?> startDate = const Value.absent(),
            Value<String?> endDate = const Value.absent(),
            Value<double> progress = const Value.absent(),
            required String rawData,
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedActivitiesCompanion.insert(
            id: id,
            projectId: projectId,
            epsNodeId: epsNodeId,
            name: name,
            status: status,
            startDate: startDate,
            endDate: endDate,
            progress: progress,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedActivitiesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedActivitiesTable,
    CachedActivity,
    $$CachedActivitiesTableFilterComposer,
    $$CachedActivitiesTableOrderingComposer,
    $$CachedActivitiesTableAnnotationComposer,
    $$CachedActivitiesTableCreateCompanionBuilder,
    $$CachedActivitiesTableUpdateCompanionBuilder,
    (
      CachedActivity,
      BaseReferences<_$AppDatabase, $CachedActivitiesTable, CachedActivity>
    ),
    CachedActivity,
    PrefetchHooks Function()>;
typedef $$CachedBoqItemsTableCreateCompanionBuilder = CachedBoqItemsCompanion
    Function({
  Value<int> id,
  required int projectId,
  required String name,
  Value<String?> unit,
  required double quantity,
  Value<double?> rate,
  required String rawData,
  Value<DateTime> cachedAt,
});
typedef $$CachedBoqItemsTableUpdateCompanionBuilder = CachedBoqItemsCompanion
    Function({
  Value<int> id,
  Value<int> projectId,
  Value<String> name,
  Value<String?> unit,
  Value<double> quantity,
  Value<double?> rate,
  Value<String> rawData,
  Value<DateTime> cachedAt,
});

class $$CachedBoqItemsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedBoqItemsTable> {
  $$CachedBoqItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get unit => $composableBuilder(
      column: $table.unit, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get quantity => $composableBuilder(
      column: $table.quantity, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get rate => $composableBuilder(
      column: $table.rate, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedBoqItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedBoqItemsTable> {
  $$CachedBoqItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get unit => $composableBuilder(
      column: $table.unit, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get quantity => $composableBuilder(
      column: $table.quantity, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get rate => $composableBuilder(
      column: $table.rate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedBoqItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedBoqItemsTable> {
  $$CachedBoqItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get projectId =>
      $composableBuilder(column: $table.projectId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get unit =>
      $composableBuilder(column: $table.unit, builder: (column) => column);

  GeneratedColumn<double> get quantity =>
      $composableBuilder(column: $table.quantity, builder: (column) => column);

  GeneratedColumn<double> get rate =>
      $composableBuilder(column: $table.rate, builder: (column) => column);

  GeneratedColumn<String> get rawData =>
      $composableBuilder(column: $table.rawData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedBoqItemsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedBoqItemsTable,
    CachedBoqItem,
    $$CachedBoqItemsTableFilterComposer,
    $$CachedBoqItemsTableOrderingComposer,
    $$CachedBoqItemsTableAnnotationComposer,
    $$CachedBoqItemsTableCreateCompanionBuilder,
    $$CachedBoqItemsTableUpdateCompanionBuilder,
    (
      CachedBoqItem,
      BaseReferences<_$AppDatabase, $CachedBoqItemsTable, CachedBoqItem>
    ),
    CachedBoqItem,
    PrefetchHooks Function()> {
  $$CachedBoqItemsTableTableManager(
      _$AppDatabase db, $CachedBoqItemsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedBoqItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedBoqItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedBoqItemsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> projectId = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String?> unit = const Value.absent(),
            Value<double> quantity = const Value.absent(),
            Value<double?> rate = const Value.absent(),
            Value<String> rawData = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedBoqItemsCompanion(
            id: id,
            projectId: projectId,
            name: name,
            unit: unit,
            quantity: quantity,
            rate: rate,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int projectId,
            required String name,
            Value<String?> unit = const Value.absent(),
            required double quantity,
            Value<double?> rate = const Value.absent(),
            required String rawData,
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedBoqItemsCompanion.insert(
            id: id,
            projectId: projectId,
            name: name,
            unit: unit,
            quantity: quantity,
            rate: rate,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedBoqItemsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedBoqItemsTable,
    CachedBoqItem,
    $$CachedBoqItemsTableFilterComposer,
    $$CachedBoqItemsTableOrderingComposer,
    $$CachedBoqItemsTableAnnotationComposer,
    $$CachedBoqItemsTableCreateCompanionBuilder,
    $$CachedBoqItemsTableUpdateCompanionBuilder,
    (
      CachedBoqItem,
      BaseReferences<_$AppDatabase, $CachedBoqItemsTable, CachedBoqItem>
    ),
    CachedBoqItem,
    PrefetchHooks Function()>;
typedef $$CachedEpsNodesTableCreateCompanionBuilder = CachedEpsNodesCompanion
    Function({
  Value<int> id,
  required int projectId,
  Value<int?> parentId,
  required String name,
  Value<String?> code,
  required String type,
  Value<double> progress,
  required String rawData,
  Value<DateTime> cachedAt,
});
typedef $$CachedEpsNodesTableUpdateCompanionBuilder = CachedEpsNodesCompanion
    Function({
  Value<int> id,
  Value<int> projectId,
  Value<int?> parentId,
  Value<String> name,
  Value<String?> code,
  Value<String> type,
  Value<double> progress,
  Value<String> rawData,
  Value<DateTime> cachedAt,
});

class $$CachedEpsNodesTableFilterComposer
    extends Composer<_$AppDatabase, $CachedEpsNodesTable> {
  $$CachedEpsNodesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get parentId => $composableBuilder(
      column: $table.parentId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get code => $composableBuilder(
      column: $table.code, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get type => $composableBuilder(
      column: $table.type, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get progress => $composableBuilder(
      column: $table.progress, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedEpsNodesTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedEpsNodesTable> {
  $$CachedEpsNodesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get parentId => $composableBuilder(
      column: $table.parentId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get code => $composableBuilder(
      column: $table.code, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get type => $composableBuilder(
      column: $table.type, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get progress => $composableBuilder(
      column: $table.progress, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedEpsNodesTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedEpsNodesTable> {
  $$CachedEpsNodesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get projectId =>
      $composableBuilder(column: $table.projectId, builder: (column) => column);

  GeneratedColumn<int> get parentId =>
      $composableBuilder(column: $table.parentId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<double> get progress =>
      $composableBuilder(column: $table.progress, builder: (column) => column);

  GeneratedColumn<String> get rawData =>
      $composableBuilder(column: $table.rawData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedEpsNodesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedEpsNodesTable,
    CachedEpsNode,
    $$CachedEpsNodesTableFilterComposer,
    $$CachedEpsNodesTableOrderingComposer,
    $$CachedEpsNodesTableAnnotationComposer,
    $$CachedEpsNodesTableCreateCompanionBuilder,
    $$CachedEpsNodesTableUpdateCompanionBuilder,
    (
      CachedEpsNode,
      BaseReferences<_$AppDatabase, $CachedEpsNodesTable, CachedEpsNode>
    ),
    CachedEpsNode,
    PrefetchHooks Function()> {
  $$CachedEpsNodesTableTableManager(
      _$AppDatabase db, $CachedEpsNodesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedEpsNodesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedEpsNodesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedEpsNodesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> projectId = const Value.absent(),
            Value<int?> parentId = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String?> code = const Value.absent(),
            Value<String> type = const Value.absent(),
            Value<double> progress = const Value.absent(),
            Value<String> rawData = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedEpsNodesCompanion(
            id: id,
            projectId: projectId,
            parentId: parentId,
            name: name,
            code: code,
            type: type,
            progress: progress,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int projectId,
            Value<int?> parentId = const Value.absent(),
            required String name,
            Value<String?> code = const Value.absent(),
            required String type,
            Value<double> progress = const Value.absent(),
            required String rawData,
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedEpsNodesCompanion.insert(
            id: id,
            projectId: projectId,
            parentId: parentId,
            name: name,
            code: code,
            type: type,
            progress: progress,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedEpsNodesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedEpsNodesTable,
    CachedEpsNode,
    $$CachedEpsNodesTableFilterComposer,
    $$CachedEpsNodesTableOrderingComposer,
    $$CachedEpsNodesTableAnnotationComposer,
    $$CachedEpsNodesTableCreateCompanionBuilder,
    $$CachedEpsNodesTableUpdateCompanionBuilder,
    (
      CachedEpsNode,
      BaseReferences<_$AppDatabase, $CachedEpsNodesTable, CachedEpsNode>
    ),
    CachedEpsNode,
    PrefetchHooks Function()>;
typedef $$CachedQualityActivityListsTableCreateCompanionBuilder
    = CachedQualityActivityListsCompanion Function({
  Value<int> id,
  required int projectId,
  Value<int?> epsNodeId,
  required String name,
  Value<String?> description,
  Value<int> activityCount,
  required String rawData,
  Value<DateTime> cachedAt,
});
typedef $$CachedQualityActivityListsTableUpdateCompanionBuilder
    = CachedQualityActivityListsCompanion Function({
  Value<int> id,
  Value<int> projectId,
  Value<int?> epsNodeId,
  Value<String> name,
  Value<String?> description,
  Value<int> activityCount,
  Value<String> rawData,
  Value<DateTime> cachedAt,
});

class $$CachedQualityActivityListsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedQualityActivityListsTable> {
  $$CachedQualityActivityListsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get epsNodeId => $composableBuilder(
      column: $table.epsNodeId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get description => $composableBuilder(
      column: $table.description, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get activityCount => $composableBuilder(
      column: $table.activityCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedQualityActivityListsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedQualityActivityListsTable> {
  $$CachedQualityActivityListsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get epsNodeId => $composableBuilder(
      column: $table.epsNodeId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get description => $composableBuilder(
      column: $table.description, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get activityCount => $composableBuilder(
      column: $table.activityCount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedQualityActivityListsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedQualityActivityListsTable> {
  $$CachedQualityActivityListsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get projectId =>
      $composableBuilder(column: $table.projectId, builder: (column) => column);

  GeneratedColumn<int> get epsNodeId =>
      $composableBuilder(column: $table.epsNodeId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
      column: $table.description, builder: (column) => column);

  GeneratedColumn<int> get activityCount => $composableBuilder(
      column: $table.activityCount, builder: (column) => column);

  GeneratedColumn<String> get rawData =>
      $composableBuilder(column: $table.rawData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedQualityActivityListsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedQualityActivityListsTable,
    CachedQualityActivityList,
    $$CachedQualityActivityListsTableFilterComposer,
    $$CachedQualityActivityListsTableOrderingComposer,
    $$CachedQualityActivityListsTableAnnotationComposer,
    $$CachedQualityActivityListsTableCreateCompanionBuilder,
    $$CachedQualityActivityListsTableUpdateCompanionBuilder,
    (
      CachedQualityActivityList,
      BaseReferences<_$AppDatabase, $CachedQualityActivityListsTable,
          CachedQualityActivityList>
    ),
    CachedQualityActivityList,
    PrefetchHooks Function()> {
  $$CachedQualityActivityListsTableTableManager(
      _$AppDatabase db, $CachedQualityActivityListsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedQualityActivityListsTableFilterComposer(
                  $db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedQualityActivityListsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedQualityActivityListsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> projectId = const Value.absent(),
            Value<int?> epsNodeId = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String?> description = const Value.absent(),
            Value<int> activityCount = const Value.absent(),
            Value<String> rawData = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedQualityActivityListsCompanion(
            id: id,
            projectId: projectId,
            epsNodeId: epsNodeId,
            name: name,
            description: description,
            activityCount: activityCount,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int projectId,
            Value<int?> epsNodeId = const Value.absent(),
            required String name,
            Value<String?> description = const Value.absent(),
            Value<int> activityCount = const Value.absent(),
            required String rawData,
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedQualityActivityListsCompanion.insert(
            id: id,
            projectId: projectId,
            epsNodeId: epsNodeId,
            name: name,
            description: description,
            activityCount: activityCount,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedQualityActivityListsTableProcessedTableManager
    = ProcessedTableManager<
        _$AppDatabase,
        $CachedQualityActivityListsTable,
        CachedQualityActivityList,
        $$CachedQualityActivityListsTableFilterComposer,
        $$CachedQualityActivityListsTableOrderingComposer,
        $$CachedQualityActivityListsTableAnnotationComposer,
        $$CachedQualityActivityListsTableCreateCompanionBuilder,
        $$CachedQualityActivityListsTableUpdateCompanionBuilder,
        (
          CachedQualityActivityList,
          BaseReferences<_$AppDatabase, $CachedQualityActivityListsTable,
              CachedQualityActivityList>
        ),
        CachedQualityActivityList,
        PrefetchHooks Function()>;
typedef $$CachedQualityActivitiesTableCreateCompanionBuilder
    = CachedQualityActivitiesCompanion Function({
  Value<int> id,
  required int listId,
  required int projectId,
  Value<int?> epsNodeId,
  Value<int> sequence,
  required String activityName,
  Value<String> status,
  Value<int> holdPoint,
  Value<int> witnessPoint,
  required String rawData,
  Value<DateTime> cachedAt,
});
typedef $$CachedQualityActivitiesTableUpdateCompanionBuilder
    = CachedQualityActivitiesCompanion Function({
  Value<int> id,
  Value<int> listId,
  Value<int> projectId,
  Value<int?> epsNodeId,
  Value<int> sequence,
  Value<String> activityName,
  Value<String> status,
  Value<int> holdPoint,
  Value<int> witnessPoint,
  Value<String> rawData,
  Value<DateTime> cachedAt,
});

class $$CachedQualityActivitiesTableFilterComposer
    extends Composer<_$AppDatabase, $CachedQualityActivitiesTable> {
  $$CachedQualityActivitiesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get listId => $composableBuilder(
      column: $table.listId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get epsNodeId => $composableBuilder(
      column: $table.epsNodeId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get sequence => $composableBuilder(
      column: $table.sequence, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get activityName => $composableBuilder(
      column: $table.activityName, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get holdPoint => $composableBuilder(
      column: $table.holdPoint, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get witnessPoint => $composableBuilder(
      column: $table.witnessPoint, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedQualityActivitiesTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedQualityActivitiesTable> {
  $$CachedQualityActivitiesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get listId => $composableBuilder(
      column: $table.listId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get epsNodeId => $composableBuilder(
      column: $table.epsNodeId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get sequence => $composableBuilder(
      column: $table.sequence, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get activityName => $composableBuilder(
      column: $table.activityName,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get holdPoint => $composableBuilder(
      column: $table.holdPoint, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get witnessPoint => $composableBuilder(
      column: $table.witnessPoint,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedQualityActivitiesTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedQualityActivitiesTable> {
  $$CachedQualityActivitiesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get listId =>
      $composableBuilder(column: $table.listId, builder: (column) => column);

  GeneratedColumn<int> get projectId =>
      $composableBuilder(column: $table.projectId, builder: (column) => column);

  GeneratedColumn<int> get epsNodeId =>
      $composableBuilder(column: $table.epsNodeId, builder: (column) => column);

  GeneratedColumn<int> get sequence =>
      $composableBuilder(column: $table.sequence, builder: (column) => column);

  GeneratedColumn<String> get activityName => $composableBuilder(
      column: $table.activityName, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get holdPoint =>
      $composableBuilder(column: $table.holdPoint, builder: (column) => column);

  GeneratedColumn<int> get witnessPoint => $composableBuilder(
      column: $table.witnessPoint, builder: (column) => column);

  GeneratedColumn<String> get rawData =>
      $composableBuilder(column: $table.rawData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedQualityActivitiesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedQualityActivitiesTable,
    CachedQualityActivity,
    $$CachedQualityActivitiesTableFilterComposer,
    $$CachedQualityActivitiesTableOrderingComposer,
    $$CachedQualityActivitiesTableAnnotationComposer,
    $$CachedQualityActivitiesTableCreateCompanionBuilder,
    $$CachedQualityActivitiesTableUpdateCompanionBuilder,
    (
      CachedQualityActivity,
      BaseReferences<_$AppDatabase, $CachedQualityActivitiesTable,
          CachedQualityActivity>
    ),
    CachedQualityActivity,
    PrefetchHooks Function()> {
  $$CachedQualityActivitiesTableTableManager(
      _$AppDatabase db, $CachedQualityActivitiesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedQualityActivitiesTableFilterComposer(
                  $db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedQualityActivitiesTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedQualityActivitiesTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> listId = const Value.absent(),
            Value<int> projectId = const Value.absent(),
            Value<int?> epsNodeId = const Value.absent(),
            Value<int> sequence = const Value.absent(),
            Value<String> activityName = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<int> holdPoint = const Value.absent(),
            Value<int> witnessPoint = const Value.absent(),
            Value<String> rawData = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedQualityActivitiesCompanion(
            id: id,
            listId: listId,
            projectId: projectId,
            epsNodeId: epsNodeId,
            sequence: sequence,
            activityName: activityName,
            status: status,
            holdPoint: holdPoint,
            witnessPoint: witnessPoint,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int listId,
            required int projectId,
            Value<int?> epsNodeId = const Value.absent(),
            Value<int> sequence = const Value.absent(),
            required String activityName,
            Value<String> status = const Value.absent(),
            Value<int> holdPoint = const Value.absent(),
            Value<int> witnessPoint = const Value.absent(),
            required String rawData,
            Value<DateTime> cachedAt = const Value.absent(),
          }) =>
              CachedQualityActivitiesCompanion.insert(
            id: id,
            listId: listId,
            projectId: projectId,
            epsNodeId: epsNodeId,
            sequence: sequence,
            activityName: activityName,
            status: status,
            holdPoint: holdPoint,
            witnessPoint: witnessPoint,
            rawData: rawData,
            cachedAt: cachedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedQualityActivitiesTableProcessedTableManager
    = ProcessedTableManager<
        _$AppDatabase,
        $CachedQualityActivitiesTable,
        CachedQualityActivity,
        $$CachedQualityActivitiesTableFilterComposer,
        $$CachedQualityActivitiesTableOrderingComposer,
        $$CachedQualityActivitiesTableAnnotationComposer,
        $$CachedQualityActivitiesTableCreateCompanionBuilder,
        $$CachedQualityActivitiesTableUpdateCompanionBuilder,
        (
          CachedQualityActivity,
          BaseReferences<_$AppDatabase, $CachedQualityActivitiesTable,
              CachedQualityActivity>
        ),
        CachedQualityActivity,
        PrefetchHooks Function()>;
typedef $$CachedQualitySiteObsTableCreateCompanionBuilder
    = CachedQualitySiteObsCompanion Function({
  required String id,
  required int projectId,
  required String status,
  Value<String?> severity,
  required String rawData,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedQualitySiteObsTableUpdateCompanionBuilder
    = CachedQualitySiteObsCompanion Function({
  Value<String> id,
  Value<int> projectId,
  Value<String> status,
  Value<String?> severity,
  Value<String> rawData,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedQualitySiteObsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedQualitySiteObsTable> {
  $$CachedQualitySiteObsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get severity => $composableBuilder(
      column: $table.severity, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedQualitySiteObsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedQualitySiteObsTable> {
  $$CachedQualitySiteObsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get severity => $composableBuilder(
      column: $table.severity, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedQualitySiteObsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedQualitySiteObsTable> {
  $$CachedQualitySiteObsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get projectId =>
      $composableBuilder(column: $table.projectId, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get severity =>
      $composableBuilder(column: $table.severity, builder: (column) => column);

  GeneratedColumn<String> get rawData =>
      $composableBuilder(column: $table.rawData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedQualitySiteObsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedQualitySiteObsTable,
    CachedQualitySiteOb,
    $$CachedQualitySiteObsTableFilterComposer,
    $$CachedQualitySiteObsTableOrderingComposer,
    $$CachedQualitySiteObsTableAnnotationComposer,
    $$CachedQualitySiteObsTableCreateCompanionBuilder,
    $$CachedQualitySiteObsTableUpdateCompanionBuilder,
    (
      CachedQualitySiteOb,
      BaseReferences<_$AppDatabase, $CachedQualitySiteObsTable,
          CachedQualitySiteOb>
    ),
    CachedQualitySiteOb,
    PrefetchHooks Function()> {
  $$CachedQualitySiteObsTableTableManager(
      _$AppDatabase db, $CachedQualitySiteObsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedQualitySiteObsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedQualitySiteObsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedQualitySiteObsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<int> projectId = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<String?> severity = const Value.absent(),
            Value<String> rawData = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedQualitySiteObsCompanion(
            id: id,
            projectId: projectId,
            status: status,
            severity: severity,
            rawData: rawData,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required int projectId,
            required String status,
            Value<String?> severity = const Value.absent(),
            required String rawData,
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedQualitySiteObsCompanion.insert(
            id: id,
            projectId: projectId,
            status: status,
            severity: severity,
            rawData: rawData,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedQualitySiteObsTableProcessedTableManager
    = ProcessedTableManager<
        _$AppDatabase,
        $CachedQualitySiteObsTable,
        CachedQualitySiteOb,
        $$CachedQualitySiteObsTableFilterComposer,
        $$CachedQualitySiteObsTableOrderingComposer,
        $$CachedQualitySiteObsTableAnnotationComposer,
        $$CachedQualitySiteObsTableCreateCompanionBuilder,
        $$CachedQualitySiteObsTableUpdateCompanionBuilder,
        (
          CachedQualitySiteOb,
          BaseReferences<_$AppDatabase, $CachedQualitySiteObsTable,
              CachedQualitySiteOb>
        ),
        CachedQualitySiteOb,
        PrefetchHooks Function()>;
typedef $$CachedEhsSiteObsTableCreateCompanionBuilder
    = CachedEhsSiteObsCompanion Function({
  required String id,
  required int projectId,
  required String status,
  Value<String?> severity,
  required String rawData,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});
typedef $$CachedEhsSiteObsTableUpdateCompanionBuilder
    = CachedEhsSiteObsCompanion Function({
  Value<String> id,
  Value<int> projectId,
  Value<String> status,
  Value<String?> severity,
  Value<String> rawData,
  Value<DateTime> cachedAt,
  Value<int> rowid,
});

class $$CachedEhsSiteObsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedEhsSiteObsTable> {
  $$CachedEhsSiteObsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get severity => $composableBuilder(
      column: $table.severity, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$CachedEhsSiteObsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedEhsSiteObsTable> {
  $$CachedEhsSiteObsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get projectId => $composableBuilder(
      column: $table.projectId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get severity => $composableBuilder(
      column: $table.severity, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get rawData => $composableBuilder(
      column: $table.rawData, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedEhsSiteObsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedEhsSiteObsTable> {
  $$CachedEhsSiteObsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get projectId =>
      $composableBuilder(column: $table.projectId, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get severity =>
      $composableBuilder(column: $table.severity, builder: (column) => column);

  GeneratedColumn<String> get rawData =>
      $composableBuilder(column: $table.rawData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$CachedEhsSiteObsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedEhsSiteObsTable,
    CachedEhsSiteOb,
    $$CachedEhsSiteObsTableFilterComposer,
    $$CachedEhsSiteObsTableOrderingComposer,
    $$CachedEhsSiteObsTableAnnotationComposer,
    $$CachedEhsSiteObsTableCreateCompanionBuilder,
    $$CachedEhsSiteObsTableUpdateCompanionBuilder,
    (
      CachedEhsSiteOb,
      BaseReferences<_$AppDatabase, $CachedEhsSiteObsTable, CachedEhsSiteOb>
    ),
    CachedEhsSiteOb,
    PrefetchHooks Function()> {
  $$CachedEhsSiteObsTableTableManager(
      _$AppDatabase db, $CachedEhsSiteObsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedEhsSiteObsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedEhsSiteObsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedEhsSiteObsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<int> projectId = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<String?> severity = const Value.absent(),
            Value<String> rawData = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedEhsSiteObsCompanion(
            id: id,
            projectId: projectId,
            status: status,
            severity: severity,
            rawData: rawData,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required int projectId,
            required String status,
            Value<String?> severity = const Value.absent(),
            required String rawData,
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedEhsSiteObsCompanion.insert(
            id: id,
            projectId: projectId,
            status: status,
            severity: severity,
            rawData: rawData,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedEhsSiteObsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedEhsSiteObsTable,
    CachedEhsSiteOb,
    $$CachedEhsSiteObsTableFilterComposer,
    $$CachedEhsSiteObsTableOrderingComposer,
    $$CachedEhsSiteObsTableAnnotationComposer,
    $$CachedEhsSiteObsTableCreateCompanionBuilder,
    $$CachedEhsSiteObsTableUpdateCompanionBuilder,
    (
      CachedEhsSiteOb,
      BaseReferences<_$AppDatabase, $CachedEhsSiteObsTable, CachedEhsSiteOb>
    ),
    CachedEhsSiteOb,
    PrefetchHooks Function()>;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$ProgressEntriesTableTableManager get progressEntries =>
      $$ProgressEntriesTableTableManager(_db, _db.progressEntries);
  $$DailyLogsTableTableManager get dailyLogs =>
      $$DailyLogsTableTableManager(_db, _db.dailyLogs);
  $$SyncQueueTableTableManager get syncQueue =>
      $$SyncQueueTableTableManager(_db, _db.syncQueue);
  $$CachedProjectsTableTableManager get cachedProjects =>
      $$CachedProjectsTableTableManager(_db, _db.cachedProjects);
  $$CachedActivitiesTableTableManager get cachedActivities =>
      $$CachedActivitiesTableTableManager(_db, _db.cachedActivities);
  $$CachedBoqItemsTableTableManager get cachedBoqItems =>
      $$CachedBoqItemsTableTableManager(_db, _db.cachedBoqItems);
  $$CachedEpsNodesTableTableManager get cachedEpsNodes =>
      $$CachedEpsNodesTableTableManager(_db, _db.cachedEpsNodes);
  $$CachedQualityActivityListsTableTableManager
      get cachedQualityActivityLists =>
          $$CachedQualityActivityListsTableTableManager(
              _db, _db.cachedQualityActivityLists);
  $$CachedQualityActivitiesTableTableManager get cachedQualityActivities =>
      $$CachedQualityActivitiesTableTableManager(
          _db, _db.cachedQualityActivities);
  $$CachedQualitySiteObsTableTableManager get cachedQualitySiteObs =>
      $$CachedQualitySiteObsTableTableManager(_db, _db.cachedQualitySiteObs);
  $$CachedEhsSiteObsTableTableManager get cachedEhsSiteObs =>
      $$CachedEhsSiteObsTableTableManager(_db, _db.cachedEhsSiteObs);
}
