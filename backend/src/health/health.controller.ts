import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResponse {
  status: 'ok';
  service: 'smartme-api';
  version: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessResponse {
  status: 'ready';
  database: 'up';
  timestamp: string;
}

/**
 * Liveness (`/health`) never touches external systems.
 * Readiness (`/health/ready`) verifies the database connection.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'smartme-api',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ready',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
