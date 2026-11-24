import { ApiError } from '@/lib/api/client';

/**
 * What to say when a block could not be added: why, when the server refused it for a reason that trying again will not
 * change, else that trying again may work. A "not found" message names an id, so it is put in words here.
 */
export function toAddError(error: unknown, dashboardName: string): string {
    const start = 'Could not add it to ' + dashboardName;
    const tryAgain = start + '. Try again.';

    if (!(error instanceof ApiError)) return tryAgain;

    if (error.status === 404) return start + ': the dashboard or panel is no longer there.';

    if (error.code === 'VALIDATION_ERROR' && error.serverMessage) return start + ': ' + error.serverMessage;

    return tryAgain;
}
