import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startUpdates, type UpdateHost, type UpdatePrompt } from './updates.mjs';

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** Stands in for electron-updater: the real one reports what it found through these events. */
class FakeUpdater extends EventEmitter {
    autoDownload = true;
    autoInstallOnAppQuit = true;
    quitAndInstall = vi.fn();
    checkForUpdates = vi.fn(async () => ({ updateInfo: { version: '1.1.0' }, downloadPromise: null as Promise<unknown> | null }));
}

function setUp(overrides: Partial<UpdateHost> = {}) {
    const updater = new FakeUpdater();
    const asked: UpdatePrompt[] = [];
    const lines: string[] = [];
    const host = {
        isPackaged: true,
        platform: 'darwin' as NodeJS.Platform,
        updater,
        ask: vi.fn(async (prompt: UpdatePrompt) => {
            asked.push(prompt);

            return true;
        }),
        openExternal: vi.fn(async () => {}),
        log: (line: string) => void lines.push(line),
        ...overrides,
    };

    return { host, updater, asked, lines };
}

/** Lets the promises an event or a check started finish. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe('startUpdates', () => {
    it.each([
        ['an unpackaged (dev) app', { isPackaged: false }],
        ['a platform without releases', { platform: 'linux' as NodeJS.Platform }],
    ])('never checks in %s', async (_name, overrides) => {
        const { host, updater } = setUp(overrides);

        startUpdates(host);
        await vi.advanceTimersByTimeAsync(SIX_HOURS * 2);

        expect(updater.checkForUpdates).not.toHaveBeenCalled();
        expect(updater.eventNames()).toEqual([]);
    });

    it('checks on launch and every six hours', async () => {
        const { host, updater, lines } = setUp();

        startUpdates(host);
        await settle();
        expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
        expect(lines).toEqual(['[updates] checked: latest release is 1.1.0']);

        await vi.advanceTimersByTimeAsync(SIX_HOURS * 2);
        expect(updater.checkForUpdates).toHaveBeenCalledTimes(3);
    });
});

describe('on macOS', () => {
    it('never downloads or installs by itself', () => {
        const { host, updater } = setUp();

        startUpdates(host);

        expect(updater.autoDownload).toBe(false);
        expect(updater.autoInstallOnAppQuit).toBe(false);
    });

    it('offers the release page of an available version', async () => {
        const { host, updater, asked } = setUp();

        startUpdates(host);
        updater.emit('update-available', { version: '1.1.0' });
        await settle();

        expect(asked).toEqual([expect.objectContaining({ message: 'PoeLens 1.1.0 is available', confirm: 'Download' })]);
        expect(host.openExternal).toHaveBeenCalledWith('https://github.com/ottojaa/PoeLens/releases/tag/desktop-v1.1.0');
        expect(updater.quitAndInstall).not.toHaveBeenCalled();
    });

    it('opens nothing when the user picks Later', async () => {
        const { host, updater } = setUp({ ask: async () => false });

        startUpdates(host);
        updater.emit('update-available', { version: '1.1.0' });
        await settle();

        expect(host.openExternal).not.toHaveBeenCalled();
    });

    it('asks once per version, and again for a newer one', async () => {
        const { host, updater, asked } = setUp({ openExternal: vi.fn(async () => {}) });

        startUpdates(host);

        for (const version of ['1.1.0', '1.1.0', '1.2.0']) {
            updater.emit('update-available', { version });
            await settle();
        }

        expect(asked.map((prompt) => prompt.message)).toEqual(['PoeLens 1.1.0 is available', 'PoeLens 1.2.0 is available']);
    });
});

describe('on Windows', () => {
    it('downloads in the background and installs on quit', () => {
        const { host, updater } = setUp({ platform: 'win32' });

        startUpdates(host);

        expect(updater.autoDownload).toBe(true);
        expect(updater.autoInstallOnAppQuit).toBe(true);
    });

    it('asks only once the download is done, then restarts', async () => {
        const { host, updater, asked } = setUp({ platform: 'win32' });

        startUpdates(host);
        updater.emit('update-available', { version: '1.1.0' });
        await settle();
        expect(asked).toEqual([]);

        updater.emit('update-downloaded', { version: '1.1.0' });
        await settle();

        expect(asked).toEqual([expect.objectContaining({ message: 'PoeLens 1.1.0 is ready', confirm: 'Restart now' })]);
        expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
    });

    it('leaves the install to the next quit when the user picks Later, and does not ask again', async () => {
        const ask = vi.fn(async () => false);
        const { host, updater } = setUp({ platform: 'win32', ask });

        startUpdates(host);
        updater.emit('update-downloaded', { version: '1.1.0' });
        await settle();
        updater.emit('update-downloaded', { version: '1.1.0' });
        await settle();

        expect(ask).toHaveBeenCalledTimes(1);
        expect(updater.quitAndInstall).not.toHaveBeenCalled();
    });
});

describe('failures', () => {
    it('logs a failed check, such as a repository with no releases, and checks again later', async () => {
        const { host, updater, asked, lines } = setUp();
        updater.checkForUpdates.mockRejectedValue(new Error('No published versions on GitHub\n    at stack'));

        startUpdates(host);
        await vi.advanceTimersByTimeAsync(SIX_HOURS);

        expect(lines).toEqual(Array(2).fill('[updates] failed: No published versions on GitHub'));
        expect(asked).toEqual([]);
    });

    it('logs a failed download', async () => {
        const { host, updater, lines } = setUp({ platform: 'win32' });
        updater.checkForUpdates.mockImplementation(async () => ({
            updateInfo: { version: '1.1.0' },
            downloadPromise: Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED')),
        }));

        startUpdates(host);
        await settle();

        expect(lines).toContain('[updates] failed: net::ERR_INTERNET_DISCONNECTED');
    });

    it('logs a dialog or browser that cannot be opened', async () => {
        const { host, updater, lines } = setUp({ openExternal: async () => Promise.reject(new Error('no browser')) });

        startUpdates(host);
        updater.emit('update-available', { version: '1.1.0' });
        await settle();

        expect(lines).toContain('[updates] could not offer the update: no browser');
    });
});
