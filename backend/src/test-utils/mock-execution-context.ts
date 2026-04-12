import { ExecutionContext } from '@nestjs/common';

export const createMockExecutionContext = (user: any = {}): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;
