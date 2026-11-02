import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

@Module({
  imports: [AuthModule, GamificationModule],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}
