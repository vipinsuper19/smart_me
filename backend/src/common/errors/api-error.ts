import { HttpException } from '@nestjs/common';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  /** Correlates this response with server logs and the x-request-id header. */
  requestId?: string;
}

/**
 * Application error with a stable machine-readable code. The global exception
 * filter converts this into the envelope documented in ADR 0004.
 */
export class ApiException extends HttpException {
  constructor(code: string, message: string, status: number, details?: ApiErrorDetail[]) {
    const body: ApiErrorBody = { code, message };
    if (details?.length) {
      body.details = details;
    }

    super(body, status);
  }
}
