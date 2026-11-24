import { describe, expect, it } from 'vitest';
import { MCP_REMOTE_VERSION, toClaudeCodeCommand, toDesktopConfig } from './snippets';

const URL = 'https://api.poelens.com/mcp';
const SECRET = 'pl_' + 'a'.repeat(43);

describe('token snippets', () => {
    it('writes the exact Claude Code command', () => {
        expect(toClaudeCodeCommand(URL, SECRET)).toBe(`claude mcp add --transport http poelens ${URL} --header "Authorization: Bearer ${SECRET}"`);
    });

    it('writes a Desktop config that is valid JSON, with the secret only in the env and no spaces in the arguments', () => {
        const config = JSON.parse(toDesktopConfig(URL, SECRET)) as {
            mcpServers: { poelens: { command: string; args: string[]; env: Record<string, string> } };
        };
        const server = config.mcpServers.poelens;

        expect(server.command).toBe('npx');
        expect(server.args).toEqual(['-y', 'mcp-remote@0.16.5', URL, '--transport', 'http-only', '--header', 'Authorization:${AUTH_HEADER}']);
        expect(server.args.some((arg) => arg.includes(' '))).toBe(false);
        expect(MCP_REMOTE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        expect(server.env).toEqual({ AUTH_HEADER: 'Bearer ' + SECRET });
        expect(server.args.join(' ')).not.toContain(SECRET);
    });
});
