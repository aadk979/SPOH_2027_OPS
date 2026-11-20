import { z } from 'zod';
import {
  DayImpact,
  DayInput,
  DayPatch,
  EventDayDto,
  StationAdminDto,
  StationInput,
  StationPatch,
  StationsAdminResponse,
  Thresholds,
} from '@spoh/shared';
import type { AppPlugin } from '../../types.js';
import { currentUser, requireTier } from '../../plugins/auth.js';
import { createDay, dayImpact, deleteDay, updateDay } from './days.service.js';
import {
  createStation,
  getThresholds,
  listAllStations,
  saveThresholds,
  updateStation,
} from './stations-admin.service.js';

const IdParams = z.object({ id: z.uuid() });

/** Setup: event days, stations, thresholds. Admins only; nothing is hard-wired (FR-CFG-5/6). */
export const setupRoutes: AppPlugin = async (app, { deps }) => {
  const adminOnly = { preHandler: requireTier('admin') };
  const { db, clock } = deps;

  app.post(
    '/days',
    { ...adminOnly, schema: { body: DayInput, response: { 201: EventDayDto } } },
    async (request, reply) =>
      reply.status(201).send(await createDay(db, currentUser(request), request.body)),
  );

  app.patch(
    '/days/:id',
    { ...adminOnly, schema: { params: IdParams, body: DayPatch, response: { 200: EventDayDto } } },
    async (request) =>
      updateDay(db, clock.now(), currentUser(request), request.params.id, request.body),
  );

  app.get(
    '/days/:id/impact',
    { ...adminOnly, schema: { params: IdParams, response: { 200: DayImpact } } },
    async (request) => dayImpact(db, request.params.id),
  );

  app.delete(
    '/days/:id',
    {
      ...adminOnly,
      schema: {
        params: IdParams,
        querystring: z.object({ confirm: z.enum(['true', 'false']).optional() }),
        response: { 200: DayImpact },
      },
    },
    async (request) =>
      deleteDay(db, currentUser(request), request.params.id, request.query.confirm === 'true'),
  );

  app.get(
    '/setup/stations',
    { ...adminOnly, schema: { response: { 200: StationsAdminResponse } } },
    async () => ({ stations: await listAllStations(db) }),
  );

  app.post(
    '/setup/stations',
    { ...adminOnly, schema: { body: StationInput, response: { 201: StationAdminDto } } },
    async (request, reply) =>
      reply.status(201).send(await createStation(db, currentUser(request), request.body)),
  );

  app.patch(
    '/setup/stations/:id',
    {
      ...adminOnly,
      schema: { params: IdParams, body: StationPatch, response: { 200: StationAdminDto } },
    },
    async (request) => updateStation(db, currentUser(request), request.params.id, request.body),
  );

  app.get(
    '/setup/thresholds',
    { ...adminOnly, schema: { response: { 200: Thresholds } } },
    async () => getThresholds(db),
  );

  app.put(
    '/setup/thresholds',
    { ...adminOnly, schema: { body: Thresholds, response: { 200: Thresholds } } },
    async (request) => saveThresholds(db, currentUser(request), request.body),
  );
};
