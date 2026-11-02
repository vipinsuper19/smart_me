import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import type {
  RestorePurchasesView,
  SubscriptionMeView,
  SubscriptionPlanView,
  VerifyPurchaseView,
} from './billing.types';
import { RestorePurchasesDto, VerifyPurchaseDto } from './dto/purchase.dto';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  listPlans(): Promise<{ items: SubscriptionPlanView[] }> {
    return this.billing.listPlans();
  }

  @Get('me')
  getMySubscription(@CurrentUser() user: AuthUser): Promise<SubscriptionMeView> {
    return this.billing.getMySubscription(user.id);
  }

  @Post('verify-purchase')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyPurchase(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyPurchaseDto,
  ): Promise<VerifyPurchaseView> {
    return this.billing.verifyPurchase(user.id, dto);
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  restorePurchases(
    @CurrentUser() user: AuthUser,
    @Body() dto: RestorePurchasesDto,
  ): Promise<RestorePurchasesView> {
    return this.billing.restorePurchases(user.id, dto);
  }
}
