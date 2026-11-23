import { AppError } from '@poelens/shared';

/** One answer for a link that was never valid, was used, was revoked or ran out: the caller cannot tell which. */
export function invalidLinkError(kind: 'invite' | 'reset'): AppError {
    return new AppError(410, kind === 'invite' ? 'INVITE_INVALID' : 'RESET_INVALID', 'This link is invalid, already used or expired');
}
