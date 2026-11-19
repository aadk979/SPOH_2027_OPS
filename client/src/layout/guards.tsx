import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { hasTier, type Tier } from '@spoh/shared';
import { useAuth } from '../features/auth/AuthProvider';
import { homePathFor } from './nav';

function Loading() {
  return <div className="grid min-h-dvh place-items-center text-sm text-muted">Loading…</div>;
}

/** Sends signed-out users to /login. (The server enforces permissions; this is convenience.) */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Hides screens above the user's tier by redirecting to their home screen. */
export function RequireTier({ tier, children }: { tier: Tier; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!hasTier(user.tier, tier)) return <Navigate to={homePathFor(user)} replace />;
  return children;
}

export function HomeRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to={homePathFor(user)} replace /> : <Navigate to="/login" replace />;
}
