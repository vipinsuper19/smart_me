import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { RefreshTokenDto } from '../../auth/dto/refresh-token.dto';
import { ClientContext } from '../../auth/auth.types';
import { AdminAuthResponse, AdminPrincipal, AdminUserView } from '../admin.types';
import { CurrentAdmin } from '../current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

function clientContext(request: Request): ClientContext {
  return {
    ipAddress: request.ip || request.socket.remoteAddress,
    userAgent: request.headers['user-agent'],
  };
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: AdminLoginDto, @Req() request: Request): Promise<AdminAuthResponse> {
    return this.auth.login(dto, clientContext(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<AdminAuthResponse> {
    return this.auth.refresh(dto.refreshToken, clientContext(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@CurrentAdmin() admin: AdminPrincipal): Promise<AdminUserView> {
    return this.auth.me(admin.id);
  }
}
