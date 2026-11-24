import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { decideNavigation } from './navigation.mjs';

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

void app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
