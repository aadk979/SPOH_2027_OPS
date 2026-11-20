import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import { hasTier, type CurrentUser, type Tier } from '@spoh/shared';
import type { AppDeps } from '../deps.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { findSessionUser, toCurrentUser } from '../modules/auth/auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** The signed-in user, set by the auth plugin; null when no valid token was sent. */
    user: CurrentUser | null;
    /** The raw bearer token (used for logout). */
    sessionToken: string | null;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** Resolves the bearer token on every request. Routes then opt in to guards below. */
export const authPlugin = fp<{ deps: AppDeps }>(async (app, { deps }) => {
  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', null);
  app.addHook('onRequest', async (request) => {
    const token = bearerToken(request);
    if (!token) return;
    const p = await findSessionUser(deps, token);
    if (p) {
      request.user = toCurrentUser(p);
      request.sessionToken = token;
    }
  });
});

/** Returns the user or throws 401. Use inside handlers after a guard. */
export function currentUser(request: FastifyRequest): CurrentUser {
  if (!request.user) throw unauthorized();
  return request.user;
}

/** A route preHandler. Plain function type so it fits any route's type provider. */
export type Guard = (request: FastifyRequest) => Promise<void>;

/**
 * Route guard: the signed-in user must be at least `tier` (FR-AUTH-6).
 * Usage: `{ preHandler: requireTier('admin') }`. Enforced on the server, always.
 */
export function requireTier(tier: Tier): Guard {
  return async (request: FastifyRequest) => {
    const user = currentUser(request);
    if (!hasTier(user.tier, tier)) throw forbidden();
  };
}

export const requireUser: Guard = async (request) => {
  currentUser(request);
};

/** CC-only actions: roster import/replace, reset counts, wipe data (Q23). */
export const requireCC = requireTier('cc');

/** Breaks: Admins and the Welfare IC (FR-BRK-1, FR-AUTH-6). */
export const requireBreakManager: Guard = async (request) => {
  if (!currentUser(request).canManageBreaks) throw forbidden();
};
