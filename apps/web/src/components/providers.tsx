'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { getQueryClient } from '../lib/query-client';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState<QueryClient>(() => getQueryClient());

  return (
    <ThemeProvider attribute="class" enableSystem defaultTheme="system">
      <QueryClientProvider client={client}>
        {children}
        <ReactQueryDevtoolsPanel />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function ReactQueryDevtoolsPanel() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return <ReactQueryDevtools initialIsOpen={false} />;
}
