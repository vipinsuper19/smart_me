import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountService, DeletionRequestView } from './account.service';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DeletionRequestDto } from '../auth/dto/deletion-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** Preferred endpoint for the Android account-deletion flow. */
  @Post('deletion-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  requestDeletion(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeletionRequestDto = {},
  ): Promise<DeletionRequestView> {
    return this.account.requestDeletion(user.id, dto.reason);
  }

  /** Alias matching the PRD's `DELETE /api/v1/account` route. */
  @Delete()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeletionRequestDto = {},
  ): Promise<DeletionRequestView> {
    return this.account.requestDeletion(user.id, dto.reason);
  }

  @Get('deletion-request')
  async status(@CurrentUser() user: AuthUser): Promise<{ request: DeletionRequestView | null }> {
    return { request: await this.account.getStatus(user.id) };
  }

  @Delete('deletion-request')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  cancelDeletion(@CurrentUser() user: AuthUser): Promise<DeletionRequestView> {
    return this.account.cancel(user.id);
  }
}
