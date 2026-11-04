import { Logger } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getRequestId, type RequestWithId } from './request-context';

export interface AccessLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId?: string;
}

/**
 * One line per request, in a format log shippers can parse with a simple
 * pattern. Query strings are dropped so search terms and tokens never reach the
 * log store; the request ID links the line to an error response when needed.
 */
export function formatAccessLogLine(entry: AccessLogEntry): string {
  return [
    `${entry.method} ${entry.path}`,
    `status=${entry.status}`,
    `durationMs=${entry.durationMs.toFixed(1)}`,
    `requestId=${entry.requestId ?? '-'}`,
  ].join(' ');
}

export interface HttpLoggingOptions {
  enabled?: boolean;
  slowRequestMs?: number;
  logger?: Pick<Logger, 'log' | 'warn' | 'error'>;
}

/**
 * Logs completed requests without blocking the response. Slow successful
 * requests are promoted to warnings so performance regressions are visible.
 */
export function createHttpLoggingMiddleware(options: HttpLoggingOptions = {}): RequestHandler {
  const enabled = options.enabled ?? true;
  const slowRequestMs = options.slowRequestMs ?? 1_000;
  const logger = options.logger ?? new Logger('HTTP');

  return (request: Request, response: Response, next: NextFunction): void => {
    if (!enabled) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();
    const withId = request as RequestWithId;

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const line = formatAccessLogLine({
        method: request.method,
        path: request.originalUrl.split('?')[0],
        status: response.statusCode,
        durationMs,
        requestId: getRequestId(withId),
      });

      if (response.statusCode >= 500) {
        logger.error(line);
      } else if (response.statusCode >= 400 || durationMs >= slowRequestMs) {
        logger.warn(line);
      } else {
        logger.log(line);
      }
    });

    next();
  };
}
