/// <reference types='vitest' />
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const ENV_DIR = path.resolve(import.meta.dirname, '../..');

export default defineConfig(({ command, mode }) => {
    // A production bundle has no sensible default for where the API lives (it may be another origin than the page), and
    // a forgotten value would ship a bundle whose home page reports the API as down. Set it to '' for same-origin.
    if (command === 'build' && mode === 'production' && loadEnv(mode, ENV_DIR, 'VITE_')['VITE_API_URL'] === undefined) {
        throw new Error('VITE_API_URL is not set: a production build needs the API base URL (an empty value means same-origin)');
    }

    return {
        resolve: {
            alias: {
                '@': path.resolve(import.meta.dirname, './src'),
            },
        },
        root: import.meta.dirname,
        // Read VITE_* variables from the repo-root .env shared with the backend. Vite only exposes VITE_-prefixed ones.
        envDir: ENV_DIR,
        cacheDir: '../../node_modules/.vite/apps/web',
        server: {
            port: 4300,
            host: 'localhost',
        },
        preview: {
            port: 4300,
            host: 'localhost',
        },
        plugins: [tailwindcss(), TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react()],
        build: {
            outDir: './dist',
            emptyOutDir: true,
            reportCompressedSize: true,
        },
        test: {
            include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
            environment: 'node',
        },
    };
});
