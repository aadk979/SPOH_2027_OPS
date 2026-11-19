import { DaysResponse, ListsResponse } from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { requireUser } from '../../plugins/auth.js';
import { getAppConfig, listEventDays } from './app-config.js';

/** Read-only configuration for signed-in users. Editing arrives with slice S3. */
export const configRoutes: AppPlugin = async (app, { deps }) => {
  app.get(
    '/days',
    { preHandler: requireUser, schema: { response: { 200: DaysResponse } } },
    async () => {
      const days = await listEventDays(deps.db);
      return {
        days: days.map((d) => ({
          id: d.id,
          date: d.date,
          label: d.label,
          reportTime: d.reportTime?.slice(0, 5) ?? null,
          dismissTime: d.dismissTime?.slice(0, 5) ?? null,
        })),
      };
    },
  );

  app.get(
    '/config/lists',
    { preHandler: requireUser, schema: { response: { 200: ListsResponse } } },
    async () => {
      const config = await getAppConfig(deps.db);
      return { teams: config.teams, portfolios: config.portfolios };
    },
  );
};
