import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IngestAnalyticsDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';
import type { IngestAnalyticsView } from './analytics.service';

/**
 * Client product-event ingestion. The learner id always comes from the access
 * token, never from the payload, so one account cannot write events for another.
 */
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  ingest(
    @CurrentUser() user: AuthUser,
    @Body() dto: IngestAnalyticsDto,
  ): Promise<IngestAnalyticsView> {
    return this.analytics.ingest(user.id, dto);
  }
}
