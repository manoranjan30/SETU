import 'package:equatable/equatable.dart';

/// Represents the currently authenticated user, including their RBAC context.
///
/// The [permissions] list contains dot-separated permission codes
/// (e.g. 'QUALITY.INSPECTION.APPROVE') that gate specific UI actions.
/// The [roles] list contains role names (e.g. 'site_engineer', 'qc_inspector').
/// [projectIds] enumerates the projects this user is assigned to — used to
/// filter project listings and guard cross-project data access.
class User extends Equatable {
  final int id;
  final String username;
  final String email;
  final String fullName;

  /// Role names assigned to this user (e.g. 'admin', 'site_engineer').
  final List<String> roles;

  /// Permission codes for fine-grained UI gating (e.g. 'QUALITY.INSPECTION.APPROVE').
  final List<String> permissions;

  /// Project IDs this user has been explicitly assigned to.
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
    this.permissions = const [],
    this.projectIds = const [],
    this.phone,
    this.designation,
    this.isActive = true,
  });

  /// Parses a user from the /auth/profile API response.
  ///
  /// Handles both camelCase (`fullName`) and snake_case (`full_name`) field
  /// names so we remain compatible with older backend versions that used
  /// snake_case before the NestJS migration.
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int? ?? 0,
      username: json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      // Login response uses displayName; /profile uses fullName / full_name.
      fullName: json['fullName'] as String? ?? json['displayName'] as String? ?? json['full_name'] as String? ?? '',
      // Cast each element to String — the backend may send role objects or plain strings.
      roles: (json['roles'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      // Project IDs — backend sends snake_case (project_ids) from login,
      // camelCase (projectIds) from /profile. Accept both.
      projectIds: ((json['projectIds'] ?? json['project_ids']) as List<dynamic>?)
              ?.map((e) => e as int)
              .toList() ??
          [],
      phone: json['phone'] as String?,
      designation: json['designation'] as String?,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  /// Serialises the user for local caching (e.g. SharedPreferences / Drift).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'fullName': fullName,
      'roles': roles,
      'permissions': permissions,
      'projectIds': projectIds,
      'phone': phone,
      'designation': designation,
      'isActive': isActive,
    };
  }

  /// Returns true if [role] is in this user's role list.
  /// Used for coarse-grained guards (e.g. only admins see Settings).
  bool hasRole(String role) => roles.contains(role);

  /// Returns true if [code] is in the user's permission list.
  /// Permission codes follow the pattern 'DOMAIN.RESOURCE.ACTION'
  /// (e.g. 'QUALITY.INSPECTION.APPROVE').
  bool hasPermission(String code) => permissions.contains(code);

  /// Returns true if the user has at least one role from [roleList].
  /// Useful for multi-role gates (e.g. admin OR project manager can do X).
  bool hasAnyRole(List<String> roleList) =>
      roles.any((role) => roleList.contains(role));

  /// Returns true if this user is assigned to the given project.
  bool hasProjectAccess(int projectId) => projectIds.contains(projectId);

  /// Generates a 1- or 2-character avatar string from the full name.
  ///
  /// Algorithm:
  ///   - Two-word name → first letter of each word, uppercased ("Ravi Kumar" → "RK")
  ///   - Single-word name → first letter uppercased ("Ravi" → "R")
  ///   - Empty name → first letter of username ("ravi" → "R")
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
        permissions,
        projectIds,
        phone,
        designation,
        isActive,
      ];
}
