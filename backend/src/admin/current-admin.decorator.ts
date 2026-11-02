import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminPrincipal, AdminRequest } from './admin.types';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminPrincipal => {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    return request.admin;
  },
);
