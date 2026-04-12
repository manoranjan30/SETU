import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { createMockExecutionContext } from '../test-utils/mock-execution-context';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('passes when no @Permissions decorator is set', () => {
    const handler = () => {};
    const ctx = createMockExecutionContext({ roles: [], permissions: [] }, handler);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes for Admin user regardless of permissions', () => {
    const handler = () => {};
    Reflect.defineMetadata('permissions', ['QUALITY.READ'], handler);
    const ctx = createMockExecutionContext({ roles: ['Admin'], permissions: [] }, handler);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when user has the required permission', () => {
    const handler = () => {};
    Reflect.defineMetadata('permissions', ['QUALITY.READ'], handler);
    const ctx = createMockExecutionContext(
      { roles: ['Viewer'], permissions: ['QUALITY.READ'] },
      handler,
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user lacks permission', () => {
    const handler = () => {};
    Reflect.defineMetadata('permissions', ['QUALITY.APPROVE'], handler);
    const ctx = createMockExecutionContext(
      { roles: ['Viewer'], permissions: ['QUALITY.READ'] },
      handler,
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
