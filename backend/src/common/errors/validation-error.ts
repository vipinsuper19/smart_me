import { ApiException } from './api-error';

/** Builds the standard validation envelope for a single field. */
export function validationError(field: string, message: string): ApiException {
  return new ApiException('VALIDATION_ERROR', 'Please check the submitted fields.', 400, [
    { field, message },
  ]);
}
