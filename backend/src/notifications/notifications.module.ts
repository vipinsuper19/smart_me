import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderScheduler } from './reminder.scheduler';
import { ReminderService } from './reminder.service';
import { FcmNotificationSender } from './senders/fcm-notification.sender';
import { MockNotificationSender } from './senders/mock-notification.sender';
import { NOTIFICATION_SENDER } from './senders/notification-sender';

/**
 * `NOTIFICATIONS_PROVIDER` selects the push adapter. Preferences and device
 * registration work regardless of whether delivery is switched on.
 */
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ReminderService,
    ReminderScheduler,
    {
      provide: NOTIFICATION_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('NOTIFICATIONS_PROVIDER') === 'fcm'
          ? new FcmNotificationSender(config)
          : new MockNotificationSender(),
    },
  ],
})
export class NotificationsModule {}
