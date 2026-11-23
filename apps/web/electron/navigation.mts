/** What the desktop window does with a URL it is asked to show. */
export type NavigationDecision =
    /** Same origin as the hosted app: show it in the window. */
    | 'allow'
    /** Some other website: hand it to the user's default browser. */
    | 'external'
    /** Anything else (file:, javascript:, custom schemes, garbage): do nothing. */
    | 'block';

/**
 * The window is a shell around the hosted web app, so it may only ever show that app's origin. Compares parsed origins
 * (scheme + host + port), never string prefixes: `https://poelens.com.evil.test` and `https://poelens.com@evil.test`
 * both start with the app's URL and neither is the app.
 */
export function decideNavigation(url: string, appUrl: string): NavigationDecision {
    const target = parseUrl(url);

    if (!target) return 'block';

    if (target.origin === new URL(appUrl).origin) return 'allow';

    return target.protocol === 'http:' || target.protocol === 'https:' ? 'external' : 'block';
}

function parseUrl(url: string): URL | null {
    try {
        return new URL(url);
    } catch {
        return null;
    }
}
