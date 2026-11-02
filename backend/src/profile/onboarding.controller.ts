import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { PreferencesService } from './preferences.service';
import { OnboardingCompletionView, OnboardingView } from './profile.types';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<OnboardingView> {
    return this.preferences.getOnboarding(user.id);
  }

  /** An empty body completes onboarding with the existing/default preferences. */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  complete(
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteOnboardingDto = {},
  ): Promise<OnboardingCompletionView> {
    return this.preferences.completeOnboarding(user.id, dto);
  }
}
