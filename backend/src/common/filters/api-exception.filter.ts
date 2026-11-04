import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorBody, ApiErrorDetail, ApiException } from '../errors/api-error';
import { getRequestId, type RequestWithId } from '../logging/request-context';

interface ErrorWithCode {
  code: string;
  message?: string;
}

const STATUS_CODES: Record<number, { code: string; message: string }> = {
  [HttpStatus.BAD_REQUEST]: {
    code: 'BAD_REQUEST',
    message: 'The request could not be processed.',
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: 'UNAUTHENTICATED',
    message: 'Authentication is required.',
  },
  [HttpStatus.FORBIDDEN]: {
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
  },
  [HttpStatus.NOT_FOUND]: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  },
  [HttpStatus.CONFLICT]: {
    code: 'CONFLICT',
    message: 'The request conflicts with the current state.',
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    code: 'BUSINESS_RULE_VIOLATION',
    message: 'The request violates a business rule.',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable.',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorWithCode(value: unknown): value is ErrorWithCode {
  return isRecord(value) && typeof value.code === 'string';
}

function hasDetails(value: unknown): value is ApiErrorDetail[] {
  return Array.isArray(value);
}

/**
 * One error envelope for every route. Unknown errors are logged but never
 * exposed to clients; validation and Prisma errors get stable codes.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = getRequestId(request as RequestWithId);

    const { status, body } = this.toError(exception);
    const responseBody: ApiErrorBody = requestId ? { ...body, requestId } : body;

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `${request.method} ${request.path} -> ${status} ${body.code} requestId=${requestId ?? '-'}`,
        stack,
      );
    }

    response.status(status).json({ error: responseBody });
  }

  private toError(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof ApiException) {
      const response = exception.getResponse() as ApiErrorBody;
      return {
        status: exception.getStatus(),
        body: {
          code: response.code,
          message: response.message,
          ...(response.details?.length ? { details: response.details } : {}),
        },
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (isErrorWithCode(exception)) {
      const prismaError = this.fromPrismaError(exception.code);
      if (prismaError) {
        return prismaError;
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    };
  }

  private fromHttpException(exception: HttpException): {
    status: number;
    body: ApiErrorBody;
  } {
    const status = exception.getStatus();
    const response = exception.getResponse();
    const fallback = STATUS_CODES[status] ?? {
      code: 'HTTP_ERROR',
      message: 'The request could not be completed.',
    };

    let body: ApiErrorBody = { ...fallback };

    if (typeof response === 'string') {
      body.message = response;
    } else if (isRecord(response)) {
      if (typeof response.code === 'string') {
        body.code = response.code;
      }

      const messages = response.message;
      if (Array.isArray(messages)) {
        body = {
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted fields.',
          details: messages.map((message) => ({ message: String(message) })),
        };
      } else if (typeof messages === 'string') {
        body.message = messages;
      }

      if (hasDetails(response.details)) {
        body.details = response.details;
      }
    }

    return { status, body };
  }

  private fromPrismaError(code: string): { status: number; body: ApiErrorBody } | null {
    switch (code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: 'CONFLICT',
            message: 'A record with these details already exists.',
          },
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: 'RELATION_CONFLICT',
            message: 'This record is still referenced by other data.',
          },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            code: 'NOT_FOUND',
            message: 'The requested record was not found.',
          },
        };
      default:
        return null;
    }
  }
}
