import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { GamificationService } from './gamification.service';
import {
  AchievementListView,
  GamificationSummaryView,
  XPTransactionListView,
} from './gamification.types';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthUser): Promise<GamificationSummaryView> {
    return this.gamification.getSummary(user.id);
  }

  @Get('achievements')
  getAchievements(@CurrentUser() user: AuthUser): Promise<AchievementListView> {
    return this.gamification.getAchievements(user.id);
  }

  @Get('transactions')
  listTransactions(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<XPTransactionListView> {
    return this.gamification.listTransactions(user.id, query);
  }
}
