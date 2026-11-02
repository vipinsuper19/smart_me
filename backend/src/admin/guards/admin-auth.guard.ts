import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ApiException } from '../../common/errors/api-error';
import { TokenService } from '../../auth/services/token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminPrincipal, AdminRequest } from '../admin.types';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.bearerToken(request);

    if (!token) {
      throw new ApiException('UNAUTHENTICATED', 'Administrator sign-in is required.', 401);
    }

    const payload = await this.tokens.verifyAdminAccessToken(token);
    const session = await this.prisma.adminSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        adminUserId: true,
        revokedAt: true,
        expiresAt: true,
        adminUser: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (
      !session ||
      session.adminUserId !== payload.adminUserId ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new ApiException(
        'INVALID_ACCESS_TOKEN',
        'Your admin session has expired. Please sign in again.',
        401,
      );
    }

    if (!session.adminUser.isActive || session.adminUser.deletedAt) {
      throw new ApiException(
        'ADMIN_ACCOUNT_UNAVAILABLE',
        'This administrator account is not available.',
        403,
      );
    }

    const admin: AdminPrincipal = {
      id: session.adminUser.id,
      email: session.adminUser.email,
      name: session.adminUser.name,
      role: session.adminUser.role,
      sessionId: payload.sessionId,
    };
    (request as AdminRequest).admin = admin;

    return true;
  }

  private bearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }

    const match = /^Bearer\s+(.+)$/i.exec(header);
    return match?.[1]?.trim() || null;
  }
}
