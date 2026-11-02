import { Logger } from '@nestjs/common';
import type {
  NotificationMessage,
  NotificationSendResult,
  NotificationSender,
} from './notification-sender';

/**
 * Development adapter. It logs the reminder instead of contacting FCM so the
 * scheduler, dedupe and preference rules can be exercised offline.
 */
export class MockNotificationSender implements NotificationSender {
  private readonly logger = new Logger(MockNotificationSender.name);

  async send(token: string, message: NotificationMessage): Promise<NotificationSendResult> {
    this.logger.debug(`Mock push to ...${token.slice(-8)}: ${message.title}`);
    return { token, success: true };
  }
}
