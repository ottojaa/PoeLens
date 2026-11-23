import { describe, expect, it } from 'vitest';
import { CreateInviteRequestSchema, LoginRequestSchema, NewPasswordSchema, RefreshRequestSchema, RegisterRequestSchema } from './auth.js';

describe('NewPasswordSchema', () => {
    it('needs 12 characters and no composition rules', () => {
        expect(NewPasswordSchema.safeParse('a'.repeat(11)).success).toBe(false);
        expect(NewPasswordSchema.safeParse('a'.repeat(12)).success).toBe(true);
        expect(NewPasswordSchema.safeParse('correct horse battery staple').success).toBe(true);
    });

    it('refuses what bcrypt would silently truncate', () => {
        expect(NewPasswordSchema.safeParse('a'.repeat(72)).success).toBe(true);
        expect(NewPasswordSchema.safeParse('a'.repeat(73)).success).toBe(false);
        // 40 characters, 80 bytes.
        expect(NewPasswordSchema.safeParse('é'.repeat(40)).success).toBe(false);
    });
});

describe('request schemas', () => {
    it('trim and lower-case the email so one address is one account', () => {
        expect(LoginRequestSchema.parse({ email: '  Otto@Example.COM ', password: 'x' }).email).toBe('otto@example.com');
        expect(RegisterRequestSchema.parse({ token: 't', email: 'A@B.CO', displayName: ' Ann ', password: 'a'.repeat(12) })).toMatchObject({
            email: 'a@b.co',
            displayName: 'Ann',
        });
    });

    it('rejects an address that is not one, and a blank name', () => {
        expect(LoginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
        expect(RegisterRequestSchema.safeParse({ token: 't', email: 'a@b.co', displayName: '  ', password: 'a'.repeat(12) }).success).toBe(false);
    });

    it('default an invite to a member and accept an empty refresh body', () => {
        expect(CreateInviteRequestSchema.parse({})).toEqual({ role: 'member' });
        expect(RefreshRequestSchema.safeParse(undefined).success).toBe(true);
        expect(RefreshRequestSchema.safeParse(null).success).toBe(true);
        expect(RefreshRequestSchema.safeParse({ refreshToken: 'abc' }).success).toBe(true);
    });
});
