import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  const controller = new HealthController(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports the service as healthy', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('smartme-api');
    expect(result.version).toBeDefined();
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports readiness when the database responds', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ '?column?': 1 }]);

    await expect(controller.ready()).resolves.toMatchObject({
      status: 'ready',
      database: 'up',
    });
  });

  it('returns 503 when the database is unavailable', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('connection refused'));

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
