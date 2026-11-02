import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { ApiException } from '../../common/errors/api-error';
import { UserStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../services/token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.bearerToken(request);

    if (!token) {
      throw new ApiException('UNAUTHENTICATED', 'Authentication is required.', 401);
    }

    let payload: { userId: string; sessionId: string };
    try {
      payload = await this.tokens.verifyAccessToken(token);
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        'INVALID_ACCESS_TOKEN',
        'Your session has expired. Please sign in again.',
        401,
      );
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { id: true, email: true, status: true } },
      },
    });

    if (
      !session ||
      session.userId !== payload.userId ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new ApiException(
        'INVALID_ACCESS_TOKEN',
        'Your session has expired. Please sign in again.',
        401,
      );
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new ApiException(
        'ACCOUNT_UNAVAILABLE',
        'This account is not available. Please contact support.',
        403,
      );
    }

    const user: AuthUser = {
      id: session.user.id,
      email: session.user.email,
      sessionId: payload.sessionId,
    };
    (request as AuthenticatedRequest).user = user;

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
