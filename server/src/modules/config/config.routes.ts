import { DaysResponse, ListsResponse } from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { requireUser } from '../../plugins/auth.js';
import { toDayDto } from '../setup/days.service.js';
import { getAppConfig, listEventDays } from './app-config.js';

/** Read-only configuration for signed-in users. Editing lives in modules/setup. */
export const configRoutes: AppPlugin = async (app, { deps }) => {
  app.get(
    '/days',
    { preHandler: requireUser, schema: { response: { 200: DaysResponse } } },
    async () => {
      const days = await listEventDays(deps.db);
      return {
        days: days.map(toDayDto),
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
