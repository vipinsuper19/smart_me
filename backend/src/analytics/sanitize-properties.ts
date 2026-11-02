const SENSITIVE_KEY_FRAGMENTS = [
  'email',
  'password',
  'token',
  'authorization',
  'phone',
  'mobile',
  'address',
  'birth',
  'aadhaar',
  'aadhar',
  'secret',
] as const;

/**
 * Short fragments that are too ambiguous for substring matching (`company`
 * contains `pan`, `expanded` contains `pan`). They only match a whole word after
 * snake_case and camelCase are split into tokens.
 */
const SENSITIVE_KEY_TOKENS = ['pan', 'dob', 'otp', 'pin', 'ssn'] as const;

const MAX_DEPTH = 3;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 500;

/** Properties larger than this are rejected rather than silently truncated. */
export const MAX_PROPERTIES_BYTES = 4096;

function keyTokens(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isSensitiveKey(key: string): boolean {
  const tokens = keyTokens(key);
  const normalized = tokens.join('');
  if (SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    return true;
  }
  return tokens.some((token) => (SENSITIVE_KEY_TOKENS as readonly string[]).includes(token));
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') {
    return value.slice(0, MAX_STRING_LENGTH);
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return undefined;
    }
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) {
      return undefined;
    }

    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        continue;
      }

      const sanitized = sanitizeValue(nested, depth + 1);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }
    return output;
  }

  return undefined;
}

/**
 * Removes obvious personal or credential fields, bounds nesting, array sizes
 * and string lengths. This is a safety net, not a licence for clients to send
 * PII: the analytics contract explicitly forbids it.
 */
export function sanitizeAnalyticsProperties(input: unknown): Record<string, unknown> | null {
  if (input === null || input === undefined || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const sanitized = sanitizeValue(input, 0);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : null;
}
