import { Injectable } from '@nestjs/common';
import { validationError } from '../common/errors/validation-error';
import type { Prisma } from '../generated/prisma/client';
import { DevicePlatform } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { IngestAnalyticsDto } from './analytics.dto';
import { MAX_PROPERTIES_BYTES, sanitizeAnalyticsProperties } from './sanitize-properties';

export interface IngestAnalyticsView {
  accepted: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(userId: string, dto: IngestAnalyticsDto): Promise<IngestAnalyticsView> {
    const data = dto.events.map((event, index) => {
      const properties = sanitizeAnalyticsProperties(event.properties);

      if (
        properties &&
        Buffer.byteLength(JSON.stringify(properties), 'utf8') > MAX_PROPERTIES_BYTES
      ) {
        throw validationError(
          `events.${index}.properties`,
          `properties must be ${MAX_PROPERTIES_BYTES} bytes or smaller.`,
        );
      }

      return {
        userId,
        name: event.name,
        ...(properties ? { properties: properties as Prisma.InputJsonValue } : {}),
        platform: event.platform ?? DevicePlatform.ANDROID,
        appVersion: event.appVersion ?? null,
        sessionId: event.sessionId ?? null,
      };
    });

    await this.prisma.analyticsEvent.createMany({ data });

    return { accepted: data.length };
  }
}
