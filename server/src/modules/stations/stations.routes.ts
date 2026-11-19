import { StationsResponse } from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { requireUser } from '../../plugins/auth.js';
import { listActiveStations } from './stations.service.js';

/** /api/stations: active stations for any signed-in user (station picker). Editing is S3. */
export const stationRoutes: AppPlugin = async (app, { deps }) => {
  app.get(
    '/stations',
    { preHandler: requireUser, schema: { response: { 200: StationsResponse } } },
    async () => ({ stations: await listActiveStations(deps.db) }),
  );
};
