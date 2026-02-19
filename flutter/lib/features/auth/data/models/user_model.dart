import 'package:equatable/equatable.dart';

/// User model representing authenticated user
class User extends Equatable {
  final int id;
  final String username;
  final String email;
  final String fullName;
  final List<String> roles;
  final List<int> projectIds;
  final String? phone;
  final String? designation;
  final bool isActive;

  const User({
    required this.id,
    required this.username,
    required this.email,
    required this.fullName,
    this.roles = const [],
    this.projectIds = const [],
    this.phone,
    this.designation,
    this.isActive = true,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int? ?? 0,
      username: json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      fullName: json['fullName'] as String? ?? json['full_name'] as String? ?? '',
      roles: (json['roles'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      projectIds: (json['projectIds'] as List<dynamic>?)
              ?.map((e) => e as int)
              .toList() ??
          [],
      phone: json['phone'] as String?,
      designation: json['designation'] as String?,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'fullName': fullName,
      'roles': roles,
      'projectIds': projectIds,
      'phone': phone,
      'designation': designation,
      'isActive': isActive,
    };
  }

  /// Check if user has a specific role
  bool hasRole(String role) => roles.contains(role);

  /// Check if user has any of the specified roles
  bool hasAnyRole(List<String> roleList) =>
      roles.any((role) => roleList.contains(role));

  /// Check if user has access to a specific project
  bool hasProjectAccess(int projectId) => projectIds.contains(projectId);

  /// Get user initials for avatar
  String get initials {
    final parts = fullName.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    } else if (parts.isNotEmpty && parts[0].isNotEmpty) {
      return parts[0][0].toUpperCase();
    }
    return username[0].toUpperCase();
  }

  @override
  List<Object?> get props => [
        id,
        username,
        email,
        fullName,
        roles,
        projectIds,
        phone,
        designation,
        isActive,
      ];
}
