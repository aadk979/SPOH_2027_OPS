import { z } from 'zod';
import {
  CreateCountsResponse,
  CreateRegistrationsBody,
  RegistrationSummary,
  SummaryQuery,
} from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireUser } from '../../plugins/auth.js';
import {
  recordRegistrations,
  registrationSummary,
  undoRegistration,
} from './registration.service.js';

/**
 * /api/registrations: any signed-in user can register visitors at any registration point
 * (shared-device rule T4: counts belong to the station; the user is kept for audit/undo).
 */
export const registrationRoutes: AppPlugin = async (app, { deps }) => {
  app.post(
    '/registrations',
    {
      preHandler: requireUser,
      schema: { body: CreateRegistrationsBody, response: { 200: CreateCountsResponse } },
    },
    async (request) => recordRegistrations(deps, currentUser(request), request.body),
  );

  app.delete(
    '/registrations/:clientId',
    {
      preHandler: requireUser,
      schema: {
        params: z.object({ clientId: z.uuid() }),
        response: { 200: z.object({ removed: z.number().int() }) },
      },
    },
    async (request) => undoRegistration(deps, currentUser(request), request.params.clientId),
  );

  app.get(
    '/registrations/summary',
    {
      preHandler: requireUser,
      schema: { querystring: SummaryQuery, response: { 200: RegistrationSummary } },
    },
    async (request) => registrationSummary(deps, request.query),
  );
};
