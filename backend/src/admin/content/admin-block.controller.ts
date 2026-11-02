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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminRole } from '../../generated/prisma/enums';
import { adminActionContext } from '../admin-context';
import { AdminRoles } from '../admin-roles.decorator';
import { AdminPrincipal } from '../admin.types';
import { CurrentAdmin } from '../current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { CreateBlockDto, ReorderDto, UpdateBlockDto } from '../dto/content.dto';
import { AdminContentService } from './admin-content.service';

const CONTENT_WRITE = [AdminRole.CONTENT_EDITOR, AdminRole.SUPER_ADMIN] as const;

@Controller('admin')
@UseGuards(AdminAuthGuard, AdminRolesGuard)
export class AdminBlockController {
  constructor(private readonly content: AdminContentService) {}

  @Get('lessons/:id/blocks')
  listBlocks(@Param('id') lessonId: string) {
    return this.content.listBlocks(lessonId);
  }

  @Post('lessons/:id/blocks')
  @AdminRoles(...CONTENT_WRITE)
  createBlock(
    @Param('id') lessonId: string,
    @Body() dto: CreateBlockDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.createBlock(lessonId, dto, adminActionContext(request, admin));
  }

  @Post('lessons/:id/blocks/reorder')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.OK)
  reorderBlocks(
    @Param('id') lessonId: string,
    @Body() dto: ReorderDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.reorderBlocks(lessonId, dto, adminActionContext(request, admin));
  }

  @Patch('blocks/:id')
  @AdminRoles(...CONTENT_WRITE)
  updateBlock(
    @Param('id') id: string,
    @Body() dto: UpdateBlockDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ) {
    return this.content.updateBlock(id, dto, adminActionContext(request, admin));
  }

  @Delete('blocks/:id')
  @AdminRoles(...CONTENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBlock(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    return this.content.deleteBlock(id, adminActionContext(request, admin));
  }
}
