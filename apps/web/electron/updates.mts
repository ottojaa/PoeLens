// Finds new desktop releases and offers them to the user. It imports nothing from Electron: main.mts hands it the
// updater and the dialogs, so the decisions here can be tested without starting the app.

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RELEASE_PAGE_PREFIX = 'https://github.com/ottojaa/PoeLens/releases/tag/desktop-v';

/** The part of electron-updater's `autoUpdater` used here. */
export interface Updater {
    autoDownload: boolean;
    autoInstallOnAppQuit: boolean;
    on(event: 'update-available' | 'update-downloaded', listener: (info: { version: string }) => void): unknown;
    checkForUpdates(): Promise<{ updateInfo: { version: string }; downloadPromise?: Promise<unknown> | null } | null>;
    quitAndInstall(): void;
}

/** A question with two answers: `confirm`, or "Later". */
export interface UpdatePrompt {
    message: string;
    detail: string;
    confirm: string;
}

export interface UpdateHost {
    isPackaged: boolean;
    platform: NodeJS.Platform;
    updater: Updater;
    /** Resolves to true when the user picks the confirm button. */
    ask(prompt: UpdatePrompt): Promise<boolean>;
    openExternal(url: string): Promise<void>;
    log(line: string): void;
}

interface Strategy {
    /** Whether the app downloads and installs the update itself. */
    installs: boolean;
    offerOn: 'update-available' | 'update-downloaded';
    prompt(version: string): UpdatePrompt;
    accept(host: UpdateHost, version: string): Promise<void> | void;
}

// A platform that is not listed never checks: no releases are published for it.
const STRATEGIES: Partial<Record<NodeJS.Platform, Strategy>> = {
    // macOS only installs an update into an app signed with a developer certificate. This one is not, so it can only
    // point at the download. Once it is signed, macOS can use the same strategy as Windows.
    darwin: {
        installs: false,
        offerOn: 'update-available',
        prompt: (version) => ({
            message: `PoeLens ${version} is available`,
            detail: 'Download it from the release page and replace the app in your Applications folder.',
            confirm: 'Download',
        }),
        accept: (host, version) => host.openExternal(RELEASE_PAGE_PREFIX + version),
    },
    win32: {
        installs: true,
        offerOn: 'update-downloaded',
        prompt: (version) => ({
            message: `PoeLens ${version} is ready`,
            detail: 'Restart now to update, or it installs when you quit.',
            confirm: 'Restart now',
        }),
        accept: (host) => host.updater.quitAndInstall(),
    },
};

/** Checks for a new release now and every six hours, in a packaged app only. */
export function startUpdates(host: UpdateHost): void {
    const strategy = STRATEGIES[host.platform];

    if (!host.isPackaged || !strategy) return;

    host.updater.autoDownload = strategy.installs;
    host.updater.autoInstallOnAppQuit = strategy.installs;
    offerNewVersions(host, strategy);

    void checkForUpdate(host);
    setInterval(() => void checkForUpdate(host), CHECK_INTERVAL_MS);
}

/** Asks once per version: every later check reports the same release again. */
function offerNewVersions(host: UpdateHost, strategy: Strategy): void {
    let offeredVersion: string | null = null;

    async function offer(version: string): Promise<void> {
        if (version === offeredVersion) return;

        offeredVersion = version;

        try {
            if (await host.ask(strategy.prompt(version))) await strategy.accept(host, version);
        } catch (error) {
            host.log('[updates] could not offer the update: ' + toFirstLine(error));
        }
    }

    host.updater.on(strategy.offerOn, ({ version }) => void offer(version));
}

// Being offline or rate limited is normal, so a failure is only logged, never shown. CI looks for these two lines to
// know that the packaged app ran its check (scripts/smoke-desktop.sh).
async function checkForUpdate({ updater, log }: UpdateHost): Promise<void> {
    try {
        const result = await updater.checkForUpdates();
        log('[updates] checked: latest release is ' + (result?.updateInfo.version ?? 'unknown'));
        // A background download fails through this promise: left alone, that is an unhandled rejection.
        await result?.downloadPromise;
    } catch (error) {
        log('[updates] failed: ' + toFirstLine(error));
    }
}

function toFirstLine(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    return message.split('\n')[0] ?? '';
}
