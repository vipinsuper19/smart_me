import { ApiException } from '../common/errors/api-error';

export const deviceTokenNotFound = (): ApiException =>
  new ApiException('DEVICE_NOT_FOUND', 'That notification device was not found.', 404);

export const deviceLimitReached = (): ApiException =>
  new ApiException(
    'DEVICE_LIMIT_REACHED',
    'You have reached the maximum number of registered devices. Remove one before adding another.',
    422,
  );

export const notificationsNotConfigured = (): ApiException =>
  new ApiException(
    'NOTIFICATIONS_NOT_CONFIGURED',
    'Notifications are enabled but the push credentials are incomplete.',
    503,
  );
