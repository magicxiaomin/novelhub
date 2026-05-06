'use client';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { AuthModal } from '@/components/auth/auth-modal';
import { fetchMeOrNull } from '@/lib/queries';
import type { AuthUser } from '@/lib/types';

export type AuthModalMode = 'signin' | 'signup';
export type AuthModalOptions = {
  mode?: AuthModalMode;
  afterSuccess?: () => void;
  reason?: string;
  forgotPassword?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  openAuthModal: (opts?: AuthModalOptions) => void;
  closeAuthModal: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  refetch: async () => undefined,
  openAuthModal: () => undefined,
  closeAuthModal: () => undefined,
});

const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<AuthModalOptions>({ mode: 'signin' });
  // The /auth/me endpoint is the single source of truth — never trust a
  // local cache for the session. React Query handles the request
  // dedupe + revalidation; the Provider is a thin wrapper so consumers
  // can read user/isLoading from context instead of useQuery.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMeOrNull,
    // Revalidate on focus so signing in/out in another tab eventually
    // syncs without a hard reload.
    refetchOnWindowFocus: 'always',
    staleTime: 60_000,
  });

  const openAuthModal = useCallback((opts?: AuthModalOptions): void => {
    setModalOptions({ mode: opts?.mode ?? 'signin', ...opts });
    setModalOpen(true);
  }, []);

  const closeAuthModal = useCallback((): void => {
    setModalOpen(false);
  }, []);

  const refetchAuth = useCallback(async (): Promise<void> => {
    await refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading,
      refetch: refetchAuth,
      openAuthModal,
      closeAuthModal,
    }),
    [data, isLoading, refetchAuth, openAuthModal, closeAuthModal],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal open={modalOpen} options={modalOptions} onOpenChange={setModalOpen} />
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
