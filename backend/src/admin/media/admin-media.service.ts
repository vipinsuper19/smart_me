import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { ApiException } from '../../common/errors/api-error';
import { validationError } from '../../common/errors/validation-error';
import { isPrismaErrorWithCode } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminActionContext } from '../admin.types';
import { AdminAuditService } from '../audit/admin-audit.service';
import { mediaInUse, mediaNotFound } from '../admin.errors';
import { CreateMediaAssetDto, MediaListQueryDto, UpdateMediaAssetDto } from '../dto/media.dto';

function assertUpdateHasFields(dto: object): void {
  if (Object.keys(dto).length === 0) {
    throw validationError('body', 'Provide at least one field to update.');
  }
}

@Injectable()
export class AdminMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: MediaListQueryDto) {
    const where: Prisma.MediaAssetWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { key: { contains: query.search, mode: 'insensitive' } },
              { url: { contains: query.search, mode: 'insensitive' } },
              { altText: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { blocks: true } },
        },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async get(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        blocks: {
          select: {
            id: true,
            lesson: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });
    if (!asset) {
      throw mediaNotFound();
    }
    return asset;
  }

  async create(dto: CreateMediaAssetDto, context: AdminActionContext) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.mediaAsset.create({
          data: {
            key: dto.key,
            url: dto.url,
            type: dto.type,
            mimeType: dto.mimeType,
            sizeBytes: dto.sizeBytes,
            width: dto.width ?? null,
            height: dto.height ?? null,
            durationSeconds: dto.durationSeconds ?? null,
            altText: dto.altText ?? null,
            checksum: dto.checksum ?? null,
            uploadedById: context.admin.id,
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'MEDIA_ASSET_CREATED',
          entityType: 'MEDIA_ASSET',
          entityId: created.id,
          after: created,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return created;
      });
    } catch (error) {
      if (isPrismaErrorWithCode(error, 'P2002')) {
        throw new ApiException(
          'MEDIA_KEY_ALREADY_EXISTS',
          'A media asset with this key already exists.',
          409,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateMediaAssetDto, context: AdminActionContext) {
    assertUpdateHasFields(dto);
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) {
      throw mediaNotFound();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.mediaAsset.update({
          where: { id },
          data: {
            ...(dto.key !== undefined ? { key: dto.key } : {}),
            ...(dto.url !== undefined ? { url: dto.url } : {}),
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.mimeType !== undefined ? { mimeType: dto.mimeType } : {}),
            ...(dto.sizeBytes !== undefined ? { sizeBytes: dto.sizeBytes } : {}),
            ...(dto.width !== undefined ? { width: dto.width } : {}),
            ...(dto.height !== undefined ? { height: dto.height } : {}),
            ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
            ...(dto.altText !== undefined ? { altText: dto.altText } : {}),
            ...(dto.checksum !== undefined ? { checksum: dto.checksum } : {}),
          },
        });

        await this.audit.record(tx, {
          adminUserId: context.admin.id,
          action: 'MEDIA_ASSET_UPDATED',
          entityType: 'MEDIA_ASSET',
          entityId: id,
          before: existing,
          after: updated,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return updated;
      });
    } catch (error) {
      if (isPrismaErrorWithCode(error, 'P2002')) {
        throw new ApiException(
          'MEDIA_KEY_ALREADY_EXISTS',
          'A media asset with this key already exists.',
          409,
        );
      }
      throw error;
    }
  }

  async delete(id: string, context: AdminActionContext): Promise<void> {
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: { _count: { select: { blocks: true } } },
    });
    if (!existing) {
      throw mediaNotFound();
    }
    if (existing._count.blocks > 0) {
      throw mediaInUse();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.mediaAsset.delete({ where: { id } });
      await this.audit.record(tx, {
        adminUserId: context.admin.id,
        action: 'MEDIA_ASSET_DELETED',
        entityType: 'MEDIA_ASSET',
        entityId: id,
        before: existing,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }
}
