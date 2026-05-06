import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type RequestUser = { id: string; email?: string };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | null => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    return req.user ?? null;
  },
);
