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
                args: ['-y', 'mcp-remote', url, '--transport', 'http-only', '--header', 'Authorization:${AUTH_HEADER}'],
                env: { AUTH_HEADER: 'Bearer ' + secret },
            },
        },
    };

    return JSON.stringify(config, null, 2);
}
