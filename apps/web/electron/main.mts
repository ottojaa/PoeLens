import { app, BrowserWindow, dialog, shell, type MessageBoxOptions } from 'electron';
// The default import, then its property: a named import of this CommonJS package fails at startup from inside app.asar.
import electronUpdater from 'electron-updater';
import * as path from 'path';
import { decideNavigation } from './navigation.mjs';
import { startUpdates, type UpdatePrompt } from './updates.mjs';

// The desktop app is a window onto the hosted web app, so a web release reaches desktop users without a new install.
const APP_URL = app.isPackaged ? 'https://poelens.com' : 'http://localhost:4300';

// Matches --background in the dark variant of src/theme/reverie.css, so a slow first frame doesn't flash white. This is
// a hex literal outside src/ on purpose: the Electron main process cannot read the web app's CSS, and the colour check
// (src/theme/theme.test.ts) only scans src/. Change it together with the theme's dark --background.
const WINDOW_BACKGROUND = '#121212';

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(import.meta.dirname, 'preload.cjs'),
        },
        backgroundColor: WINDOW_BACKGROUND,
    });
    const { webContents } = mainWindow;

    // Everything that could take the window somewhere else goes through the same decision.
    const guard = (event: { preventDefault: () => void }, url: string): void => {
        const decision = decideNavigation(url, APP_URL);

        if (decision === 'allow') return;

        event.preventDefault();

        if (decision === 'external') void shell.openExternal(url);
    };

    webContents.on('will-navigate', (event, url) => guard(event, url));
    webContents.on('will-redirect', (event, url) => guard(event, url));
    webContents.setWindowOpenHandler(({ url }) => {
        const decision = decideNavigation(url, APP_URL);

        if (decision === 'external') void shell.openExternal(url);

        // Same-origin popups load in this window instead of opening a second, unguarded one.
        if (decision === 'allow') void mainWindow.loadURL(url);

        return { action: 'deny' };
    });

    void mainWindow.loadURL(APP_URL);

    if (!app.isPackaged) webContents.openDevTools();
}

async function askAboutUpdate({ message, detail, confirm }: UpdatePrompt): Promise<boolean> {
    const options: MessageBoxOptions = { type: 'info', message, detail, buttons: [confirm, 'Later'], defaultId: 0, cancelId: 1 };
    // macOS keeps the app running with no window, so there may be nothing to attach the dialog to.
    const [window] = BrowserWindow.getAllWindows();
    const { response } = await (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options));

    return response === 0;
}

void app.whenReady().then(() => {
    createWindow();
    startUpdates({
        isPackaged: app.isPackaged,
        platform: process.platform,
        updater: electronUpdater.autoUpdater,
        ask: askAboutUpdate,
        openExternal: (url) => shell.openExternal(url),
        log: (line) => console.log(line),
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
