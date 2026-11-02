import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingWebhookController } from './billing.webhook.controller';
import { GooglePlayPurchaseVerifier } from './services/google-play-purchase.verifier';
import { MockPurchaseVerifier } from './services/mock-purchase.verifier';
import { PURCHASE_VERIFIER } from './services/purchase-verifier';

/**
 * Store verification is selected by `BILLING_PROVIDER`. The mock adapter lets
 * local development and tests exercise entitlements end to end; `env.ts`
 * rejects it when billing is enabled in production.
 */
@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [
    BillingService,
    {
      provide: PURCHASE_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('BILLING_PROVIDER') === 'google_play'
          ? new GooglePlayPurchaseVerifier(config)
          : new MockPurchaseVerifier(),
    },
  ],
})
export class BillingModule {}
