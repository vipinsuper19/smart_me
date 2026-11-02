import { ApiException } from '../common/errors/api-error';

export const billingDisabled = () =>
  new ApiException(
    'BILLING_DISABLED',
    'Subscriptions and billing are not enabled on this environment.',
    503,
  );

export const billingNotConfigured = () =>
  new ApiException(
    'BILLING_NOT_CONFIGURED',
    'Billing is enabled but the store credentials are incomplete.',
    503,
  );

export const unknownProduct = (productId: string) =>
  new ApiException('UNKNOWN_PRODUCT', 'This subscription product is not available.', 422, [
    { field: 'productId', message: `No active plan is mapped to "${productId}".` },
  ]);

export const invalidPurchase = (message = 'The purchase could not be verified with the store.') =>
  new ApiException('INVALID_PURCHASE', message, 422);

export const purchaseAlreadyClaimed = () =>
  new ApiException(
    'PURCHASE_ALREADY_CLAIMED',
    'This purchase is already linked to another account.',
    409,
  );

export const purchaseOwnershipMismatch = () =>
  new ApiException(
    'PURCHASE_OWNERSHIP_MISMATCH',
    'This purchase was made for a different account.',
    409,
  );

export const subscriptionNotFound = () =>
  new ApiException('SUBSCRIPTION_NOT_FOUND', 'Subscription was not found.', 404);

export const invalidWebhookSecret = () =>
  new ApiException(
    'INVALID_WEBHOOK_SECRET',
    'The billing notification could not be authenticated.',
    401,
  );

export const invalidWebhookPayload = (message: string) =>
  new ApiException('INVALID_WEBHOOK_PAYLOAD', 'The billing notification is malformed.', 400, [
    { field: 'message', message },
  ]);

export const billingProcessingFailed = () =>
  new ApiException(
    'BILLING_PROCESSING_FAILED',
    'The billing notification could not be processed. The store may retry it.',
    503,
  );
