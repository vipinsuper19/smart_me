import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../generated/prisma/enums';

export const ADMIN_ROLES_KEY = 'admin_roles';

/** Restricts a controller or handler to the listed admin roles. */
export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
