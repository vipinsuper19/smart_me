import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProgressService } from './progress.service';
import { ProgressOverviewView, ProgressWeeklyView } from './gamification.types';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: AuthUser): Promise<ProgressOverviewView> {
    return this.progress.getOverview(user.id);
  }

  @Get('weekly')
  getWeekly(@CurrentUser() user: AuthUser): Promise<ProgressWeeklyView> {
    return this.progress.getWeekly(user.id);
  }
}
