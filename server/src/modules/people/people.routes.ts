import { z } from 'zod';
import { PeopleListResponse, PersonDto, PersonInput, PersonPatch } from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireTier } from '../../plugins/auth.js';
import { createPerson, listPeople, updatePerson } from './people.service.js';

/** /api/people — Admin roster management (FR-CFG-4). Contact details are Admin-only here. */
export const peopleRoutes: AppPlugin = async (app, { deps }) => {
  const adminOnly = { preHandler: requireTier('admin') };

  app.get(
    '/people',
    { ...adminOnly, schema: { response: { 200: PeopleListResponse } } },
    async () => ({
      people: await listPeople(deps.db),
    }),
  );

  app.post(
    '/people',
    { ...adminOnly, schema: { body: PersonInput, response: { 201: PersonDto } } },
    async (request, reply) => {
      const created = await createPerson(deps.db, currentUser(request), request.body);
      return reply.status(201).send(created);
    },
  );

  app.patch(
    '/people/:id',
    {
      ...adminOnly,
      schema: {
        params: z.object({ id: z.uuid() }),
        body: PersonPatch,
        response: { 200: PersonDto },
      },
    },
    async (request) => updatePerson(deps.db, currentUser(request), request.params.id, request.body),
  );
};
