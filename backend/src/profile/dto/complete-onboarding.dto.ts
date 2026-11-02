import { UpdatePreferencesDto } from './update-preferences.dto';

/**
 * Onboarding completion accepts the same optional fields as preferences. An
 * empty body is valid and means the learner skipped the optional questions.
 */
export class CompleteOnboardingDto extends UpdatePreferencesDto {}
