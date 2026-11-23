import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Kysely } from 'kysely';
import type { Database, UserRole } from '../db/schema.js';
import type { buildTestApp } from './build-app.js';

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

export const TEST_PASSWORD = 'correct horse battery';

export interface SignedIn {
    userId: string;
    accessToken: string;
    refreshToken: string;
}

/** A client address nobody else in the suite uses, so the per-address login limit never trips by accident. */
export function freshIp(): string {
    return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

/** Inserts a user directly (bcrypt at the cheapest cost), for tests that are not about registering. */
export async function seedUser(db: Kysely<Database>, input: { email: string; role?: UserRole; password?: string; isActive?: boolean }): Promise<string> {
    const row = await db
        .insertInto('users')
        .values({
            email: input.email,
            display_name: input.email.split('@')[0] ?? 'user',
            password_hash: await bcrypt.hash(input.password ?? TEST_PASSWORD, 4),
            role: input.role ?? 'member',
            is_active: input.isActive ?? true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

    return row.id;
}

export function readRefreshCookie(res: { cookies: { name: string; value: string }[] }): string | undefined {
    return res.cookies.find((cookie) => cookie.name === 'refresh_token')?.value;
}

export async function signIn(server: TestApp, email: string, password = TEST_PASSWORD): Promise<SignedIn> {
    const res = await server.inject({ method: 'POST', url: '/auth/login', headers: { 'x-forwarded-for': freshIp() }, payload: { email, password } });

    if (res.statusCode !== 200) throw new Error('Sign-in failed in a test: ' + res.body);

    const body = res.json<{ user: { id: string }; accessToken: string }>();

    return { userId: body.user.id, accessToken: body.accessToken, refreshToken: readRefreshCookie(res) ?? '' };
}

export function bearer(accessToken: string): Record<string, string> {
    return { authorization: 'Bearer ' + accessToken };
}
