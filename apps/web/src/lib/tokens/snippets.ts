/**
 * The `mcp-remote` release the Desktop snippet runs. It is pinned on purpose: the package is started on the user's
 * machine with their token in its environment, so a new release must not run there unreviewed. Move it to a release
 * that is at least 14 days old (the age the repo's package gate uses).
 */
export const MCP_REMOTE_VERSION = '0.16.5';

/** The command that adds PoeLens to Claude Code. */
export function toClaudeCodeCommand(url: string, secret: string): string {
    return `claude mcp add --transport http poelens ${url} --header "Authorization: Bearer ${secret}"`;
}

/**
 * The `claude_desktop_config.json` entry for Claude Desktop, which takes only local servers: `mcp-remote` bridges to
 * ours. The header goes in through an environment variable with no space around the colon, because Desktop on Windows
 * mangles spaces in arguments.
 */
export function toDesktopConfig(url: string, secret: string): string {
    const config = {
        mcpServers: {
            poelens: {
                command: 'npx',
                args: ['-y', `mcp-remote@${MCP_REMOTE_VERSION}`, url, '--transport', 'http-only', '--header', 'Authorization:${AUTH_HEADER}'],
                env: { AUTH_HEADER: 'Bearer ' + secret },
            },
        },
    };

    return JSON.stringify(config, null, 2);
}
