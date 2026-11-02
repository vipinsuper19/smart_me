import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OnboardingController } from './onboarding.controller';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController, PreferencesController, OnboardingController],
  providers: [ProfileService, PreferencesService],
})
export class ProfileModule {}
