import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Single Prisma client for the application. Nest manages its lifecycle so
 * connections are closed cleanly on shutdown.
 *
 * Prisma 7 uses the node-postgres driver adapter. Its pool defaults differ from
 * the old Rust engine, so a 5-second connection timeout is set explicitly to
 * match the previous behaviour and fail fast when PostgreSQL is unavailable.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    super({
      adapter: new PrismaPg({
        connectionString,
        max: Number(config.get('DATABASE_POOL_MAX') ?? 10),
        connectionTimeoutMillis: 5_000,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
