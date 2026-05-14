import 'package:equatable/equatable.dart';

class DrawingCategory extends Equatable {
  final int id;
  final String name;
  final String code;
  final bool isActive;
  final int? parentId;
  final List<DrawingCategory> children;

  const DrawingCategory({
    required this.id,
    required this.name,
    required this.code,
    this.isActive = true,
    this.parentId,
    this.children = const [],
  });

  factory DrawingCategory.fromJson(Map<String, dynamic> json) {
    return DrawingCategory(
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
      isActive: json['isActive'] as bool? ?? true,
      parentId: json['parentId'] as int? ?? json['parent_id'] as int?,
      children: (json['children'] as List<dynamic>?)
              ?.map((e) => DrawingCategory.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  @override
  List<Object?> get props => [id, name, code, isActive, parentId];
}

class DrawingRevision extends Equatable {
  final int id;
  final int registerId;
  final String revisionNumber;
  final DateTime? revisionDate;
  final String filePath;
  final String originalFileName;
  final int fileSize;
  final String fileType;
  final String status;
  final String? comments;
  final DateTime uploadedAt;

  const DrawingRevision({
    required this.id,
    required this.registerId,
    required this.revisionNumber,
    this.revisionDate,
    required this.filePath,
    required this.originalFileName,
    required this.fileSize,
    required this.fileType,
    required this.status,
    this.comments,
    required this.uploadedAt,
  });

  factory DrawingRevision.fromJson(Map<String, dynamic> json) {
    return DrawingRevision(
      id: json['id'] as int? ?? 0,
      registerId: json['registerId'] as int? ?? json['register_id'] as int? ?? 0,
      revisionNumber: json['revisionNumber'] as String? ??
          json['revision_number'] as String? ??
          '0',
      revisionDate: json['revisionDate'] != null
          ? DateTime.tryParse(json['revisionDate'].toString())
          : null,
      filePath: json['filePath'] as String? ?? json['file_path'] as String? ?? '',
      originalFileName: json['originalFileName'] as String? ??
          json['original_file_name'] as String? ??
          '',
      fileSize: json['fileSize'] as int? ?? json['file_size'] as int? ?? 0,
      fileType: json['fileType'] as String? ?? json['file_type'] as String? ?? '',
      status: json['status'] as String? ?? 'DRAFT',
      comments: json['comments'] as String?,
      uploadedAt: json['uploadedAt'] != null
          ? DateTime.tryParse(json['uploadedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  bool get isDwg =>
      originalFileName.toLowerCase().endsWith('.dwg') ||
      fileType.contains('dwg') ||
      fileType.contains('acad');

  bool get isPdf =>
      originalFileName.toLowerCase().endsWith('.pdf') ||
      fileType.contains('pdf');

  String get fileSizeLabel {
    if (fileSize < 1024) return '${fileSize}B';
    if (fileSize < 1024 * 1024) return '${(fileSize / 1024).toStringAsFixed(0)}KB';
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)}MB';
  }

  @override
  List<Object?> get props =>
      [id, registerId, revisionNumber, filePath, status];
}

class DrawingRegister extends Equatable {
  final int id;
  final int projectId;
  final int categoryId;
  final String? categoryName;
  final String? categoryCode;
  final String drawingNumber;
  final String title;
  final String status;
  final DateTime? statusUpdatedAt;
  final DrawingRevision? currentRevision;

  const DrawingRegister({
    required this.id,
    required this.projectId,
    required this.categoryId,
    this.categoryName,
    this.categoryCode,
    required this.drawingNumber,
    required this.title,
    required this.status,
    this.statusUpdatedAt,
    this.currentRevision,
  });

  factory DrawingRegister.fromJson(Map<String, dynamic> json) {
    final catJson = json['category'] as Map<String, dynamic>?;
    final revJson = json['currentRevision'] as Map<String, dynamic>? ??
        json['current_revision'] as Map<String, dynamic>?;

    return DrawingRegister(
      id: json['id'] as int? ?? 0,
      projectId: json['projectId'] as int? ?? json['project_id'] as int? ?? 0,
      categoryId: json['categoryId'] as int? ??
          json['category_id'] as int? ??
          (catJson?['id'] as int?) ??
          0,
      categoryName: catJson?['name'] as String?,
      categoryCode: catJson?['code'] as String?,
      drawingNumber: json['drawingNumber'] as String? ??
          json['drawing_number'] as String? ??
          '',
      title: json['title'] as String? ?? '',
      status: json['status'] as String? ?? 'PLANNED',
      statusUpdatedAt: json['statusUpdatedAt'] != null
          ? DateTime.tryParse(json['statusUpdatedAt'].toString())
          : null,
      currentRevision:
          revJson != null ? DrawingRevision.fromJson(revJson) : null,
    );
  }

  @override
  List<Object?> get props =>
      [id, projectId, categoryId, drawingNumber, title, status];
}
