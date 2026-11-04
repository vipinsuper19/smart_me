import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { createHttpLoggingMiddleware, formatAccessLogLine } from './http-logging.middleware';

function loggerStub() {
  return {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function responseStub(statusCode: number): Response & EventEmitter {
  const response = new EventEmitter() as Response & EventEmitter;
  response.statusCode = statusCode;
  return response;
}

describe('HTTP access logging', () => {
  it('formats a single parseable line without the query string', () => {
    expect(
      formatAccessLogLine({
        method: 'GET',
        path: '/api/v1/lessons',
        status: 200,
        durationMs: 12.345,
        requestId: 'req-12345678',
      }),
    ).toBe('GET /api/v1/lessons status=200 durationMs=12.3 requestId=req-12345678');
  });

  it('logs a completed request with its correlation ID', () => {
    const logger = loggerStub();
    const middleware = createHttpLoggingMiddleware({ logger, slowRequestMs: 5_000 });
    const request = {
      method: 'GET',
      originalUrl: '/api/v1/courses?search=private-term',
      requestId: 'req-12345678',
    } as unknown as Request;
    const response = responseStub(200);
    const next = jest.fn() as NextFunction;

    middleware(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);

    response.emit('finish');

    expect(logger.log).toHaveBeenCalledTimes(1);
    const line = logger.log.mock.calls[0][0] as string;
    expect(line).toContain('GET /api/v1/courses status=200');
    expect(line).toContain('requestId=req-12345678');
    expect(line).not.toContain('private-term');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('promotes client errors and slow responses to warnings', () => {
    const logger = loggerStub();
    const middleware = createHttpLoggingMiddleware({ logger, slowRequestMs: 0 });
    const request = {
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      requestId: 'req-12345678',
    } as unknown as Request;
    const response = responseStub(401);

    middleware(request, response, jest.fn() as NextFunction);
    response.emit('finish');

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('logs server errors at error level', () => {
    const logger = loggerStub();
    const middleware = createHttpLoggingMiddleware({ logger });
    const request = {
      method: 'GET',
      originalUrl: '/api/v1/health',
    } as unknown as Request;
    const response = responseStub(503);

    middleware(request, response, jest.fn() as NextFunction);
    response.emit('finish');

    expect(logger.error).toHaveBeenCalledWith(
      'GET /api/v1/health status=503 durationMs=0.0 requestId=-',
    );
  });

  it('does nothing when access logging is disabled', () => {
    const logger = loggerStub();
    const middleware = createHttpLoggingMiddleware({ enabled: false, logger });
    const response = responseStub(200);
    const next = jest.fn() as NextFunction;

    middleware({} as Request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.log).not.toHaveBeenCalled();
  });
});
