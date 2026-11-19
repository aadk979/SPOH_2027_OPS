import { z } from 'zod';
import {
  CreateCountsResponse,
  CreateFootfallBody,
  FootfallSummary,
  SummaryQuery,
} from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireUser } from '../../plugins/auth.js';
import { footfallSummary, recordFootfall, undoFootfall } from './footfall.service.js';

/** /api/footfall: room counting, kept apart from /api/registrations (Rule 1). */
export const footfallRoutes: AppPlugin = async (app, { deps }) => {
  app.post(
    '/footfall',
    {
      preHandler: requireUser,
      schema: { body: CreateFootfallBody, response: { 200: CreateCountsResponse } },
    },
    async (request) => recordFootfall(deps, currentUser(request), request.body),
  );

  app.delete(
    '/footfall/:clientId',
    {
      preHandler: requireUser,
      schema: {
        params: z.object({ clientId: z.uuid() }),
        response: { 200: z.object({ removed: z.number().int() }) },
      },
    },
    async (request) => undoFootfall(deps, currentUser(request), request.params.clientId),
  );

  app.get(
    '/footfall/summary',
    {
      preHandler: requireUser,
      schema: { querystring: SummaryQuery, response: { 200: FootfallSummary } },
    },
    async (request) => footfallSummary(deps, request.query),
  );
};
