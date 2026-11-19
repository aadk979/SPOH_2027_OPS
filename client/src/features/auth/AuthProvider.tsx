import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CurrentUser, VerifyCodeResponse } from '@spoh/shared';
import { api, ApiError, tokenStore } from '../../lib/api';

interface AuthState {
  user: CurrentUser | null;
  /** True while we don't yet know whether the stored token is valid. */
  loading: boolean;
  signIn: (result: VerifyCodeResponse) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Holds the signed-in user. The token lives in localStorage; /api/me confirms it. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => tokenStore.get());

  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => api<CurrentUser>('/me'),
    enabled: Boolean(token),
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
    staleTime: 60_000,
  });

  // An expired or revoked token (e.g. after midnight) silently returns the user to login.
  const expired = me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => {
    if (expired) {
      tokenStore.set(null);
      setToken(null);
    }
  }, [expired]);

  const signIn = useCallback(
    (result: VerifyCodeResponse) => {
      tokenStore.set(result.token);
      queryClient.setQueryData(['me', result.token], result.user);
      setToken(result.token);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* already signed out on the server */
    }
    tokenStore.set(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user: token ? (me.data ?? null) : null,
      loading: Boolean(token) && me.isPending,
      signIn,
      signOut,
    }),
    [token, me.data, me.isPending, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
