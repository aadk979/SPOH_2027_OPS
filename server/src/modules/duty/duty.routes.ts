import { AckBody, AckResponse, MyDutyResponse, TeamQuery, TeamResponse } from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireTier, requireUser } from '../../plugins/auth.js';
import { acknowledge, myDuty, teamView } from './duty.service.js';

/** /api/duty (anyone signed in, own data only) and /api/team (ICs and above, FR-DUTY-10). */
export const dutyRoutes: AppPlugin = async (app, { deps }) => {
  app.get(
    '/duty/me',
    { preHandler: requireUser, schema: { response: { 200: MyDutyResponse } } },
    async (request) => myDuty(deps.db, deps.clock.now(), currentUser(request).id),
  );

  app.post(
    '/duty/ack',
    { preHandler: requireUser, schema: { body: AckBody, response: { 200: AckResponse } } },
    async (request) => ({
      acknowledged: await acknowledge(
        deps.db,
        deps.clock.now(),
        currentUser(request).id,
        request.body.ids,
      ),
    }),
  );

  app.get(
    '/team',
    {
      preHandler: requireTier('ic'),
      schema: { querystring: TeamQuery, response: { 200: TeamResponse } },
    },
    async (request) =>
      teamView(deps.db, deps.clock.now(), currentUser(request), request.query.dayId),
  );
};
