import { REQUEST_ID_HEADER, requestIdMiddleware, resolveRequestId } from './request-context';
import type { Request, Response } from 'express';
import type { NextFunction } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('request id', () => {
  it('reuses a well-formed inbound request ID', () => {
    expect(resolveRequestId('proxy-request-1234')).toBe('proxy-request-1234');
  });

  it('generates a UUID when the header is missing or unsafe', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID);
    expect(resolveRequestId('short')).toMatch(UUID);
    expect(resolveRequestId('bad\nheader-value')).toMatch(UUID);
    expect(resolveRequestId(['first-valid-id', 'second-valid-id'])).toBe('first-valid-id');
  });

  it('attaches the ID to the request and response', () => {
    const request = {
      headers: { [REQUEST_ID_HEADER]: 'proxy-request-1234' },
    } as unknown as Request;
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(request as Parameters<typeof requestIdMiddleware>[0], response, next);

    expect(request).toMatchObject({ requestId: 'proxy-request-1234' });
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'proxy-request-1234');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
