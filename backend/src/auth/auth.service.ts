import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '../generated/prisma/client';
import { AuthProvider, SessionRevocationReason, UserStatus } from '../generated/prisma/enums';
import { ApiException } from '../common/errors/api-error';
import { isPrismaErrorWithCode } from '../common/prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthResponse,
  AuthTokens,
  AuthUserView,
  ClientContext,
  toAuthUserView,
} from './auth.types';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GOOGLE_TOKEN_VERIFIER, GoogleTokenVerifier } from './services/google-token-verifier';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

type UserWithProviders = User & { identities: { provider: AuthProvider }[] };

class RefreshTokenClaimError extends Error {}

/**
 * Duplicate refresh requests can overlap (for example, several 401 responses
 * triggering a refresh at once). Replaying the just-rotated token inside this
 * window returns 401 without revoking the replacement session. After the
 * window, replaying a rotated token is treated as reuse and revokes the family.
 */
const REFRESH_ROTATION_GRACE_MS = 10_000;

const INVALID_CREDENTIALS = () =>
  new ApiException('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);

const INVALID_REFRESH_TOKEN = () =>
  new ApiException('INVALID_REFRESH_TOKEN', 'Your session has expired. Please sign in again.', 401);

const ACCOUNT_UNAVAILABLE = () =>
  new ApiException(
    'ACCOUNT_UNAVAILABLE',
    'This account is not available. Please contact support.',
    403,
  );

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    @Inject(GOOGLE_TOKEN_VERIFIER)
    private readonly google: GoogleTokenVerifier,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, context: ClientContext): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ApiException(
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email already exists.',
        409,
      );
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const now = new Date();

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: dto.name?.trim() || null,
            termsAcceptedAt: now,
            privacyAcceptedAt: now,
            termsVersion: this.termsVersion(),
          },
        });

        await tx.userIdentity.create({
          data: {
            userId: created.id,
            provider: AuthProvider.EMAIL,
            providerUserId: email,
            providerEmail: email,
          },
        });

        await tx.userStats.create({ data: { userId: created.id } });
        await tx.userPreference.create({ data: { userId: created.id } });
        await tx.userProfile.create({ data: { userId: created.id } });

        return created;
      });
    } catch (error) {
      if (isPrismaErrorWithCode(error, 'P2002')) {
        throw new ApiException(
          'EMAIL_ALREADY_REGISTERED',
          'An account with this email already exists.',
          409,
        );
      }
      throw error;
    }

    return this.createAuthResponse(user, context, [AuthProvider.EMAIL]);
  }

  async login(dto: LoginDto, context: ClientContext): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.passwordHash) {
      // Hash a throwaway value so unknown-email and wrong-password responses
      // have comparable timing.
      await this.passwords.verifyDummy(dto.password);
      throw INVALID_CREDENTIALS();
    }

    const passwordMatches = await this.passwords.verify(user.passwordHash, dto.password);
    if (!passwordMatches) {
      throw INVALID_CREDENTIALS();
    }

    this.assertActive(user);

    if (this.passwords.needsRehash(user.passwordHash)) {
      const passwordHash = await this.passwords.hash(dto.password);
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          lastActiveAt: new Date(),
        },
      });
    }

    return this.createAuthResponse(user, context, [AuthProvider.EMAIL]);
  }

  async googleLogin(dto: GoogleLoginDto, context: ClientContext): Promise<AuthResponse> {
    if (!this.config.get<boolean>('AUTH_GOOGLE_ENABLED')) {
      throw new ApiException('GOOGLE_AUTH_DISABLED', 'Google sign-in is not enabled.', 403);
    }

    const identity = await this.google.verify(dto.idToken);
    const email = this.normalizeEmail(identity.email);
    const now = new Date();

    const linkedIdentity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.GOOGLE,
          providerUserId: identity.providerUserId,
        },
      },
      include: {
        user: {
          include: { identities: { select: { provider: true } } },
        },
      },
    });

    if (linkedIdentity) {
      this.assertActive(linkedIdentity.user);

      const user = await this.prisma.$transaction(async (tx) => {
        await tx.userIdentity.update({
          where: { id: linkedIdentity.id },
          data: { providerEmail: email, lastUsedAt: now },
        });

        return tx.user.update({
          where: { id: linkedIdentity.userId },
          data: {
            lastActiveAt: now,
            name: linkedIdentity.user.name ?? identity.name ?? null,
            avatarUrl: linkedIdentity.user.avatarUrl ?? identity.avatarUrl ?? null,
          },
          include: { identities: { select: { provider: true } } },
        });
      });

      return this.createAuthResponse(user, context, this.providersOf(user));
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { identities: { select: { provider: true } } },
    });

    if (existingUser) {
      this.assertActive(existingUser);

      if (existingUser.identities.some((item) => item.provider === AuthProvider.GOOGLE)) {
        throw new ApiException(
          'GOOGLE_ACCOUNT_ALREADY_LINKED',
          'This email is already linked to a different Google account.',
          409,
        );
      }

      // Google has verified this email, so it is safe to link it to the
      // existing account. Google is the authority for the email address.
      const user = await this.prisma.$transaction(async (tx) => {
        await tx.userIdentity.create({
          data: {
            userId: existingUser.id,
            provider: AuthProvider.GOOGLE,
            providerUserId: identity.providerUserId,
            providerEmail: email,
          },
        });

        return tx.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerifiedAt: existingUser.emailVerifiedAt ?? now,
            name: existingUser.name ?? identity.name ?? null,
            avatarUrl: existingUser.avatarUrl ?? identity.avatarUrl ?? null,
            lastActiveAt: now,
          },
          include: { identities: { select: { provider: true } } },
        });
      });

      return this.createAuthResponse(user, context, this.providersOf(user));
    }

    if (!dto.acceptTerms || !dto.acceptPrivacy) {
      throw new ApiException(
        'TERMS_ACCEPTANCE_REQUIRED',
        'Accept the Terms of Service and Privacy Policy to create an account.',
        422,
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash: null,
          name: identity.name ?? null,
          avatarUrl: identity.avatarUrl ?? null,
          emailVerifiedAt: now,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
          termsVersion: this.termsVersion(),
        },
      });

      await tx.userIdentity.create({
        data: {
          userId: created.id,
          provider: AuthProvider.GOOGLE,
          providerUserId: identity.providerUserId,
          providerEmail: email,
        },
      });

      await tx.userStats.create({ data: { userId: created.id } });
      await tx.userPreference.create({ data: { userId: created.id } });
      await tx.userProfile.create({ data: { userId: created.id } });

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { identities: { select: { provider: true } } },
      });
    });

    return this.createAuthResponse(user, context, this.providersOf(user));
  }

  async refresh(refreshToken: string, context: ClientContext): Promise<AuthResponse> {
    const now = new Date();
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          include: { identities: { select: { provider: true } } },
        },
      },
    });

    if (!session) {
      throw INVALID_REFRESH_TOKEN();
    }

    if (session.revokedAt) {
      const recentlyRotated =
        session.revokedReason === SessionRevocationReason.ROTATED &&
        now.getTime() - session.revokedAt.getTime() <= REFRESH_ROTATION_GRACE_MS;

      if (
        !recentlyRotated &&
        (session.revokedReason === SessionRevocationReason.ROTATED ||
          session.revokedReason === SessionRevocationReason.REUSE_DETECTED)
      ) {
        await this.revokeFamily(session.familyId, SessionRevocationReason.REUSE_DETECTED);
      }

      throw INVALID_REFRESH_TOKEN();
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      throw INVALID_REFRESH_TOKEN();
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      await this.revokeFamily(session.familyId, SessionRevocationReason.ADMIN_REVOKED);
      throw ACCOUNT_UNAVAILABLE();
    }

    const newRefresh = this.tokens.generateRefreshToken(now);
    let newSessionId: string;

    try {
      newSessionId = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.session.updateMany({
          where: { id: session.id, revokedAt: null },
          data: {
            revokedAt: now,
            revokedReason: SessionRevocationReason.ROTATED,
            lastUsedAt: now,
          },
        });

        if (claimed.count !== 1) {
          throw new RefreshTokenClaimError();
        }

        const created = await tx.session.create({
          data: {
            userId: session.userId,
            refreshTokenHash: newRefresh.hash,
            familyId: session.familyId,
            expiresAt: newRefresh.expiresAt,
            ipAddress: this.truncate(context.ipAddress, 64),
            userAgent: this.truncate(context.userAgent, 512),
          },
        });

        await tx.session.update({
          where: { id: session.id },
          data: { replacedBySessionId: created.id },
        });

        await tx.user.update({
          where: { id: session.userId },
          data: { lastActiveAt: now },
        });

        return created.id;
      });
    } catch (error) {
      if (error instanceof RefreshTokenClaimError) {
        // The session was unrevoked when it was first read, so another request
        // claimed it concurrently. Keep the winner's replacement session valid.
        throw INVALID_REFRESH_TOKEN();
      }

      throw error;
    }

    const access = await this.tokens.issueAccessToken(session.userId, newSessionId);

    return {
      user: toAuthUserView(session.user, this.providersOf(session.user)),
      tokens: this.authTokens(access, newRefresh),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      select: { id: true, revokedAt: true },
    });

    if (!session || session.revokedAt) {
      return;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokedReason: SessionRevocationReason.LOGOUT,
      },
    });
  }

  async me(userId: string): Promise<AuthUserView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identities: { select: { provider: true } } },
    });

    if (!user) {
      throw new ApiException('UNAUTHENTICATED', 'Authentication is required.', 401);
    }

    this.assertActive(user);

    return toAuthUserView(user, this.providersOf(user));
  }

  private async createAuthResponse(
    user: User,
    context: ClientContext,
    providers: AuthProvider[],
  ): Promise<AuthResponse> {
    const now = new Date();
    const refresh = this.tokens.generateRefreshToken(now);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: refresh.hash,
          familyId: this.tokens.newFamilyId(),
          expiresAt: refresh.expiresAt,
          ipAddress: this.truncate(context.ipAddress, 64),
          userAgent: this.truncate(context.userAgent, 512),
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastActiveAt: now },
      });

      return created;
    });

    const access = await this.tokens.issueAccessToken(user.id, session.id);

    return {
      user: toAuthUserView(user, providers),
      tokens: this.authTokens(access, refresh),
    };
  }

  private authTokens(
    access: { token: string; expiresAt: Date },
    refresh: { token: string; expiresAt: Date },
  ): AuthTokens {
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: refresh.expiresAt,
      tokenType: 'Bearer',
    };
  }

  private providersOf(user: UserWithProviders): AuthProvider[] {
    return user.identities.map((identity) => identity.provider);
  }

  private async revokeFamily(familyId: string, reason: SessionRevocationReason): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private assertActive(user: { status: UserStatus }): void {
    if (user.status !== UserStatus.ACTIVE) {
      throw ACCOUNT_UNAVAILABLE();
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private termsVersion(): string {
    return this.config.get<string>('TERMS_VERSION', '2026-10-21');
  }

  private truncate(value: string | undefined, maxLength: number): string | null {
    return value ? value.slice(0, maxLength) : null;
  }
}
