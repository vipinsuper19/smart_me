import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { notificationsNotConfigured } from '../notifications.errors';
import type {
  NotificationMessage,
  NotificationSendResult,
  NotificationSender,
} from './notification-sender';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects';

interface FcmErrorBody {
  error?: {
    status?: string;
    message?: string;
    details?: { errorCode?: string }[];
  };
}

function isInvalidToken(status: number, body: FcmErrorBody | null): boolean {
  if (status === 404) {
    return true;
  }
  if (body?.error?.status === 'NOT_FOUND' || body?.error?.status === 'INVALID_ARGUMENT') {
    return true;
  }
  return Boolean(
    body?.error?.details?.some(
      (detail) => detail.errorCode === 'UNREGISTERED' || detail.errorCode === 'INVALID_ARGUMENT',
    ),
  );
}

/**
 * Firebase Cloud Messaging HTTP v1 sender.
 *
 * Credentials are read lazily, so an environment with notifications disabled
 * can boot without a service account.
 */
export class FcmNotificationSender implements NotificationSender {
  private readonly logger = new Logger(FcmNotificationSender.name);
  private auth: GoogleAuth | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(token: string, message: NotificationMessage): Promise<NotificationSendResult> {
    const projectId = this.config.get<string>('FCM_PROJECT_ID');
    if (!projectId) {
      throw notificationsNotConfigured();
    }

    const accessToken = await this.accessToken();
    const url = `${FCM_ENDPOINT}/${encodeURIComponent(projectId)}/messages:send`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, body: message.body },
            ...(message.data ? { data: message.data } : {}),
            android: { priority: 'normal' },
          },
        }),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`FCM request for ...${token.slice(-8)} failed: ${reason}`);
      return { token, success: false, error: 'FCM_UNREACHABLE' };
    }

    if (response.ok) {
      return { token, success: true };
    }

    let body: FcmErrorBody | null = null;
    try {
      body = (await response.json()) as FcmErrorBody;
    } catch {
      body = null;
    }

    this.logger.warn(
      `FCM rejected ...${token.slice(-8)} with HTTP ${response.status}: ${
        body?.error?.message ?? 'unknown error'
      }`,
    );

    return {
      token,
      success: false,
      invalidToken: isInvalidToken(response.status, body),
      error: body?.error?.status ?? `HTTP_${response.status}`,
    };
  }

  private async accessToken(): Promise<string> {
    const credentialsJson = this.config.get<string>('FCM_SERVICE_ACCOUNT_JSON');
    if (!credentialsJson) {
      throw notificationsNotConfigured();
    }

    if (!this.auth) {
      let credentials: Record<string, unknown>;
      try {
        credentials = JSON.parse(credentialsJson) as Record<string, unknown>;
      } catch {
        throw notificationsNotConfigured();
      }
      this.auth = new GoogleAuth({ credentials, scopes: [FCM_SCOPE] });
    }

    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) {
      throw notificationsNotConfigured();
    }
    return token.token;
  }
}
