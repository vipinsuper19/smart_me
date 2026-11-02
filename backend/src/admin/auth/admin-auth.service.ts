import { Injectable } from '@nestjs/common';
import type { AdminUser } from '../../generated/prisma/client';
import { SessionRevocationReason } from '../../generated/prisma/enums';
import { ApiException } from '../../common/errors/api-error';
import { PasswordService } from '../../auth/services/password.service';
import { TokenService } from '../../auth/services/token.service';
import { ClientContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuthResponse, AdminTokens, AdminUserView } from '../admin.types';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminLoginDto } from './dto/admin-login.dto';

class RefreshTokenClaimError extends Error {}

const REFRESH_ROTATION_GRACE_MS = 10_000;

const INVALID_CREDENTIALS = () =>
  new ApiException('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);

const INVALID_REFRESH_TOKEN = () =>
  new ApiException(
    'INVALID_REFRESH_TOKEN',
    'Your admin session has expired. Please sign in again.',
    401,
  );

const ADMIN_UNAVAILABLE = () =>
  new ApiException(
    'ADMIN_ACCOUNT_UNAVAILABLE',
    'This administrator account is not available.',
    403,
  );

function toAdminView(admin: AdminUser): AdminUserView {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt,
  };
}

/** Separate credential and session realm for administrators. */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AdminAuditService,
  ) {}

  async login(dto: AdminLoginDto, context: ClientContext): Promise<AdminAuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });

    if (!admin) {
      await this.passwords.verifyDummy(dto.password);
      throw INVALID_CREDENTIALS();
    }

    const valid = await this.passwords.verify(admin.passwordHash, dto.password);
    if (!valid || !admin.isActive || admin.deletedAt) {
      throw INVALID_CREDENTIALS();
    }

    if (this.passwords.needsRehash(admin.passwordHash)) {
      await this.prisma.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash: await this.passwords.hash(dto.password) },
      });
    }

    const response = await this.createAuthResponse(admin, context);
    return response;
  }

  async refresh(refreshToken: string, context: ClientContext): Promise<AdminAuthResponse> {
    const now = new Date();
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.prisma.adminSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { adminUser: true },
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

    if (!session.adminUser.isActive || session.adminUser.deletedAt) {
      await this.revokeFamily(session.familyId, SessionRevocationReason.ADMIN_REVOKED);
      throw ADMIN_UNAVAILABLE();
    }

    const newRefresh = this.tokens.generateRefreshToken(now);
    let newSessionId: string;

    try {
      newSessionId = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.adminSession.updateMany({
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

        const created = await tx.adminSession.create({
          data: {
            adminUserId: session.adminUserId,
            refreshTokenHash: newRefresh.hash,
            familyId: session.familyId,
            expiresAt: newRefresh.expiresAt,
            ipAddress: this.truncate(context.ipAddress, 64),
            userAgent: this.truncate(context.userAgent, 512),
          },
        });

        await tx.adminSession.update({
          where: { id: session.id },
          data: { replacedBySessionId: created.id },
        });

        return created.id;
      });
    } catch (error) {
      if (error instanceof RefreshTokenClaimError) {
        throw INVALID_REFRESH_TOKEN();
      }
      throw error;
    }

    const access = await this.tokens.issueAdminAccessToken(session.adminUserId, newSessionId);

    return {
      admin: toAdminView(session.adminUser),
      tokens: this.adminTokens(access, newRefresh),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.adminSession.findUnique({
      where: { refreshTokenHash: this.tokens.hashRefreshToken(refreshToken) },
      select: { id: true, revokedAt: true },
    });

    if (!session || session.revokedAt) {
      return;
    }

    await this.prisma.adminSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokedReason: SessionRevocationReason.LOGOUT,
      },
    });
  }

  async me(adminUserId: string): Promise<AdminUserView> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminUserId } });

    if (!admin || admin.deletedAt) {
      throw new ApiException('ADMIN_NOT_FOUND', 'Administrator account was not found.', 404);
    }
    if (!admin.isActive) {
      throw ADMIN_UNAVAILABLE();
    }

    return toAdminView(admin);
  }

  private async createAuthResponse(
    admin: AdminUser,
    context: ClientContext,
  ): Promise<AdminAuthResponse> {
    const now = new Date();
    const refresh = this.tokens.generateRefreshToken(now);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminSession.create({
        data: {
          adminUserId: admin.id,
          refreshTokenHash: refresh.hash,
          familyId: this.tokens.newFamilyId(),
          expiresAt: refresh.expiresAt,
          ipAddress: this.truncate(context.ipAddress, 64),
          userAgent: this.truncate(context.userAgent, 512),
        },
      });

      const updated = await tx.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: now },
      });

      await this.audit.record(tx, {
        adminUserId: admin.id,
        action: 'ADMIN_LOGIN',
        entityType: 'ADMIN_USER',
        entityId: admin.id,
        after: { email: updated.email, role: updated.role },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return { session: created, admin: updated };
    });

    const access = await this.tokens.issueAdminAccessToken(admin.id, session.session.id);

    return {
      admin: toAdminView(session.admin),
      tokens: this.adminTokens(access, refresh),
    };
  }

  private adminTokens(
    access: { token: string; expiresAt: Date },
    refresh: { token: string; expiresAt: Date },
  ): AdminTokens {
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: refresh.expiresAt,
      tokenType: 'Bearer',
    };
  }

  private async revokeFamily(
    familyId: string | null,
    reason: SessionRevocationReason,
  ): Promise<void> {
    if (!familyId) {
      return;
    }

    await this.prisma.adminSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private truncate(value: string | undefined, maxLength: number): string | null {
    return value ? value.slice(0, maxLength) : null;
  }
}
