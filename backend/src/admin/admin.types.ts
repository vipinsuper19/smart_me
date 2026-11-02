import type { Request } from 'express';
import type { AdminRole } from '../generated/prisma/enums';

export interface AdminPrincipal {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  sessionId: string;
}

export interface AdminRequest extends Request {
  admin: AdminPrincipal;
}

export interface AdminActionContext {
  admin: AdminPrincipal;
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  tokenType: 'Bearer';
}

export interface AdminUserView {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  lastLoginAt: Date | null;
}

export interface AdminAuthResponse {
  admin: AdminUserView;
  tokens: AdminTokens;
}
