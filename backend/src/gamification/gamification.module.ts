import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [AuthModule],
  controllers: [GamificationController, ProgressController],
  providers: [GamificationService, ProgressService],
  exports: [GamificationService],
})
export class GamificationModule {}
