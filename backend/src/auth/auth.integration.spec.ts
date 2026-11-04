import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthResponse } from './auth.types';
import { GoogleTokenVerifier } from './services/google-token-verifier';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { RegisterDto } from './dto/register.dto';
import {
  AuthProvider,
  DeletionRequestStatus,
  SessionRevocationReason,
  UserStatus,
} from '../generated/prisma/enums';
import { ApiException } from '../common/errors/api-error';
import { AuthenticatedRequest } from '../common/auth/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../account/account.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDatabase = DATABASE_URL ? describe : describe.skip;

const baseConfig = {
  DATABASE_URL: DATABASE_URL ?? '',
  DATABASE_POOL_MAX: 5,
  JWT_ACCESS_SECRET: 'test-access-secret-0000000000000000000000',
  JWT_REFRESH_SECRET: 'test-refresh-secret-000000000000000000000',
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 2_592_000,
  JWT_ISSUER: 'smartme-api',
  JWT_AUDIENCE: 'smartme-api',
  AUTH_GOOGLE_ENABLED: false,
  TERMS_VERSION: 'test-terms',
  ACCOUNT_DELETION_GRACE_DAYS: 30,
};

describeIfDatabase('Auth and account integration', () => {
  jest.setTimeout(30_000);

  const config = new ConfigService(baseConfig);
  const googleConfig = new ConfigService({
    ...baseConfig,
    AUTH_GOOGLE_ENABLED: true,
    GOOGLE_CLIENT_ID: 'test-client-id',
  });

  const jwt = new JwtService({
    secret: baseConfig.JWT_ACCESS_SECRET,
    signOptions: { issuer: baseConfig.JWT_ISSUER, audience: baseConfig.JWT_AUDIENCE },
    verifyOptions: { issuer: baseConfig.JWT_ISSUER, audience: baseConfig.JWT_AUDIENCE },
  });
  const passwords = new PasswordService();
  const tokens = new TokenService(jwt, config);
  const googleVerifier: GoogleTokenVerifier = { verify: jest.fn() };

  let prisma: PrismaService;
  let auth: AuthService;
  let googleAuth: AuthService;
  let account: AccountService;
  const emails: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService(baseConfig));
    await prisma.$connect();
    auth = new AuthService(prisma, passwords, tokens, googleVerifier, config);
    googleAuth = new AuthService(prisma, passwords, tokens, googleVerifier, googleConfig);
    account = new AccountService(prisma, config);
  });

  afterAll(async () => {
    if (emails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    (googleVerifier.verify as jest.Mock).mockReset();
  });

  function testEmail(): string {
    const email = `auth-test-${randomUUID()}@example.com`;
    emails.push(email);
    return email;
  }

  function registerDto(email: string, overrides: Partial<RegisterDto> = {}): RegisterDto {
    return {
      email,
      password: 'Password123',
      name: 'Test Learner',
      acceptTerms: true,
      acceptPrivacy: true,
      ...overrides,
    };
  }

  async function expectApiError(
    promise: Promise<unknown>,
    code: string,
    status: number,
  ): Promise<void> {
    let caught: unknown;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiException);
    const exception = caught as ApiException;
    expect(exception.getStatus()).toBe(status);
    expect((exception.getResponse() as { code: string }).code).toBe(code);
  }

  it('registers, normalises email, logs in, and returns me', async () => {
    const email = testEmail();
    const registration = await auth.register(
      registerDto(email.toUpperCase(), { name: '  Test Learner  ' }),
      { userAgent: 'jest' },
    );

    expect(registration.user.email).toBe(email);
    expect(registration.user.name).toBe('Test Learner');
    expect(registration.user.hasPassword).toBe(true);
    expect(registration.user.authProviders).toEqual([AuthProvider.EMAIL]);
    expect(registration.tokens.tokenType).toBe('Bearer');
    expect(registration.tokens.accessToken).toBeTruthy();
    expect(registration.tokens.refreshToken).toMatch(/^rt_/);

    // The access token must expire on its own instead of relying solely on the
    // session row, which is rotated far less often.
    const accessPayload = jwt.verify<{ exp: number; iat: number }>(registration.tokens.accessToken);
    expect(accessPayload.exp - accessPayload.iat).toBe(baseConfig.JWT_ACCESS_TTL);

    const profile = await prisma.userProfile.findUnique({
      where: { userId: registration.user.id },
    });
    expect(profile).not.toBeNull();

    const login = await auth.login({ email, password: 'Password123' }, {});
    expect(login.user.id).toBe(registration.user.id);

    const me = await auth.me(registration.user.id);
    expect(me.id).toBe(registration.user.id);
    expect(me.authProviders).toEqual([AuthProvider.EMAIL]);

    await expectApiError(auth.register(registerDto(email), {}), 'EMAIL_ALREADY_REGISTERED', 409);

    const sessions = await prisma.session.count({
      where: { userId: registration.user.id, revokedAt: null },
    });
    expect(sessions).toBe(2);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const registration = await auth.register(registerDto(testEmail()), {});
    const oldRefreshToken = registration.tokens.refreshToken;

    const rotated = await auth.refresh(oldRefreshToken, {});
    expect(rotated.tokens.refreshToken).not.toBe(oldRefreshToken);

    const oldSession = await prisma.session.findUnique({
      where: { refreshTokenHash: tokens.hashRefreshToken(oldRefreshToken) },
    });
    expect(oldSession?.revokedReason).toBe(SessionRevocationReason.ROTATED);
    expect(oldSession?.replacedBySessionId).toBeTruthy();

    // Move the rotation outside the concurrency grace window so this is treated
    // as a genuine replay rather than a duplicate client refresh.
    await prisma.session.update({
      where: { id: oldSession!.id },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    await expectApiError(auth.refresh(oldRefreshToken, {}), 'INVALID_REFRESH_TOKEN', 401);

    const replacement = await prisma.session.findUnique({
      where: { refreshTokenHash: tokens.hashRefreshToken(rotated.tokens.refreshToken) },
    });
    expect(replacement?.revokedReason).toBe(SessionRevocationReason.REUSE_DETECTED);

    await expectApiError(
      auth.refresh(rotated.tokens.refreshToken, {}),
      'INVALID_REFRESH_TOKEN',
      401,
    );
  });

  it('does not revoke the family for a duplicate refresh inside the grace window', async () => {
    const registration = await auth.register(registerDto(testEmail()), {});
    const rotated = await auth.refresh(registration.tokens.refreshToken, {});

    await expectApiError(
      auth.refresh(registration.tokens.refreshToken, {}),
      'INVALID_REFRESH_TOKEN',
      401,
    );

    const replacement = await prisma.session.findUnique({
      where: { refreshTokenHash: tokens.hashRefreshToken(rotated.tokens.refreshToken) },
    });
    expect(replacement?.revokedAt).toBeNull();

    await expect(auth.refresh(rotated.tokens.refreshToken, {})).resolves.toMatchObject({
      tokens: { tokenType: 'Bearer' },
    });
  });

  it('lets only one of two concurrent refreshes rotate the session', async () => {
    const registration = await auth.register(registerDto(testEmail()), {});
    const results = await Promise.allSettled([
      auth.refresh(registration.tokens.refreshToken, {}),
      auth.refresh(registration.tokens.refreshToken, {}),
    ]);

    const succeeded = results.filter(
      (result): result is PromiseFulfilledResult<AuthResponse> => result.status === 'fulfilled',
    );
    const failed = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(ApiException);
    expect((failed[0].reason as ApiException).getStatus()).toBe(401);

    const rotated = succeeded[0].value;
    const replacement = await prisma.session.findUnique({
      where: { refreshTokenHash: tokens.hashRefreshToken(rotated.tokens.refreshToken) },
    });
    expect(replacement?.revokedAt).toBeNull();
    await expect(auth.refresh(rotated.tokens.refreshToken, {})).resolves.toMatchObject({
      tokens: { tokenType: 'Bearer' },
    });
  });

  it('logs out the current refresh token', async () => {
    const registration = await auth.register(registerDto(testEmail()), {});

    await auth.logout(registration.tokens.refreshToken);
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: tokens.hashRefreshToken(registration.tokens.refreshToken) },
    });
    expect(session?.revokedReason).toBe(SessionRevocationReason.LOGOUT);

    await expectApiError(
      auth.refresh(registration.tokens.refreshToken, {}),
      'INVALID_REFRESH_TOKEN',
      401,
    );
  });

  it('validates access tokens against the live session', async () => {
    const registration = await auth.register(registerDto(testEmail()), {});
    const guard = new JwtAuthGuard(tokens, prisma);
    const request = {
      headers: { authorization: `Bearer ${registration.tokens.accessToken}` },
    } as Request;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request as AuthenticatedRequest).user.id).toBe(registration.user.id);

    const payload = jwt.decode<{ sid: string }>(registration.tokens.accessToken);
    await prisma.session.update({
      where: { id: payload.sid },
      data: {
        revokedAt: new Date(),
        revokedReason: SessionRevocationReason.LOGOUT,
      },
    });

    await expectApiError(guard.canActivate(context), 'INVALID_ACCESS_TOKEN', 401);
  });

  it('requests, reads, and cancels account deletion', async () => {
    const registration = await auth.register(registerDto(testEmail()), {});

    const request = await account.requestDeletion(registration.user.id, 'Testing deletion');
    expect(request.status).toBe(DeletionRequestStatus.PENDING);
    expect(request.reason).toBe('Testing deletion');
    expect(request.scheduledFor.getTime()).toBeGreaterThan(Date.now());

    const activeSessions = await prisma.session.count({
      where: { userId: registration.user.id, revokedAt: null },
    });
    expect(activeSessions).toBe(0);

    const status = await account.getStatus(registration.user.id);
    expect(status?.id).toBe(request.id);

    const login = await auth.login({ email: registration.user.email, password: 'Password123' }, {});
    expect(login.user.id).toBe(registration.user.id);

    const repeated = await account.requestDeletion(registration.user.id);
    expect(repeated.id).toBe(request.id);
    expect(
      await prisma.session.count({
        where: { userId: registration.user.id, revokedAt: null },
      }),
    ).toBe(0);

    const canceled = await account.cancel(registration.user.id);
    expect(canceled.id).toBe(request.id);
    expect(canceled.status).toBe(DeletionRequestStatus.CANCELED);

    await expectApiError(account.cancel(registration.user.id), 'NO_PENDING_DELETION_REQUEST', 404);
  });

  it('creates and cancels a pending deletion request', async () => {
    const registration = await auth.register(registerDto(testEmail()), {});

    const request = await account.requestDeletion(registration.user.id);
    const canceled = await account.cancel(registration.user.id);
    expect(canceled.id).toBe(request.id);
    expect(canceled.status).toBe(DeletionRequestStatus.CANCELED);
    expect(canceled.canceledAt).toBeTruthy();

    await expectApiError(account.cancel(registration.user.id), 'NO_PENDING_DELETION_REQUEST', 404);
  });

  it('anonymises a learner once the deletion grace period elapses', async () => {
    const email = testEmail();
    const registration = await auth.register(registerDto(email), {});
    const request = await account.requestDeletion(registration.user.id, 'integration test');

    await prisma.accountDeletionRequest.update({
      where: { id: request.id },
      data: { scheduledFor: new Date(Date.now() - 1_000) },
    });

    const completed = await account.processDueDeletions();
    expect(completed).toBeGreaterThanOrEqual(1);

    const user = await prisma.user.findUnique({ where: { id: registration.user.id } });
    expect(user?.status).toBe(UserStatus.DELETED);
    expect(user?.email).not.toBe(email);
    expect(user?.passwordHash).toBeNull();
    expect(await prisma.userIdentity.count({ where: { userId: registration.user.id } })).toBe(0);

    const stored = await prisma.accountDeletionRequest.findUnique({ where: { id: request.id } });
    expect(stored?.status).toBe(DeletionRequestStatus.COMPLETED);
    expect(stored?.completedAt).toBeTruthy();

    // The original address is free again.
    const reRegistered = await auth.register(registerDto(email), {});
    expect(reRegistered.user.email).toBe(email);

    await prisma.user.delete({ where: { id: registration.user.id } });
    await prisma.user.delete({ where: { id: reRegistered.user.id } });
  });

  it('rejects Google sign-in when the feature is disabled', async () => {
    await expectApiError(
      auth.googleLogin({ idToken: 'x'.repeat(40) }, {}),
      'GOOGLE_AUTH_DISABLED',
      403,
    );
  });

  it('creates a Google-only account after consent and reuses it', async () => {
    const email = testEmail();
    (googleVerifier.verify as jest.Mock).mockResolvedValue({
      providerUserId: `google-${randomUUID()}`,
      email,
      emailVerified: true,
      name: 'Google Learner',
    });

    await expectApiError(
      googleAuth.googleLogin({ idToken: 'x'.repeat(40) }, {}),
      'TERMS_ACCEPTANCE_REQUIRED',
      422,
    );

    const first = await googleAuth.googleLogin(
      { idToken: 'x'.repeat(40), acceptTerms: true, acceptPrivacy: true },
      {},
    );
    expect(first.user.email).toBe(email);
    expect(first.user.hasPassword).toBe(false);
    expect(first.user.authProviders).toEqual([AuthProvider.GOOGLE]);
    expect(first.user.emailVerifiedAt).toBeTruthy();

    const second = await googleAuth.googleLogin({ idToken: 'x'.repeat(40) }, {});
    expect(second.user.id).toBe(first.user.id);
  });

  it('refuses to auto-link Google to an unverified email account', async () => {
    const email = testEmail();
    const registration = await auth.register(registerDto(email), {});
    (googleVerifier.verify as jest.Mock).mockResolvedValue({
      providerUserId: `google-${randomUUID()}`,
      email,
      emailVerified: true,
      name: 'Linked Learner',
    });

    await expectApiError(
      googleAuth.googleLogin({ idToken: 'x'.repeat(40) }, {}),
      'ACCOUNT_EXISTS_USE_PASSWORD',
      409,
    );

    // The pre-existing password credential must remain the only way in, so an
    // attacker who pre-registered the address cannot ride the Google sign-in.
    const login = await auth.login({ email, password: 'Password123' }, {});
    expect(login.user.id).toBe(registration.user.id);
    expect(login.user.authProviders).toEqual([AuthProvider.EMAIL]);
  });

  it('links Google to an existing email account once the email is verified', async () => {
    const email = testEmail();
    const registration = await auth.register(registerDto(email), {});
    await prisma.user.update({
      where: { id: registration.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    (googleVerifier.verify as jest.Mock).mockResolvedValue({
      providerUserId: `google-${randomUUID()}`,
      email,
      emailVerified: true,
      name: 'Linked Learner',
    });

    const linked = await googleAuth.googleLogin({ idToken: 'x'.repeat(40) }, {});
    expect(linked.user.id).toBe(registration.user.id);
    expect(linked.user.authProviders).toEqual(
      expect.arrayContaining([AuthProvider.EMAIL, AuthProvider.GOOGLE]),
    );
    expect(linked.user.hasPassword).toBe(true);
  });
});
