import { ApiException } from '../common/errors/api-error';

export const userNotFound = (): ApiException =>
  new ApiException('USER_NOT_FOUND', 'User account was not found.', 404);
