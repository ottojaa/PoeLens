/**
 * Who a request acts as once its credential has been checked. The MCP tools read `userId` and nothing else, so a second
 * way to sign in (OAuth, later) only has to produce one of these.
 */
export interface Principal {
    userId: string;
    /** How the caller proved it. */
    via: 'api-token';
    /** The credential that was used (the API token's id): what a per-credential rate limit keys on. */
    credentialId: string;
}
