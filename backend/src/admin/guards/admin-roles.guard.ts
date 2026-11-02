import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../../common/errors/api-error';
import { AdminRole } from '../../generated/prisma/enums';
import { ADMIN_ROLES_KEY } from '../admin-roles.decorator';
import { AdminRequest } from '../admin.types';

/**
 * Server-side RBAC. `SUPER_ADMIN` implicitly satisfies every requirement;
 * other roles must be listed explicitly on the handler or controller.
 */
@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      return true;
    }

    const admin = context.switchToHttp().getRequest<AdminRequest>().admin;
    if (!admin) {
      throw new ApiException('UNAUTHENTICATED', 'Administrator sign-in is required.', 401);
    }

    if (admin.role === AdminRole.SUPER_ADMIN || required.includes(admin.role)) {
      return true;
    }

    throw new ApiException(
      'FORBIDDEN',
      'Your administrator role does not permit this action.',
      403,
    );
  }
}
