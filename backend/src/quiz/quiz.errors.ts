import { ApiException } from '../common/errors/api-error';

export function quizNotFound(): ApiException {
  return new ApiException('QUIZ_NOT_FOUND', 'Quiz not found.', 404);
}

export function quizAttemptNotFound(): ApiException {
  return new ApiException('QUIZ_ATTEMPT_NOT_FOUND', 'Quiz attempt not found.', 404);
}

export function quizQuestionNotFound(): ApiException {
  return new ApiException('QUIZ_QUESTION_NOT_FOUND', 'Question not found in this quiz.', 404);
}

export function quizOptionNotFound(): ApiException {
  return new ApiException('QUIZ_OPTION_NOT_FOUND', 'Option not found for this question.', 404);
}

export function quizEmpty(): ApiException {
  return new ApiException('QUIZ_EMPTY', 'This quiz has no questions yet.', 422);
}

export function quizAttemptSubmitted(): ApiException {
  return new ApiException(
    'QUIZ_ATTEMPT_SUBMITTED',
    'This quiz attempt has already been submitted.',
    409,
  );
}

export function quizAttemptClosed(): ApiException {
  return new ApiException('QUIZ_ATTEMPT_CLOSED', 'This quiz attempt is no longer active.', 409);
}

export function quizAttemptNotSubmitted(): ApiException {
  return new ApiException(
    'QUIZ_ATTEMPT_NOT_SUBMITTED',
    'Submit this quiz attempt before viewing its results.',
    409,
  );
}

export function quizRequired(): ApiException {
  return new ApiException(
    'QUIZ_REQUIRED',
    "Pass this lesson's quiz before completing the lesson.",
    422,
  );
}

export function quizUnavailable(): ApiException {
  return new ApiException(
    'QUIZ_UNAVAILABLE',
    'This lesson requires a quiz, but no published quiz is available.',
    422,
  );
}
