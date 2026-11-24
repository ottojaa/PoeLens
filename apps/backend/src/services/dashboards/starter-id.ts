import { createHash } from 'node:crypto';
import type { Game } from '@poelens/shared';

/** The namespace of every starter id; changing it would orphan stored starters. */
const NAMESPACE = '6b1c7a52-3f0e-4c84-9d3a-1e5f2b7a9c40';

/**
 * The fixed id of a user's starter dashboard in a game (a version 5 UUID of `userId:game`; Node's crypto has no
 * helper for it). The starter exists in memory until the user first saves, and every tab that shows it needs to save
 * to the same row, so the id cannot be random.
 */
export function toStarterId(userId: string, game: Game): string {
    const digest = createHash('sha1')
        .update(Buffer.from(NAMESPACE.replaceAll('-', ''), 'hex'))
        .update(`${userId}:${game}`)
        .digest();
    const bytes = Buffer.from(digest.subarray(0, 16));

    bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6);
    bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);

    const hex = bytes.toString('hex');

    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
