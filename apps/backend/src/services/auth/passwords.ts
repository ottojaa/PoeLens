import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';

// Tests use the cheapest cost so a suite that signs in dozens of users stays fast; the dummy hash below is made with
// the same cost, so its timing always matches a real account's.
const BCRYPT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;

// A hash nobody has the password for, made once at start-up. Comparing against it when an account does not exist (or
// is inactive) costs the same as a real comparison, so the response time does not tell whether an email is registered.
const dummyHash: Promise<string> = bcrypt.hash('no-account-has-this-password', BCRYPT_ROUNDS);

dummyHash.catch(() => undefined);

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Checks a password against the account's hash, or against the dummy hash (always false) when there is no usable account. */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
    if (hash) return bcrypt.compare(password, hash);

    await bcrypt.compare(password, await dummyHash);

    return false;
}
