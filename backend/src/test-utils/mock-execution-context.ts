import { ExecutionContext } from '@nestjs/common';

export const createMockExecutionContext = (
  user: any = {},
  handler: Function = () => {},
  cls: Function = class {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
    }),
    getHandler: () => handler,
    getClass: () => cls,
  }) as unknown as ExecutionContext;
