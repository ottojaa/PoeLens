// Sandboxed preload scripts can't be ESM: this file must stay .cts so tsc emits CommonJS (.cjs).
import { contextBridge } from 'electron';

// The renderer's only window into Electron. Add narrowly scoped IPC methods here as features need them
// (e.g. a price-check hotkey); never expose ipcRenderer itself.
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
});
