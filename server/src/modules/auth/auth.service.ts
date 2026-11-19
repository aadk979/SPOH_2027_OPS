import { and, desc, eq, gt, gte, isNull, sql } from 'drizzle-orm';
import { endOfSgtDay, hasTier, tierOf, WELFARE_TEAM, type CurrentUser } from '@spoh/shared';
import type { AppDeps } from '../../deps.js';
import { authToken, person } from '../../db/schema/index.js';
import { generateLoginCode, generateSessionToken, hashToken } from '../../lib/crypto.js';
import { AppError, notFound, tooManyRequests } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';

/** Policy constants (SRS FR-AUTH-1/4). */
export const CODE_TTL_MS = 15 * 60_000;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 10 * 60_000;
export const MAX_CODES_PER_WINDOW = 5;

type PersonRow = typeof person.$inferSelect;
type Deps = Pick<AppDeps, 'db' | 'clock' | 'email' | 'config'>;

export function toCurrentUser(p: PersonRow): CurrentUser {
  const tier = tierOf(p.rank);
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    rank: p.rank,
    tier,
    team: p.team,
    portfolio: p.portfolio,
    course: p.course,
    canManageBreaks: hasTier(tier, 'admin') || (tier === 'ic' && p.team === WELFARE_TEAM),
  };
}

async function findActivePersonByEmail(deps: Deps, email: string) {
  const [row] = await deps.db
    .select()
    .from(person)
    .where(and(eq(person.email, email.toLowerCase()), eq(person.active, true)));
  return row;
}

async function isLockedOut(deps: Deps, personId: string, now: Date) {
  const [locked] = await deps.db
    .select({ id: authToken.id })
    .from(authToken)
    .where(
      and(
        eq(authToken.personId, personId),
        eq(authToken.kind, 'code'),
        gte(authToken.failedAttempts, MAX_FAILED_ATTEMPTS),
        gt(authToken.createdAt, new Date(now.getTime() - LOCKOUT_MS)),
      ),
    )
    .limit(1);
  return Boolean(locked);
}

async function createCode(deps: Deps, personId: string, issuedBy: string | null) {
  const now = deps.clock.now();
  const code = generateLoginCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  await deps.db.insert(authToken).values({
    personId,
    kind: 'code',
    tokenHash: hashToken(code, personId),
    expiresAt,
    issuedBy,
    createdAt: now,
  });
  return { code, expiresAt };
}

/**
 * Step 1 of login. Always resolves the same way whether or not the email is on the roster,
 * so the response never reveals who is on the committee (FR-AUTH-2).
 */
export async function requestLoginCode(deps: Deps, email: string): Promise<void> {
  const p = await findActivePersonByEmail(deps, email);
  if (!p) return;
  const now = deps.clock.now();
  if (await isLockedOut(deps, p.id, now)) return;

  const [{ recent } = { recent: 0 }] = await deps.db
    .select({ recent: sql<number>`count(*)::int` })
    .from(authToken)
    .where(
      and(
        eq(authToken.personId, p.id),
        eq(authToken.kind, 'code'),
        gt(authToken.createdAt, new Date(now.getTime() - CODE_TTL_MS)),
      ),
    );
  if (recent >= MAX_CODES_PER_WINDOW) return;

  const { code } = await createCode(deps, p.id, null);
  const link = `${deps.config.PUBLIC_APP_URL}/login#email=${encodeURIComponent(p.email)}&code=${code}`;
  await deps.email.send({
    to: p.email,
    subject: `Your SPOH 2027 sign-in code: ${code}`,
    text: [
      `Hi ${p.name},`,
      '',
      `Your sign-in code is ${code}. It expires in 15 minutes.`,
      '',
      `Or tap this link to sign in: ${link}`,
      '',
      "If you didn't ask for this, you can ignore this email.",
    ].join('\n'),
  });
}

const invalidCode = () =>
  new AppError(401, 'INVALID_CODE', 'That code is wrong or has expired. Request a new one.');

/** Step 2 of login: exchanges a valid code for a session token that lasts until 23:59 SGT. */
export async function verifyLoginCode(deps: Deps, email: string, code: string) {
  const p = await findActivePersonByEmail(deps, email);
  if (!p) throw invalidCode();
  const now = deps.clock.now();
  if (await isLockedOut(deps, p.id, now)) {
    throw tooManyRequests('Too many wrong codes. Please wait 10 minutes and try again.');
  }

  const [latest] = await deps.db
    .select()
    .from(authToken)
    .where(
      and(
        eq(authToken.personId, p.id),
        eq(authToken.kind, 'code'),
        isNull(authToken.usedAt),
        gt(authToken.expiresAt, now),
      ),
    )
    .orderBy(desc(authToken.createdAt))
    .limit(1);
  if (!latest) throw invalidCode();

  if (latest.tokenHash !== hashToken(code, p.id)) {
    await deps.db
      .update(authToken)
      .set({ failedAttempts: latest.failedAttempts + 1 })
      .where(eq(authToken.id, latest.id));
    throw invalidCode();
  }

  const token = generateSessionToken();
  const expiresAt = endOfSgtDay(now);
  await deps.db.transaction(async (tx) => {
    await tx.update(authToken).set({ usedAt: now }).where(eq(authToken.id, latest.id));
    await tx.insert(authToken).values({
      personId: p.id,
      kind: 'session',
      tokenHash: hashToken(token),
      expiresAt,
      createdAt: now,
    });
  });
  return { token, expiresAt: expiresAt.toISOString(), user: toCurrentUser(p) };
}

/** Resolves a bearer token to its active person, or undefined. */
export async function findSessionUser(deps: Pick<AppDeps, 'db' | 'clock'>, token: string) {
  const [row] = await deps.db
    .select({ person })
    .from(authToken)
    .innerJoin(person, eq(person.id, authToken.personId))
    .where(
      and(
        eq(authToken.tokenHash, hashToken(token)),
        eq(authToken.kind, 'session'),
        gt(authToken.expiresAt, deps.clock.now()),
        eq(person.active, true),
      ),
    );
  return row?.person;
}

/** Ends a session. The row is kept (expired) because sessions feed the login metrics. */
export async function logout(deps: Pick<AppDeps, 'db' | 'clock'>, token: string) {
  await deps.db
    .update(authToken)
    .set({ expiresAt: deps.clock.now() })
    .where(and(eq(authToken.tokenHash, hashToken(token)), eq(authToken.kind, 'session')));
}

/** FR-AUTH-5: an Admin generates a code on screen for someone whose email isn't arriving. */
export async function issueCodeForPerson(deps: Deps, actorId: string, personId: string) {
  const [p] = await deps.db.select().from(person).where(eq(person.id, personId));
  if (!p || !p.active) throw notFound('Person');
  const { code, expiresAt } = await createCode(deps, p.id, actorId);
  await audit(deps.db, { actorId, action: 'auth.issue_code', target: p.id });
  return { code, expiresAt: expiresAt.toISOString(), personName: p.name };
}
