import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Header used by clients and proxies to correlate a request across services. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Accept only identifiers that are safe to echo into logs and response headers.
 * Anything else is replaced with a server-generated UUID so a hostile client
 * cannot inject newlines or forge another request's identifier.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export interface RequestWithId extends Request {
  requestId?: string;
}

/** Returns a trusted request ID, preferring a well-formed inbound header. */
export function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

/** Reads the ID attached by {@link requestIdMiddleware}. */
export function getRequestId(request: Request & { requestId?: string }): string | undefined {
  return request.requestId;
}

/**
 * Attaches a request ID to the request, echoes it back to the client and makes
 * it available to the exception filter and access log.
 */
export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);
  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
