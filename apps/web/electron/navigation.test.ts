import { describe, expect, it } from 'vitest';
import { decideNavigation } from './navigation.mjs';

const PROD = 'https://poelens.com';
const DEV = 'http://localhost:4300';

describe('decideNavigation', () => {
    it.each([
        [PROD, `${PROD}/`],
        [PROD, `${PROD}/economy?league=Standard#chart`],
        [DEV, `${DEV}/watchlist`],
    ])('keeps %s pages in the window: %s', (appUrl, url) => {
        expect(decideNavigation(url, appUrl)).toBe('allow');
    });

    it.each([
        ['another site', 'https://poe.ninja/poe2/economy', PROD],
        ['another port on the dev host', 'http://localhost:3100/docs', DEV],
        ['the same host over http', 'http://poelens.com/', PROD],
        ['a subdomain', 'https://www.poelens.com/', PROD],
        ['a look-alike host that starts with the app host', 'https://poelens.com.evil.test/', PROD],
        ['a userinfo trick', 'https://poelens.com@evil.test/', PROD],
    ])('opens %s in the default browser', (_name, url, appUrl) => {
        expect(decideNavigation(url, appUrl)).toBe('external');
    });

    it.each([
        ['a local file', 'file:///etc/passwd'],
        ['a javascript: URL', 'javascript:alert(1)'],
        ['a mail link', 'mailto:someone@example.com'],
        ['a custom scheme', 'ms-msdt:/id'],
        ['an unparseable string', 'not a url'],
        ['an empty string', ''],
    ])('does nothing for %s', (_name, url) => {
        expect(decideNavigation(url, PROD)).toBe('block');
    });
});
