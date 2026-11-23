/**
 * Fastify server options shared by `main.ts` and the test app builder, so the tests exercise the proxy setting
 * production runs with.
 *
 * `trustProxy: 1` trusts exactly one hop, the host's nginx. `request.ip` (which the rate limits key on) is then the
 * rightmost X-Forwarded-For entry, the one nginx appended, and entries a client put in front of it are ignored. With
 * `true`, or with the setting off, a client could pick its own bucket by sending a header, or share nginx's address.
 */
export const SERVER_OPTIONS = { trustProxy: 1 } as const;
