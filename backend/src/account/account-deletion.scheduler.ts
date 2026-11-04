import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountService } from './account.service';

/**
 * Interval-based account deletion processor.
 *
 * Requests are created with a grace period, so nothing acts on them until
 * `scheduledFor` passes. The claim inside `processDueDeletions` is atomic, so
 * running more than one instance is safe even though only one usually does the
 * work. The scheduler never starts under Jest, where the processor is exercised
 * directly.
 */
@Injectable()
export class AccountDeletionScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AccountDeletionScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly account: AccountService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (this.config.get<boolean>('ACCOUNT_DELETION_SCHEDULER_ENABLED') !== true) {
      return;
    }

    const seconds = this.config.get<number>('ACCOUNT_DELETION_INTERVAL_SECONDS') ?? 3_600;
    this.timer = setInterval(() => {
      void this.tick();
    }, seconds * 1000);
    this.timer.unref();

    this.logger.log(`Account deletion processor started with a ${seconds}s interval.`);
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
      const completed = await this.account.processDueDeletions();
      if (completed > 0) {
        this.logger.log(`Completed ${completed} account deletion request(s).`);
      }
    } catch (error) {
      this.logger.error(
        `Account deletion run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
