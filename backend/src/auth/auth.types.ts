import type { User } from '../generated/prisma/client';
import { AuthProvider, UserStatus } from '../generated/prisma/enums';

export interface ClientContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  tokenType: 'Bearer';
}

export interface AuthUserView {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  status: UserStatus;
  timeZone: string;
  locale: string;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  hasPassword: boolean;
  authProviders: AuthProvider[];
}

export interface AuthResponse {
  user: AuthUserView;
  tokens: AuthTokens;
}

export function toAuthUserView(user: User, providers: AuthProvider[] = []): AuthUserView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    timeZone: user.timeZone,
    locale: user.locale,
    onboardingCompletedAt: user.onboardingCompletedAt,
    createdAt: user.createdAt,
    hasPassword: user.passwordHash !== null,
    authProviders: [...new Set(providers)],
  };
}
