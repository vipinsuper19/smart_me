import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/errors/validation-exception.factory';
import { createHttpLoggingMiddleware } from './common/logging/http-logging.middleware';
import { requestIdMiddleware } from './common/logging/request-context';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('PORT', 3001);
  const corsOrigins = config
    .get<string>('CORS_ORIGIN', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (config.get<boolean>('TRUST_PROXY')) {
    app.set('trust proxy', 1);
  }

  // Correlation IDs and access logs come first so every later middleware and
  // error response shares the same request ID.
  app.use(requestIdMiddleware);
  app.use(
    createHttpLoggingMiddleware({
      enabled: config.get<boolean>('LOG_HTTP_REQUESTS', true),
      slowRequestMs: config.get<number>('LOG_SLOW_REQUEST_MS', 1_000),
    }),
  );

  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(port);
  Logger.log(
    `API listening on http://localhost:${port}/api/v1 (env=${config.get<string>('NODE_ENV')})`,
    'Bootstrap',
  );
}

void bootstrap();
