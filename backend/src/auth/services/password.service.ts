import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/**
 * OWASP-recommended Argon2id parameters (19 MiB, t=2, p=1).
 * The hash string embeds these parameters, so existing hashes remain verifiable
 * if the defaults are raised later.
 */
export const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

const REHASH_OPTIONS = {
  memoryCost: PASSWORD_HASH_OPTIONS.memoryCost,
  timeCost: PASSWORD_HASH_OPTIONS.timeCost,
  parallelism: PASSWORD_HASH_OPTIONS.parallelism,
};

/** Argon2id hash of a random throwaway value, used to equalise failed-login timing. */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$ET9lD1AsC0JLTpM/7yY37w$zxXWJSQObUeHEpJ9tLzoD76g3qgWNAw9xakvvRY60bg';

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password, PASSWORD_HASH_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async verifyDummy(password: string): Promise<void> {
    await this.verify(DUMMY_PASSWORD_HASH, password);
  }

  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, REHASH_OPTIONS);
    } catch {
      return false;
    }
  }
}
