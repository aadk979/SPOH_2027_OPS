import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { applyTheme, loadTheme } from './lib/theme';
import './styles/theme.css';

applyTheme(loadTheme());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Live screens poll every 10 s (architecture D2); refetch when the tab regains focus.
      refetchOnWindowFocus: true,
      retry: 2,
      staleTime: 5_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
