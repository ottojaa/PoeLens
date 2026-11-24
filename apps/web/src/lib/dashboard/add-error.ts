import { ApiError } from '@/lib/api/client';

/** What to say when a block could not be added: the server's reason when it refused the request, else that trying again may work. */
export function toAddError(error: unknown, dashboardName: string): string {
    const start = 'Could not add it to ' + dashboardName;
    const isRefusal = error instanceof ApiError && error.status >= 400 && error.status < 500;

    if (isRefusal && error.serverMessage) return start + ': ' + error.serverMessage;

    return start + '. Try again.';
}
