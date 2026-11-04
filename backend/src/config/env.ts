import { z } from 'zod';
import { parseDurationToSeconds } from '../common/utils/duration';

const durationSeconds = z
  .string()
  .trim()
  .regex(/^\d+\s*[smhdw]?$/i, 'Use a duration such as 15m, 30d or 3600')
  .transform((value) => parseDurationToSeconds(value));

const durationWithDefault = (defaultValue: string) =>
  z.preprocess(
    (value) => (value === undefined || value === '' ? defaultValue : value),
    durationSeconds,
  );

/** Service-account credentials must parse to a JSON object, not a scalar. */
function isJsonObject(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * Environment contract for the API.
 *
 * Zod validates at boot so misconfiguration fails fast and loudly instead of
 * surfacing later as a confusing runtime error.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    /** Set false only when another layer already logs every request. */
    LOG_HTTP_REQUESTS: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    /** Successful requests at or above this duration are logged as warnings. */
    LOG_SLOW_REQUEST_MS: z.coerce.number().int().min(50).max(60_000).default(1_000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    /** Default time zone used for daily boundaries, streaks and challenge dates. */
    APP_TIME_ZONE: z.string().default('Asia/Kolkata'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: durationWithDefault('15m'),
    JWT_REFRESH_TTL: durationWithDefault('30d'),
    JWT_ISSUER: z.string().default('smartme-api'),
    JWT_AUDIENCE: z.string().default('smartme-api'),

    /** Google Sign-In is enabled only after a Google Cloud OAuth client exists. */
    AUTH_GOOGLE_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    GOOGLE_CLIENT_ID: z.string().trim().optional(),

    /** Version shown in the Android/web consent copy. */
    TERMS_VERSION: z.string().default('2026-10-21'),

    /** Grace period before a requested account deletion is processed. */
    ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    /** Interval-based processor; disable when an external job owns deletion. */
    ACCOUNT_DELETION_SCHEDULER_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    ACCOUNT_DELETION_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(86_400).default(3_600),

    BILLING_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    /** `mock` is a deterministic development adapter; production must use Google Play. */
    BILLING_PROVIDER: z.enum(['google_play', 'mock']).default('mock'),

    /** Extra access granted after a paid period ends, e.g. store retry windows. */
    BILLING_GRACE_PERIOD_DAYS: z.coerce.number().int().min(0).max(30).default(3),

    GOOGLE_PLAY_PACKAGE_NAME: z.string().trim().optional(),
    /** Google service-account JSON (stringified) with Android Publisher access. */
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: z.string().trim().optional(),
    /** Shared secret configured on the Pub/Sub push subscription. */
    GOOGLE_PLAY_RTDN_SECRET: z.string().trim().optional(),

    /** Gates scheduled reminder delivery; preferences and device routes always work. */
    NOTIFICATIONS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    /** `mock` logs instead of calling FCM; production must use `fcm`. */
    NOTIFICATIONS_PROVIDER: z.enum(['fcm', 'mock']).default('mock'),
    NOTIFICATIONS_SCHEDULER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    /** Scheduler tick. Five seconds is the floor so tests can run quickly. */
    NOTIFICATIONS_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(86_400).default(300),
    /** Across all reminder types, per learner, per local day. */
    NOTIFICATIONS_MAX_PER_DAY: z.coerce.number().int().min(1).max(10).default(2),

    FCM_PROJECT_ID: z.string().trim().optional(),
    /** Firebase service-account JSON (stringified) with FCM send permission. */
    FCM_SERVICE_ACCOUNT_JSON: z.string().trim().optional(),
  })
  .superRefine((env, context) => {
    if (env.AUTH_GOOGLE_ENABLED && !env.GOOGLE_CLIENT_ID) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_CLIENT_ID'],
        message: 'GOOGLE_CLIENT_ID is required when AUTH_GOOGLE_ENABLED=true',
      });
    }

    if (env.BILLING_ENABLED) {
      if (env.NODE_ENV === 'production' && env.BILLING_PROVIDER === 'mock') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BILLING_PROVIDER'],
          message: 'BILLING_PROVIDER=mock is not allowed in production',
        });
      }

      if (!env.GOOGLE_PLAY_RTDN_SECRET || env.GOOGLE_PLAY_RTDN_SECRET.length < 16) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_PLAY_RTDN_SECRET'],
          message:
            'GOOGLE_PLAY_RTDN_SECRET (>= 16 characters) is required when BILLING_ENABLED=true',
        });
      }

      if (env.BILLING_PROVIDER === 'google_play') {
        if (!env.GOOGLE_PLAY_PACKAGE_NAME) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['GOOGLE_PLAY_PACKAGE_NAME'],
            message: 'GOOGLE_PLAY_PACKAGE_NAME is required for the Google Play verifier',
          });
        }
        if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'],
            message: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is required for the Google Play verifier',
          });
        } else if (!isJsonObject(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'],
            message: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must be valid JSON',
          });
        }
      }
    }

    if (env.NOTIFICATIONS_SCHEDULER_ENABLED && !env.NOTIFICATIONS_ENABLED) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NOTIFICATIONS_SCHEDULER_ENABLED'],
        message: 'NOTIFICATIONS_SCHEDULER_ENABLED requires NOTIFICATIONS_ENABLED=true',
      });
    }

    if (!env.NOTIFICATIONS_ENABLED) {
      return;
    }

    if (env.NODE_ENV === 'production' && env.NOTIFICATIONS_PROVIDER === 'mock') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NOTIFICATIONS_PROVIDER'],
        message: 'NOTIFICATIONS_PROVIDER=mock is not allowed in production',
      });
    }

    if (env.NOTIFICATIONS_PROVIDER === 'fcm') {
      if (!env.FCM_PROJECT_ID) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FCM_PROJECT_ID'],
          message: 'FCM_PROJECT_ID is required for the FCM notification sender',
        });
      }
      if (!env.FCM_SERVICE_ACCOUNT_JSON) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FCM_SERVICE_ACCOUNT_JSON'],
          message: 'FCM_SERVICE_ACCOUNT_JSON is required for the FCM notification sender',
        });
      } else if (!isJsonObject(env.FCM_SERVICE_ACCOUNT_JSON)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FCM_SERVICE_ACCOUNT_JSON'],
          message: 'FCM_SERVICE_ACCOUNT_JSON must be valid JSON',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
