import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GOOGLE_TOKEN_VERIFIER, GoogleOAuthTokenVerifier } from './services/google-token-verifier';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          issuer: config.get<string>('JWT_ISSUER', 'smartme-api'),
          audience: config.get<string>('JWT_AUDIENCE', 'smartme-api'),
        },
        verifyOptions: {
          issuer: config.get<string>('JWT_ISSUER', 'smartme-api'),
          audience: config.get<string>('JWT_AUDIENCE', 'smartme-api'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    {
      provide: GOOGLE_TOKEN_VERIFIER,
      useClass: GoogleOAuthTokenVerifier,
    },
  ],
  exports: [JwtAuthGuard, TokenService, PasswordService],
})
export class AuthModule {}
