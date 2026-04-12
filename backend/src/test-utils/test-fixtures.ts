import { User } from '../users/user.entity';

export const fakeUser = (): Partial<User> => ({
  id: 1,
  username: 'testuser',
  passwordHash: '$2b$10$somehashedpassword',
  isActive: true,
  displayName: 'Test User',
  email: 'test@example.com',
  isTempUser: false,
  isFirstLogin: false,
  roles: [],
});

export const fakeAdminUser = (): Partial<User> => ({
  id: 2,
  username: 'admin',
  passwordHash: '$2b$10$somehashedpassword',
  isActive: true,
  displayName: 'Admin User',
  isTempUser: false,
  isFirstLogin: false,
  roles: [{ id: 1, name: 'Admin' } as any],
});

export const fakeJwtPayload = () => ({
  sub: 1,
  username: 'testuser',
  roles: ['Viewer'],
  permissions: ['QUALITY.INSPECTION.READ'],
  project_ids: [10],
  isTempUser: false,
  isFirstLogin: false,
});

export const fakeRequest = (user: any = fakeJwtPayload()) => ({
  user,
  headers: {},
  params: {},
  query: {},
  body: {},
});
