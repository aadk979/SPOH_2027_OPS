import { FailedEmailsResponse, RetryEmailBody, RetryEmailResponse } from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireTier } from '../../plugins/auth.js';
import { failedEmails, retryEmails } from './notifications.service.js';

/** /api/notifications: failed duty emails, visible to Admins (FR-NOTIF-3). */
export const notificationRoutes: AppPlugin = async (app, { deps }) => {
  const adminOnly = requireTier('admin');

  app.get(
    '/notifications/failed',
    { preHandler: adminOnly, schema: { response: { 200: FailedEmailsResponse } } },
    async () => failedEmails(deps.db),
  );

  app.post(
    '/notifications/retry',
    {
      preHandler: adminOnly,
      schema: { body: RetryEmailBody, response: { 200: RetryEmailResponse } },
    },
    async (request) => ({
      requeued: await retryEmails(deps.db, currentUser(request), request.body.personId),
    }),
  );
};
