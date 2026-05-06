'use client';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { fetchMeOrNull } from '@/lib/queries';
import type { AuthUser } from '@/lib/types';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, isLoading: true });

const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  // The /auth/me endpoint is the single source of truth — never trust a
  // local cache for the session. React Query handles the request
  // dedupe + revalidation; the Provider is a thin wrapper so consumers
  // can read user/isLoading from context instead of useQuery.
  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMeOrNull,
    // Revalidate on focus so signing in/out in another tab eventually
    // syncs without a hard reload.
    refetchOnWindowFocus: 'always',
    staleTime: 60_000,
  });

  return (
    <AuthContext.Provider value={{ user: data ?? null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => useContext(AuthContext);

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  // QueryClient must be created lazily inside a component so the cache is
  // per-tree, not shared across server requests in dev.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Avoid a refetch storm on every navigation; book lists don't
            // change minute-to-minute.
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
