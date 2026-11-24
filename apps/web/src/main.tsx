import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthProvider } from './lib/auth';
import { queryClient } from './lib/query-client';
import { ThemeProvider } from './lib/theme';
import { MotionProvider } from './motion/MotionProvider';
import { router } from './router';
import './theme/fonts';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ThemeProvider>
                    <MotionProvider>
                        <RouterProvider router={router} />
                    </MotionProvider>
                </ThemeProvider>
            </AuthProvider>
        </QueryClientProvider>
    </StrictMode>,
);
