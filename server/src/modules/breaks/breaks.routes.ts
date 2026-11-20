import { z } from 'zod';
import {
  AddBreakBody,
  AddBreakResponse,
  BreaksQuery,
  BreaksResponse,
  BoardQuery,
  BoardResponse,
  EditSlotBody,
  RemovedResponse,
  SlotRef,
} from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireBreakManager } from '../../plugins/auth.js';
import { board } from '../deployment/deployment.service.js';
import { addBreak, editSlot, listSlots, removeOne, removeSlot } from './breaks.service.js';

/** /api/breaks: Welfare IC and Admins only (FR-BRK-1..4). */
export const breakRoutes: AppPlugin = async (app, { deps }) => {
  const guard = { preHandler: requireBreakManager };
  const { db, clock } = deps;

  app.get(
    '/breaks',
    { ...guard, schema: { querystring: BreaksQuery, response: { 200: BreaksResponse } } },
    async (request) => ({ slots: await listSlots(db, request.query.dayId) }),
  );

  // Names, teams and posts (no contact details) so the Welfare IC can pick people.
  app.get(
    '/breaks/people',
    { ...guard, schema: { querystring: BoardQuery, response: { 200: BoardResponse } } },
    async (request) => ({
      dayId: request.query.dayId,
      people: await board(db, clock.now(), request.query.dayId),
    }),
  );

  app.post(
    '/breaks',
    { ...guard, schema: { body: AddBreakBody, response: { 200: AddBreakResponse } } },
    async (request) => addBreak(db, clock.now(), currentUser(request), request.body),
  );

  app.patch(
    '/breaks/slot',
    {
      ...guard,
      schema: { body: EditSlotBody, response: { 200: z.object({ updated: z.number().int() }) } },
    },
    async (request) => editSlot(db, clock.now(), currentUser(request), request.body),
  );

  app.delete(
    '/breaks/slot',
    { ...guard, schema: { querystring: SlotRef, response: { 200: RemovedResponse } } },
    async (request) => removeSlot(db, clock.now(), currentUser(request), request.query),
  );

  app.delete(
    '/breaks/:id',
    {
      ...guard,
      schema: { params: z.object({ id: z.uuid() }), response: { 200: RemovedResponse } },
    },
    async (request) => removeOne(db, clock.now(), currentUser(request), request.params.id),
  );
};
