import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '../../generated/prisma/enums';
import { AdminRoles } from '../admin-roles.decorator';
import {
  AnalyticsQueryDto,
  ListSubscriptionsQueryDto,
  ListUsersQueryDto,
} from '../dto/overview.dto';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminOverviewService } from './admin-overview.service';

const BUSINESS_READ = [AdminRole.SUPER_ADMIN, AdminRole.ANALYST] as const;

@Controller('admin')
@UseGuards(AdminAuthGuard, AdminRolesGuard)
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get('dashboard')
  dashboard() {
    return this.overview.dashboard();
  }

  @Get('users')
  @AdminRoles(...BUSINESS_READ)
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.overview.listUsers(query);
  }

  @Get('users/:id')
  @AdminRoles(...BUSINESS_READ)
  getUser(@Param('id') id: string) {
    return this.overview.getUser(id);
  }

  @Get('subscriptions')
  @AdminRoles(...BUSINESS_READ)
  listSubscriptions(@Query() query: ListSubscriptionsQueryDto) {
    return this.overview.listSubscriptions(query);
  }

  @Get('subscriptions/:id')
  @AdminRoles(...BUSINESS_READ)
  getSubscription(@Param('id') id: string) {
    return this.overview.getSubscription(id);
  }

  @Get('subscription-plans')
  @AdminRoles(...BUSINESS_READ)
  listPlans() {
    return this.overview.listPlans();
  }

  @Get('analytics/overview')
  @AdminRoles(...BUSINESS_READ)
  analytics(@Query() query: AnalyticsQueryDto) {
    return this.overview.analytics(query);
  }
}
