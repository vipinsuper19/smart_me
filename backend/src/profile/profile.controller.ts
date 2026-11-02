import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser } from '../common/auth/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';
import { ProfileView } from './profile.types';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<ProfileView> {
    return this.profile.getProfile(user.id);
  }

  @Patch()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<ProfileView> {
    return this.profile.updateProfile(user.id, dto);
  }
}
