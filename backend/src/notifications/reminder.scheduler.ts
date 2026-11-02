import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReminderService } from './reminder.service';

/**
 * Interval-based reminder loop.
 *
 * The scheduler is opt-in (`NOTIFICATIONS_SCHEDULER_ENABLED`) and never starts
 * under Jest, where dispatch is exercised directly. A single process should own
 * the scheduler; the delivery ledger makes overlapping ticks harmless if more
 * than one instance runs by accident.
 */
@Injectable()
export class ReminderScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ReminderScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly reminders: ReminderService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (this.config.get<boolean>('NOTIFICATIONS_ENABLED') !== true) {
      return;
    }
    if (this.config.get<boolean>('NOTIFICATIONS_SCHEDULER_ENABLED') !== true) {
      return;
    }

    const seconds = this.config.get<number>('NOTIFICATIONS_INTERVAL_SECONDS') ?? 300;
    this.timer = setInterval(() => {
      void this.tick();
    }, seconds * 1000);
    this.timer.unref();

    this.logger.log(`Reminder scheduler started with a ${seconds}s interval.`);
    void this.tick();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const summary = await this.reminders.run();
      if (summary.notificationsSent > 0) {
        this.logger.log(
          `Reminder run sent ${summary.notificationsSent} notification(s) across ${summary.usersScanned} learner(s).`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Reminder run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
