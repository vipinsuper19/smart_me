import { ApiException } from '../common/errors/api-error';

export function learningPathNotFound(): ApiException {
  return new ApiException('LEARNING_PATH_NOT_FOUND', 'Learning path not found.', 404);
}

export function courseNotFound(): ApiException {
  return new ApiException('COURSE_NOT_FOUND', 'Course not found.', 404);
}

export function lessonNotFound(): ApiException {
  return new ApiException('LESSON_NOT_FOUND', 'Lesson not found.', 404);
}

export function premiumRequired(): ApiException {
  return new ApiException(
    'PREMIUM_REQUIRED',
    'This lesson requires an active premium subscription.',
    403,
  );
}

export function noContentAvailable(): ApiException {
  return new ApiException('NO_CONTENT_AVAILABLE', 'No published lesson is available.', 404);
}
