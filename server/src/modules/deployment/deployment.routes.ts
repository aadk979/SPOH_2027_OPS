import {
  AssignBody,
  AssignResponse,
  BoardQuery,
  BoardResponse,
  UnackedQuery,
  UnackedResponse,
} from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireTier } from '../../plugins/auth.js';
import { assign, board, unackedChanges } from './deployment.service.js';

/** /api/deployment: Admin-only (FR-DUTY-9). ICs and volunteers get 403 from the server. */
export const deploymentRoutes: AppPlugin = async (app, { deps }) => {
  const adminOnly = { preHandler: requireTier('admin') };

  app.post(
    '/deployment/assign',
    { ...adminOnly, schema: { body: AssignBody, response: { 200: AssignResponse } } },
    async (request) => assign(deps.db, currentUser(request), deps.clock.now(), request.body),
  );

  app.get(
    '/deployment/board',
    { ...adminOnly, schema: { querystring: BoardQuery, response: { 200: BoardResponse } } },
    async (request) => ({
      dayId: request.query.dayId,
      people: await board(deps.db, deps.clock.now(), request.query.dayId),
    }),
  );

  app.get(
    '/deployment/unacked',
    { ...adminOnly, schema: { querystring: UnackedQuery, response: { 200: UnackedResponse } } },
    async (request) => ({
      changes: await unackedChanges(deps.db, deps.clock.now(), request.query),
    }),
  );
};
