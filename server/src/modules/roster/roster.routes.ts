import { z } from 'zod';
import { RosterCommitResponse, RosterPreviewResponse, RosterUploadBody } from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireCC } from '../../plugins/auth.js';
import { commitRoster, deactivatePeople, previewRoster, rosterTemplate } from './roster.service.js';

/** /api/roster/* — CC-only bulk import (FR-CFG-1…3, Q23). */
export const rosterRoutes: AppPlugin = async (app, { deps }) => {
  app.get('/roster/template.csv', { preHandler: requireCC }, async (_request, reply) => {
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="spoh-roster-template.csv"');
    return rosterTemplate(deps.db);
  });

  app.post(
    '/roster/preview',
    {
      preHandler: requireCC,
      schema: { body: RosterUploadBody, response: { 200: RosterPreviewResponse } },
    },
    async (request) => previewRoster(deps.db, request.body.csv, currentUser(request).id),
  );

  app.post(
    '/roster/commit',
    {
      preHandler: requireCC,
      schema: { body: RosterUploadBody, response: { 200: RosterCommitResponse } },
    },
    async (request) => commitRoster(deps.db, currentUser(request).id, request.body.csv),
  );

  app.post(
    '/roster/deactivate',
    {
      preHandler: requireCC,
      schema: {
        body: z.object({ ids: z.array(z.uuid()).min(1) }),
        response: { 200: z.object({ deactivated: z.number() }) },
      },
    },
    async (request) => ({
      deactivated: await deactivatePeople(deps.db, currentUser(request).id, request.body.ids),
    }),
  );
};
