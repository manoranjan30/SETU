import 'package:setu_mobile/features/auth/data/models/user_model.dart';

/// Canonical fake user for all auth tests.
final fakeUser = User(
  id: 1,
  username: 'test_user',
  email: 'test@setu.com',
  fullName: 'Test User',
  roles: ['site_engineer'],
  permissions: ['QUALITY.INSPECTION.APPROVE'],
  projectIds: [10, 20],
  isActive: true,
);

/// Fake user JSON matching the backend login response shape.
final fakeUserJson = {
  'id': 1,
  'username': 'test_user',
  'email': 'test@setu.com',
  'fullName': 'Test User',
  'roles': ['site_engineer'],
  'permissions': ['QUALITY.INSPECTION.APPROVE'],
  'projectIds': [10, 20],
  'isActive': true,
};

/// Fake login response (access token + inline user).
final fakeLoginResponse = {
  'access_token': 'fake_token_abc',
  'refresh_token': 'fake_refresh_xyz',
  'expires_in': 28800,
  'user': fakeUserJson,
};

/// Single fake quality site observation.
final fakeQualityObsJson = {
  'id': 'obs-001',
  'projectId': 10,
  'description': 'Crack in column C5',
  'severity': 'HIGH',
  'status': 'OPEN',
  'createdAt': '2026-04-01T10:00:00.000Z',
  'updatedAt': '2026-04-01T10:00:00.000Z',
  'photoUrls': [],
};

/// Single fake EHS observation.
final fakeEhsObsJson = {
  'id': 'ehs-001',
  'projectId': 10,
  'description': 'Worker without PPE on floor 3',
  'severity': 'HIGH',
  'status': 'OPEN',
  'createdAt': '2026-04-01T10:00:00.000Z',
  'updatedAt': '2026-04-01T10:00:00.000Z',
  'photoUrls': [],
};

/// Single fake project.
final fakeProjectJson = {
  'id': 10,
  'name': 'Purva Bliss',
  'code': 'PB-001',
  'status': 'ACTIVE',
  'progress': 45.5,
  'children': [],
};

/// Fake labor category.
final fakeLaborCategoryJson = {
  'id': 1,
  'name': 'Masons',
  'projectId': 10,
};

/// Fake daily labor entry (server response).
final fakeLaborEntryJson = {
  'categoryId': 1,
  'categoryName': 'Masons',
  'count': 5,
  'contractorName': 'ABC Contractors',
  'date': '2026-04-08',
};
