import rateLimit from '@fastify/rate-limit';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CurrentUser,
  IssuedCodeResponse,
  MessageResponse,
  RequestCodeBody,
  VerifyCodeBody,
  VerifyCodeResponse,
} from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireTier, requireUser } from '../../plugins/auth.js';
import { issueCodeForPerson, logout, requestLoginCode, verifyLoginCode } from './auth.service.js';

const NEUTRAL_MESSAGE = "If you're on the roster, a code is on its way. Check your iChat inbox.";

/** /api/auth/* and /api/me */
export const authRoutes: AppPlugin = async (app, { deps }) => {
  // Per-IP limit on the public login endpoints (NFR-S-4). Disabled in tests.
  await app.register(async (instance) => {
    const publicAuth = instance.withTypeProvider<ZodTypeProvider>();
    if (deps.config.NODE_ENV !== 'test') {
      await instance.register(rateLimit, { max: 20, timeWindow: '1 minute' });
    }

    publicAuth.post(
      '/auth/request',
      { schema: { body: RequestCodeBody, response: { 200: MessageResponse } } },
      async (request) => {
        await requestLoginCode(deps, request.body.email);
        return { message: NEUTRAL_MESSAGE };
      },
    );

    publicAuth.post(
      '/auth/verify',
      { schema: { body: VerifyCodeBody, response: { 200: VerifyCodeResponse } } },
      async (request) => verifyLoginCode(deps, request.body.email, request.body.code),
    );
  });

  app.post(
    '/auth/logout',
    { preHandler: requireUser, schema: { response: { 200: MessageResponse } } },
    async (request) => {
      if (request.sessionToken) await logout(deps, request.sessionToken);
      return { message: 'Signed out.' };
    },
  );

  app.get(
    '/me',
    { preHandler: requireUser, schema: { response: { 200: CurrentUser } } },
    async (request) => currentUser(request),
  );

  app.post(
    '/auth/issue-code/:personId',
    {
      preHandler: requireTier('admin'),
      schema: {
        params: z.object({ personId: z.uuid() }),
        response: { 200: IssuedCodeResponse },
      },
    },
    async (request) => issueCodeForPerson(deps, currentUser(request).id, request.params.personId),
  );
};
