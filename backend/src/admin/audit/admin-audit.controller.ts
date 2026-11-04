import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '../../generated/prisma/enums';
import { AdminRoles } from '../admin-roles.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminAuditService } from './admin-audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/**
 * Audit records reveal who did what across every tenant and content object.
 * Restrict them to super admins; analysts and content editors do not need them.
 */
@Controller('admin/audit-logs')
@UseGuards(AdminAuthGuard, AdminRolesGuard)
@AdminRoles(AdminRole.SUPER_ADMIN)
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.audit.list(query);
  }
}
