import 'package:flutter_test/flutter_test.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';

void main() {
  group('User.fromJson', () {
    test('parses all fields from a complete JSON map', () {
      final json = {
        'id': 42,
        'username': 'ravi_kumar',
        'email': 'ravi@setu.com',
        'fullName': 'Ravi Kumar',
        'roles': ['site_engineer', 'qc_inspector'],
        'permissions': ['QUALITY.INSPECTION.APPROVE'],
        'projectIds': [1, 2, 3],
        'phone': '9876543210',
        'designation': 'Site Engineer',
        'isActive': true,
        'isTempUser': false,
      };

      final user = User.fromJson(json);

      expect(user.id, 42);
      expect(user.username, 'ravi_kumar');
      expect(user.email, 'ravi@setu.com');
      expect(user.fullName, 'Ravi Kumar');
      expect(user.roles, ['site_engineer', 'qc_inspector']);
      expect(user.permissions, ['QUALITY.INSPECTION.APPROVE']);
      expect(user.projectIds, [1, 2, 3]);
      expect(user.phone, '9876543210');
      expect(user.designation, 'Site Engineer');
      expect(user.isActive, true);
      expect(user.isTempUser, false);
    });

    test('uses displayName fallback when fullName is absent', () {
      final json = {
        'id': 1,
        'username': 'u',
        'email': 'u@x.com',
        'displayName': 'Display Name',
      };
      final user = User.fromJson(json);
      expect(user.fullName, 'Display Name');
    });

    test('uses snake_case full_name as third fallback', () {
      final json = {
        'id': 1,
        'username': 'u',
        'email': 'u@x.com',
        'full_name': 'Snake Case Name',
      };
      final user = User.fromJson(json);
      expect(user.fullName, 'Snake Case Name');
    });

    test('handles missing optional fields with safe defaults', () {
      final json = {
        'id': 1,
        'username': 'minimal',
        'email': 'min@test.com',
      };
      final user = User.fromJson(json);
      expect(user.fullName, '');
      expect(user.roles, isEmpty);
      expect(user.permissions, isEmpty);
      expect(user.projectIds, isEmpty);
      expect(user.phone, isNull);
      expect(user.isActive, true);
      expect(user.isTempUser, false);
    });

    test('accepts both projectIds (camelCase) and project_ids (snake_case)', () {
      final snakeJson = {'id': 1, 'username': 'u', 'email': 'u@x.com', 'project_ids': [5, 6]};
      final camelJson = {'id': 1, 'username': 'u', 'email': 'u@x.com', 'projectIds': [7, 8]};

      expect(User.fromJson(snakeJson).projectIds, [5, 6]);
      expect(User.fromJson(camelJson).projectIds, [7, 8]);
    });

    test('parses temp user with nested vendor object', () {
      final json = {
        'id': 1,
        'username': 'vendor_u',
        'email': 'v@x.com',
        'isTempUser': true,
        'vendor': {'id': 99, 'name': 'ABC Contractors'},
      };
      final user = User.fromJson(json);
      expect(user.isTempUser, true);
      expect(user.vendorId, 99);
      expect(user.vendorName, 'ABC Contractors');
    });
  });

  group('User.toJson round-trip', () {
    test('toJson output can be parsed back to equal User', () {
      final original = User(
        id: 7,
        username: 'roundtrip',
        email: 'rt@test.com',
        fullName: 'Round Trip',
        roles: ['admin'],
        permissions: ['READ'],
        projectIds: [1],
      );
      final parsed = User.fromJson(original.toJson());
      expect(parsed, original);
    });
  });

  group('User helper methods', () {
    final user = User(
      id: 1,
      username: 'u',
      email: 'u@x.com',
      fullName: 'Ravi Kumar',
      roles: ['site_engineer', 'admin'],
      permissions: ['QUALITY.INSPECTION.APPROVE', 'EHS.OBS.CREATE'],
      projectIds: [10, 20],
    );

    test('hasRole returns true for an assigned role', () {
      expect(user.hasRole('admin'), true);
    });

    test('hasRole returns false for an unassigned role', () {
      expect(user.hasRole('qc_inspector'), false);
    });

    test('hasPermission returns true for an assigned permission', () {
      expect(user.hasPermission('EHS.OBS.CREATE'), true);
    });

    test('hasPermission returns false for an unassigned permission', () {
      expect(user.hasPermission('UNKNOWN.PERM'), false);
    });

    test('hasAnyRole returns true when at least one role matches', () {
      expect(user.hasAnyRole(['qc_inspector', 'admin']), true);
    });

    test('hasAnyRole returns false when no roles match', () {
      expect(user.hasAnyRole(['vendor', 'guest']), false);
    });

    test('hasProjectAccess returns true for an assigned project', () {
      expect(user.hasProjectAccess(10), true);
    });

    test('hasProjectAccess returns false for an unassigned project', () {
      expect(user.hasProjectAccess(99), false);
    });

    test('initials returns two-letter initial for a two-word name', () {
      expect(user.initials, 'RK');
    });

    test('initials returns one letter for a single-word name', () {
      final singleName = User(id: 1, username: 'u', email: 'u@x.com', fullName: 'Ravi');
      expect(singleName.initials, 'R');
    });

    test('initials falls back to username first letter when fullName is empty', () {
      final noName = User(id: 1, username: 'ravi', email: 'u@x.com', fullName: '');
      expect(noName.initials, 'R');
    });
  });
}
