import { ArgumentsHost, Logger } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ApiException } from '../errors/api-error';
import { validationExceptionFactory } from '../errors/validation-exception.factory';
import { ApiExceptionFilter } from './api-exception.filter';

interface MockHost {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
}

function mockHost(requestId?: string): MockHost {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, json }),
      getRequest: () => ({
        method: 'POST',
        originalUrl: '/api/v1/auth/login',
        ...(requestId ? { requestId } : {}),
      }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the stable error envelope for application errors', () => {
    const { host, status, json } = mockHost();

    filter.catch(
      new ApiException('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401),
      host,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      },
    });
  });

  it('renders validation details with field paths', () => {
    const { host, status, json } = mockHost();
    const validationError = new ValidationError();
    validationError.property = 'email';
    validationError.constraints = { isEmail: 'Enter a valid email address.' };

    filter.catch(validationExceptionFactory([validationError]), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the submitted fields.',
        details: [{ field: 'email', message: 'Enter a valid email address.' }],
      },
    });
  });

  it('does not leak unknown errors', () => {
    const { host, status, json } = mockHost();

    filter.catch(new Error('database password is hunter2'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('hunter2');
  });

  it('includes the request ID in the error envelope for support', () => {
    const { host, json } = mockHost('req-12345678');

    filter.catch(new ApiException('NOT_FOUND', 'The requested resource was not found.', 404), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        requestId: 'req-12345678',
      },
    });
  });
});
