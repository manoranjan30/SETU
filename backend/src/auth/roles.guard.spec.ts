import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { createMockExecutionContext } from '../test-utils/mock-execution-context';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('passes when no @Roles decorator is set', () => {
    // handler with no metadata → reflector returns undefined → guard passes
    const handler = () => {};
    const ctx = createMockExecutionContext({ roles: [] }, handler);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when user has the required role', () => {
    const handler = () => {};
    Reflect.defineMetadata(ROLES_KEY, ['Admin'], handler);
    const ctx = createMockExecutionContext({ roles: ['Admin'] }, handler);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks when user does not have the required role', () => {
    const handler = () => {};
    Reflect.defineMetadata(ROLES_KEY, ['Admin'], handler);
    const ctx = createMockExecutionContext({ roles: ['Viewer'] }, handler);
    expect(guard.canActivate(ctx)).toBe(false);
  });
});
