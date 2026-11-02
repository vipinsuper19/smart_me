import { Request } from 'express';
import { AdminActionContext, AdminPrincipal } from './admin.types';

export function adminActionContext(request: Request, admin: AdminPrincipal): AdminActionContext {
  return {
    admin,
    ipAddress: request.ip || request.socket.remoteAddress,
    userAgent: request.headers['user-agent'],
  };
}
