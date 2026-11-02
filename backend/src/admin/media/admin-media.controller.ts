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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminRole } from '../../generated/prisma/enums';
import { adminActionContext } from '../admin-context';
import { AdminRoles } from '../admin-roles.decorator';
import { AdminPrincipal } from '../admin.types';
import { CurrentAdmin } from '../current-admin.decorator';
import { CreateMediaAssetDto, MediaListQueryDto, UpdateMediaAssetDto } from '../dto/media.dto';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminMediaService } from './admin-media.service';

const CONTENT_WRITE = [AdminRole.CONTENT_EDITOR, AdminRole.SUPER_ADMIN] as const;

@Controller('admin/media')
@UseGuards(AdminAuthGuard, AdminRolesGuard)
export class AdminMediaController {
  constructor(private readonly media: AdminMediaService) {}

  @Get()
  list(@Query() query: MediaListQueryDto) {
    return this.media.list(query);
  }

  @Post()
  @AdminRoles(...CONTENT_WRITE)
  create(
    @Body() dto: CreateMediaAssetDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.media.create(dto, adminActionContext(request, admin));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.media.get(id);
  }

  @Patch(':id')
  @AdminRoles(...CONTENT_WRITE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMediaAssetDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.media.update(id, dto, adminActionContext(request, admin));
  }

  @Delete(':id')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.media.delete(id, adminActionContext(request, admin));
  }
}
