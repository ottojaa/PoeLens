import { AppError } from '@poelens/shared';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** An error whose message is written for the model: it reaches it as is. */
export class ToolError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ToolError';
    }
}

const GENERIC_MESSAGE = 'Something went wrong on the PoeLens server: try again later';

/** A text answer. */
export function textResult(text: string): CallToolResult {
    return { content: [{ type: 'text', text }] };
}

/** An answer that says the call failed, so the model can tell and try something else. */
export function errorResult(message: string): CallToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Runs a tool's work and turns whatever it throws into an answer. Only the messages of `ToolError` and `AppError` reach
 * the model (they are written to be read); anything else (a database error, a bug) is logged and becomes generic text,
 * so the model never sees a stack trace, a query or a connection string.
 */
export async function runTool(work: () => Promise<CallToolResult>, log: (error: unknown) => void): Promise<CallToolResult> {
    try {
        return await work();
    } catch (error) {
        if (error instanceof ToolError || error instanceof AppError) return errorResult(error.message);

        log(error);

        return errorResult(GENERIC_MESSAGE);
    }
}
