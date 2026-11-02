import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { ApiException } from '../../common/errors/api-error';

export const GOOGLE_TOKEN_VERIFIER = Symbol('GOOGLE_TOKEN_VERIFIER');

export interface GoogleIdentity {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
}

export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

/**
 * Verifies Google ID tokens against the configured OAuth client IDs. The
 * verifier is injected through a symbol so tests can substitute a fake without
 * calling Google.
 */
@Injectable()
export class GoogleOAuthTokenVerifier implements GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    const configuredAudience = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!configuredAudience) {
      throw new ApiException(
        'GOOGLE_AUTH_NOT_CONFIGURED',
        'Google sign-in is not configured.',
        503,
      );
    }

    const audience = configuredAudience
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new Error('Google token is missing a verified email');
      }

      return {
        providerUserId: payload.sub,
        email: payload.email,
        emailVerified: true,
        name: payload.name,
        avatarUrl: payload.picture,
      };
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      throw new ApiException('INVALID_GOOGLE_TOKEN', 'Google sign-in could not be verified.', 401);
    }
  }
}
