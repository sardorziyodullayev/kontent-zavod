import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootTelegram } from './lib/telegram';
import { router } from './router';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { mutations: { onError: (e) => alert(e instanceof Error ? e.message : 'Xato') } } });

// Telegram Mini App ichida avval initData orqali kiriladi (oddiy brauzerda darhol chiziladi).
void bootTelegram().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  ),
);
