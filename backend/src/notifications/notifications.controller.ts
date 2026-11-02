import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterDeviceDto, UpdateNotificationPreferencesDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';
import type { DeviceTokenView, NotificationPreferenceView } from './notifications.types';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthUser): Promise<NotificationPreferenceView> {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('preferences')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferenceView> {
    return this.notifications.updatePreferences(user.id, dto);
  }

  @Get('devices')
  listDevices(@CurrentUser() user: AuthUser): Promise<{ items: DeviceTokenView[] }> {
    return this.notifications.listDevices(user.id);
  }

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  registerDevice(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceTokenView> {
    return this.notifications.registerDevice(user.id, dto);
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDevice(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.notifications.removeDevice(user.id, id);
  }
}
