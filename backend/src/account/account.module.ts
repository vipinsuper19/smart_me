import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountDeletionScheduler } from './account-deletion.scheduler';
import { AccountService } from './account.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AccountController],
  providers: [AccountService, AccountDeletionScheduler],
})
export class AccountModule {}
