import { asc, eq } from 'drizzle-orm';
import type { CurrentUser, PersonDto, PersonInput, PersonPatch } from '@spoh/shared';
import type { Db } from '../../db/client.js';
import { person } from '../../db/schema/index.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getAppConfig, listEventDays } from '../config/app-config.js';
import { checkRoleFields } from './person-rules.js';

type PersonRow = typeof person.$inferSelect;

export function toPersonDto(p: PersonRow): PersonDto {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    course: p.course,
    rank: p.rank,
    team: p.team,
    portfolio: p.portfolio,
    availableDayIds: p.availableDayIds,
    active: p.active,
  };
}

export async function listPeople(db: Db): Promise<PersonDto[]> {
  const rows = await db.select().from(person).orderBy(asc(person.name));
  return rows.map(toPersonDto);
}

/** Only the CC may create a CC or change a CC (Q23: CC-only control of the top role). */
function assertMayTouchRank(actor: CurrentUser, currentRank: string | null, nextRank?: string) {
  if (actor.tier === 'cc') return;
  if (currentRank === 'cc' || nextRank === 'cc') {
    throw forbidden('Only the Chief Coordinator can create or change a CC.');
  }
}

async function validate(db: Db, merged: PersonInput) {
  const config = await getAppConfig(db);
  const problems = checkRoleFields(merged, config);
  if (problems.length > 0) throw badRequest('Please fix the highlighted fields.', problems);
  const dayIds = new Set((await listEventDays(db)).map((d) => d.id));
  if (merged.availableDayIds.some((id) => !dayIds.has(id))) {
    throw badRequest('One of the selected days no longer exists.');
  }
}

async function assertEmailFree(db: Db, email: string, exceptId?: string) {
  const [existing] = await db.select({ id: person.id }).from(person).where(eq(person.email, email));
  if (existing && existing.id !== exceptId) {
    throw conflict('Someone with this email is already on the roster.');
  }
}

export async function createPerson(db: Db, actor: CurrentUser, input: PersonInput) {
  assertMayTouchRank(actor, null, input.rank);
  await validate(db, input);
  await assertEmailFree(db, input.email);
  const [created] = await db.insert(person).values(input).returning();
  await audit(db, { actorId: actor.id, action: 'person.create', target: created!.id });
  return toPersonDto(created!);
}

export async function updatePerson(db: Db, actor: CurrentUser, id: string, patch: PersonPatch) {
  const [existing] = await db.select().from(person).where(eq(person.id, id));
  if (!existing) throw notFound('Person');
  assertMayTouchRank(actor, existing.rank, patch.rank);
  if (patch.active === false && existing.id === actor.id) {
    throw badRequest("You can't deactivate your own account.");
  }

  const merged: PersonInput = {
    name: patch.name ?? existing.name,
    email: patch.email ?? existing.email,
    phone: patch.phone !== undefined ? patch.phone : existing.phone,
    course: patch.course !== undefined ? patch.course : existing.course,
    rank: patch.rank ?? existing.rank,
    team: patch.team !== undefined ? patch.team : existing.team,
    portfolio: patch.portfolio !== undefined ? patch.portfolio : existing.portfolio,
    availableDayIds: patch.availableDayIds ?? existing.availableDayIds,
  };
  await validate(db, merged);
  if (merged.email !== existing.email) await assertEmailFree(db, merged.email, id);

  const [updated] = await db
    .update(person)
    .set({ ...merged, active: patch.active ?? existing.active, updatedAt: new Date() })
    .where(eq(person.id, id))
    .returning();
  await audit(db, {
    actorId: actor.id,
    action: 'person.update',
    target: id,
    details: { fields: Object.keys(patch) },
  });
  return toPersonDto(updated!);
}
