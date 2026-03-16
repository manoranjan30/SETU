import 'package:equatable/equatable.dart';

// ==================== LABOR CATEGORY ====================

/// A labor category master record (e.g. "Mason", "Carpenter", "Helper").
///
/// Categories are defined at the system level and may be extended with
/// project-specific categories by the project admin. The BLoC fetches
/// categories for the current project so custom categories are included.
class LaborCategory extends Equatable {
  final int id;
  final String name;

  /// Optional grouping of categories (e.g. "Skilled", "Unskilled", "Supervisory").
  final String? categoryGroup;

  const LaborCategory({
    required this.id,
    required this.name,
    this.categoryGroup,
  });

  factory LaborCategory.fromJson(Map<String, dynamic> json) {
    return LaborCategory(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      categoryGroup: json['categoryGroup'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, name];
}

// ==================== DAILY LABOR PRESENCE ====================

/// A single row in the daily labor headcount form.
///
/// Represents the number of workers of a given [LaborCategory] present
/// on site for a specific date. Created by merging [LaborCategory] records
/// with any existing presence records returned by the API.
///
/// When the API returns an existing record for the date, [id] is populated
/// (used as the update key). When no record exists for this category yet,
/// [id] is null (a POST will create a new record).
class DailyLaborEntry extends Equatable {
  /// Server-side ID, populated only when editing an existing record.
  final int? id;

  final int categoryId;

  /// Denormalised category name for display — avoids a separate lookup.
  final String categoryName;

  /// Worker count entered by the site engineer.
  final int count;

  /// Optional contractor company name (for records tracked per contractor).
  final String? contractorName;
  final String? remarks;

  const DailyLaborEntry({
    this.id,
    required this.categoryId,
    required this.categoryName,
    required this.count,
    this.contractorName,
    this.remarks,
  });

  /// Parses a presence record from the API response.
  /// The category name comes from the nested `category` relation object.
  factory DailyLaborEntry.fromJson(Map<String, dynamic> json) {
    final cat = json['category'] as Map<String, dynamic>?;
    return DailyLaborEntry(
      id: json['id'] as int?,
      categoryId: json['categoryId'] as int? ?? 0,
      // Category name is in the relation object; fall back to empty string.
      categoryName: cat?['name'] as String? ?? '',
      // count may be serialised as a number type — convert to int.
      count: (json['count'] as num?)?.toInt() ?? 0,
      contractorName: json['contractorName'] as String?,
      remarks: json['remarks'] as String?,
    );
  }

  /// Returns a new [DailyLaborEntry] with the specified fields updated.
  DailyLaborEntry copyWith({int? count, String? contractorName, String? remarks}) {
    return DailyLaborEntry(
      id: id,
      categoryId: categoryId,
      categoryName: categoryName,
      count: count ?? this.count,
      contractorName: contractorName ?? this.contractorName,
      remarks: remarks ?? this.remarks,
    );
  }

  /// Serialises to the API payload for the POST /labor/presence endpoint.
  ///
  /// [date] is passed in from the event rather than stored on the model to
  /// keep the model date-agnostic (same model can be reused across dates).
  /// Optional fields are omitted if empty to reduce payload size.
  Map<String, dynamic> toJson(String date) => {
        if (id != null) 'id': id,
        'date': date,
        'categoryId': categoryId,
        'count': count,
        if (contractorName != null && contractorName!.isNotEmpty)
          'contractorName': contractorName,
        if (remarks != null && remarks!.isNotEmpty) 'remarks': remarks,
      };

  @override
  List<Object?> get props => [id, categoryId, count];
}
