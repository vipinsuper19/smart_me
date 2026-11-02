import { ApiException } from '../common/errors/api-error';

function notFound(code: string, message: string): ApiException {
  return new ApiException(code, message, 404);
}

export const learningPathNotFound = () =>
  notFound('LEARNING_PATH_NOT_FOUND', 'Learning path was not found.');

export const courseNotFound = () => notFound('COURSE_NOT_FOUND', 'Course was not found.');

export const moduleNotFound = () => notFound('MODULE_NOT_FOUND', 'Course module was not found.');

export const lessonNotFound = () => notFound('LESSON_NOT_FOUND', 'Lesson was not found.');

export const contentBlockNotFound = () =>
  notFound('CONTENT_BLOCK_NOT_FOUND', 'Lesson content block was not found.');

export const quizNotFound = () => notFound('QUIZ_NOT_FOUND', 'Quiz was not found.');

export const questionNotFound = () => notFound('QUESTION_NOT_FOUND', 'Question was not found.');

export const optionNotFound = () =>
  notFound('QUESTION_OPTION_NOT_FOUND', 'Question option was not found.');

export const mediaNotFound = () => notFound('MEDIA_NOT_FOUND', 'Media asset was not found.');

export const userNotFound = () => notFound('USER_NOT_FOUND', 'User was not found.');

export const subscriptionNotFound = () =>
  notFound('SUBSCRIPTION_NOT_FOUND', 'Subscription was not found.');

export const adminNotFound = () =>
  notFound('ADMIN_NOT_FOUND', 'Administrator account was not found.');

export const contentInUse = () =>
  new ApiException(
    'CONTENT_IN_USE',
    'This content has learner history and cannot be deleted. Archive it instead.',
    409,
  );

export const mediaInUse = () =>
  new ApiException('MEDIA_IN_USE', 'This media asset is still referenced by lesson content.', 409);

export const quizHasAttempts = () =>
  new ApiException(
    'QUIZ_HAS_ATTEMPTS',
    'This quiz has learner attempts. Create a new quiz version before changing questions or options.',
    409,
  );

export const quizAlreadyPublished = () =>
  new ApiException(
    'QUIZ_ALREADY_PUBLISHED',
    'Another version of this lesson quiz is already published. Archive it first.',
    409,
  );

export const invalidStatusTransition = (message: string) =>
  new ApiException('INVALID_STATUS_TRANSITION', message, 409);

export const publicationBlocked = (message: string, field = 'status') =>
  new ApiException('PUBLICATION_BLOCKED', 'This content is not ready to publish.', 422, [
    { field, message },
  ]);

export const invalidBlockPayload = (message: string) =>
  new ApiException('VALIDATION_ERROR', 'Please check the submitted fields.', 400, [
    { field: 'payload', message },
  ]);
