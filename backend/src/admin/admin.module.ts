import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminAuditController } from './audit/admin-audit.controller';
import { AdminAuditService } from './audit/admin-audit.service';
import { AdminBlockController } from './content/admin-block.controller';
import { AdminContentController } from './content/admin-content.controller';
import { AdminContentService } from './content/admin-content.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';
import { AdminMediaController } from './media/admin-media.controller';
import { AdminMediaService } from './media/admin-media.service';
import { AdminOverviewController } from './overview/admin-overview.controller';
import { AdminOverviewService } from './overview/admin-overview.service';
import { AdminQuizController } from './quiz/admin-quiz.controller';
import { AdminQuizService } from './quiz/admin-quiz.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminAuthController,
    AdminContentController,
    AdminBlockController,
    AdminQuizController,
    AdminMediaController,
    AdminAuditController,
    AdminOverviewController,
  ],
  providers: [
    AdminAuthService,
    AdminAuditService,
    AdminContentService,
    AdminQuizService,
    AdminMediaService,
    AdminOverviewService,
    AdminAuthGuard,
    AdminRolesGuard,
  ],
})
export class AdminModule {}
