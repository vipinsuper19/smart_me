import { ValidationError } from 'class-validator';
import { ApiErrorDetail, ApiException } from './api-error';

function flatten(error: ValidationError, parentPath = ''): ApiErrorDetail[] {
  const path = parentPath ? `${parentPath}.${error.property}` : error.property;
  const details: ApiErrorDetail[] = [];

  for (const message of Object.values(error.constraints ?? {})) {
    details.push({ field: path, message });
  }

  for (const child of error.children ?? []) {
    details.push(...flatten(child, path));
  }

  return details;
}

/**
 * Converts class-validator output into the stable `VALIDATION_ERROR` shape.
 * Field paths use dot notation so nested payloads stay unambiguous.
 */
export function validationExceptionFactory(errors: ValidationError[]): ApiException {
  const details = errors.flatMap((error) => flatten(error));

  return new ApiException('VALIDATION_ERROR', 'Please check the submitted fields.', 400, details);
}
