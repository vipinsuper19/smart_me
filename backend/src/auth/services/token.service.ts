import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ApiException } from '../../common/errors/api-error';
import { addSeconds } from '../../common/utils/duration';

interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access' | 'admin_access';
}

export interface GeneratedRefreshToken {
  token: string;
  hash: string;
  expiresAt: Date;
}

interface IssuedAccessToken {
  token: string;
  expiresAt: Date;
}

/**
 * Creates and verifies short-lived access JWTs and opaque refresh tokens.
 * Refresh tokens are random 256-bit values; only their SHA-256 hash is stored.
 */
@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = config.getOrThrow<number>('JWT_ACCESS_TTL');
    this.refreshTtlSeconds = config.getOrThrow<number>('JWT_REFRESH_TTL');
  }

  async issueAccessToken(userId: string, sessionId: string): Promise<IssuedAccessToken> {
    const now = new Date();
    const expiresAt = addSeconds(now, this.accessTtlSeconds);
    const token = await this.jwt.signAsync({
      sub: userId,
      sid: sessionId,
      typ: 'access',
    });

    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; sessionId: string }> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);

      if (
        payload.typ !== 'access' ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        throw new Error('Invalid access token payload');
      }

      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new ApiException(
        'INVALID_ACCESS_TOKEN',
        'Your session has expired. Please sign in again.',
        401,
      );
    }
  }

  /**
   * Admin tokens carry a distinct `typ` claim and are verified by the admin
   * guard only. A learner access token can never be replayed against admin
   * routes even though both realms share the signing secret.
   */
  async issueAdminAccessToken(adminUserId: string, sessionId: string): Promise<IssuedAccessToken> {
    const now = new Date();
    const expiresAt = addSeconds(now, this.accessTtlSeconds);
    const token = await this.jwt.signAsync({
      sub: adminUserId,
      sid: sessionId,
      typ: 'admin_access',
    });

    return { token, expiresAt };
  }

  async verifyAdminAccessToken(token: string): Promise<{ adminUserId: string; sessionId: string }> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);

      if (
        payload.typ !== 'admin_access' ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        throw new Error('Invalid admin access token payload');
      }

      return { adminUserId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new ApiException(
        'INVALID_ACCESS_TOKEN',
        'Your admin session has expired. Please sign in again.',
        401,
      );
    }
  }

  generateRefreshToken(now = new Date()): GeneratedRefreshToken {
    const token = `rt_${randomBytes(32).toString('base64url')}`;

    return {
      token,
      hash: this.hashRefreshToken(token),
      expiresAt: addSeconds(now, this.refreshTtlSeconds),
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  newFamilyId(): string {
    return randomUUID();
  }
}
