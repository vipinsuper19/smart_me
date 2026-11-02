import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AdminOverviewService } from '../admin/overview/admin-overview.service';
import { AnalyticsQueryDto } from '../admin/dto/overview.dto';
import { ApiException } from '../common/errors/api-error';
import { DevicePlatform } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { IngestAnalyticsDto } from './analytics.dto';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
};

describeIfDatabase('Analytics ingestion integration', () => {
  jest.setTimeout(30_000);

  let prisma: PrismaService;
  let analytics: AnalyticsService;
  let overview: AdminOverviewService;
  let userId: string;
  let email: string;
  let namePrefix: string;

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();
    analytics = new AnalyticsService(prisma);
    overview = new AdminOverviewService(prisma);

    namePrefix = `auto_test_${randomUUID().slice(0, 8)}`;
    email = `${namePrefix}@example.com`;
    const user = await prisma.user.create({ data: { email, name: 'Analytics Test' } });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.analyticsEvent.deleteMany({ where: { name: { startsWith: namePrefix } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  function batch(events: Partial<IngestAnalyticsDto['events'][number]>[]): IngestAnalyticsDto {
    return { events } as IngestAnalyticsDto;
  }

  it('stores a batch against the authenticated learner', async () => {
    const result = await analytics.ingest(
      userId,
      batch([
        {
          name: `${namePrefix}_lesson_opened`,
          properties: { lessonId: 'lesson_1', source: 'home' },
          appVersion: '1.0.0',
          sessionId: 'session-1',
        },
        {
          name: `${namePrefix}_quiz_submitted`,
          properties: { quizId: 'quiz_1', scorePercent: 80 },
          platform: DevicePlatform.ANDROID,
        },
      ]),
    );

    expect(result.accepted).toBe(2);

    const events = await prisma.analyticsEvent.findMany({
      where: { name: { startsWith: namePrefix } },
      orderBy: { name: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.userId === userId)).toBe(true);
    expect(events.map((event) => event.name)).toEqual([
      `${namePrefix}_lesson_opened`,
      `${namePrefix}_quiz_submitted`,
    ]);
    expect(events[0].properties).toMatchObject({ lessonId: 'lesson_1', source: 'home' });
    expect(events[0].appVersion).toBe('1.0.0');
    expect(events[0].sessionId).toBe('session-1');
    expect(events[0].platform).toBe(DevicePlatform.ANDROID);
    expect(events[1].appVersion).toBeNull();
    expect(events[1].sessionId).toBeNull();
  });

  it('strips personal fields before persisting properties', async () => {
    await analytics.ingest(
      userId,
      batch([
        {
          name: `${namePrefix}_profile_view`,
          properties: {
            section: 'account',
            email: 'learner@example.com',
            accessToken: 'super-secret',
            nested: { phone: '+911234567890', safe: 'kept' },
          },
        },
      ]),
    );

    const event = await prisma.analyticsEvent.findFirstOrThrow({
      where: { name: `${namePrefix}_profile_view` },
    });
    expect(event.properties).toEqual({ section: 'account', nested: { safe: 'kept' } });
    expect(JSON.stringify(event.properties)).not.toContain('learner@example.com');
  });

  it('rejects properties above the size budget', async () => {
    const properties: Record<string, string> = {};
    for (let index = 0; index < 10; index += 1) {
      properties[`field${index}`] = 'x'.repeat(500);
    }

    let caught: unknown;
    try {
      await analytics.ingest(userId, batch([{ name: `${namePrefix}_oversized`, properties }]));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiException);
    expect((caught as ApiException).getStatus()).toBe(400);
    expect(((caught as ApiException).getResponse() as { code: string }).code).toBe(
      'VALIDATION_ERROR',
    );
    expect(await prisma.analyticsEvent.count({ where: { name: `${namePrefix}_oversized` } })).toBe(
      0,
    );
  });

  it('exposes product event totals and top names in the admin overview', async () => {
    await analytics.ingest(
      userId,
      batch([
        { name: `${namePrefix}_home_view` },
        { name: `${namePrefix}_home_view` },
        { name: `${namePrefix}_lesson_opened` },
      ]),
    );

    const result = await overview.analytics(Object.assign(new AnalyticsQueryDto(), { days: 7 }));

    expect(result.productEvents.total).toBeGreaterThanOrEqual(3);
    const home = result.productEvents.top.find((event) => event.name === `${namePrefix}_home_view`);
    expect(home?.count).toBe(2);
    expect(result.productEvents.top.length).toBeLessThanOrEqual(5);
    const counts = result.productEvents.top.map((event) => event.count);
    expect(counts).toEqual([...counts].sort((left, right) => right - left));
  });
});
