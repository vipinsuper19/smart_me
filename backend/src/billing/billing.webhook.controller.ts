import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import type { BillingWebhookResultView } from './billing.types';

/**
 * Billing provider callbacks. These routes intentionally sit outside the
 * learner JWT guard: they are authenticated with a shared secret configured on
 * the Pub/Sub push subscription, and every delivery is idempotent by
 * `(provider, messageId)`.
 */
@Controller('subscriptions/webhooks')
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('google-play')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  googlePlay(
    @Body() body: unknown,
    @Headers('x-smartme-rtdn-secret') headerSecret: string | undefined,
    @Query('token') querySecret: string | undefined,
  ): Promise<BillingWebhookResultView> {
    return this.billing.handleGooglePlayNotification(body, headerSecret ?? querySecret);
  }
}
