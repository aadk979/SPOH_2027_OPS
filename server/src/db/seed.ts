import { sql } from 'drizzle-orm';
import type { StationKind } from '@spoh/shared';
import type { Db } from './client.js';
import { appConfig, eventDay, station } from './schema/index.js';

/**
 * SPOH 2027 defaults (FR-CFG-7), so a fresh install is ready after a roster import.
 * Everything here is editable in the app afterwards; nothing is hard-wired in code paths.
 */

export const DEFAULT_TEAMS = [
  'Welcome Party',
  'Sign-Up Booth',
  'Welcome Lounge',
  'Guides',
  'Room Ushers',
  'Relief',
  'Visitor Tracking',
  'Student Facilitators DAAA',
  'Student Facilitators DCDF',
  'Student Facilitators DCS',
  'Course Counselling',
  'Gift Redemption',
  'Welfare',
  'Safety',
  'Communications',
];

export const DEFAULT_PORTFOLIOS = [
  'Visitor Experience & Engagement',
  'Course Experience & Station Support',
  'Operations & Crowd Management',
  'Course Counselling & Gift Redemption',
  'Welfare, Safety & Communications',
];

export const DEFAULT_DAYS = [
  { date: '2027-01-06', label: 'Sec 4 Tours' },
  { date: '2027-01-07', label: 'Open House Day 1' },
  { date: '2027-01-08', label: 'Open House + Discovery Evening' },
  { date: '2027-01-09', label: 'Open House Day 3' },
];

interface StationSeed {
  name: string;
  location: string;
  room: string;
  kind: StationKind;
  team: string;
}

export const DEFAULT_STATIONS: StationSeed[] = [
  {
    name: 'Bus Bay / Foyer',
    location: 'T19 Bus Bay',
    room: '',
    kind: 'staffed',
    team: 'Welcome Party',
  },
  {
    name: 'Sign-Up Booth',
    location: 'T19 Level 3',
    room: '',
    kind: 'registration',
    team: 'Sign-Up Booth',
  },
  {
    name: 'Welcome Lounge',
    location: 'Welcome Lounge',
    room: 'T2036',
    kind: 'counting',
    team: 'Welcome Lounge',
  },
  {
    name: 'Cyber Wargame Centre',
    location: 'Cyber Wargame Centre',
    room: 'T2034',
    kind: 'counting',
    team: 'Student Facilitators DCDF',
  },
  {
    name: 'CoLab — DAAA',
    location: 'AI & Analytics CoLab',
    room: 'T2131',
    kind: 'counting',
    team: 'Student Facilitators DAAA',
  },
  {
    name: 'CoLab — DCS',
    location: 'AI & Analytics CoLab',
    room: 'T2132',
    kind: 'counting',
    team: 'Student Facilitators DCS',
  },
  {
    name: 'Counselling Room',
    location: 'Counselling Room',
    room: 'T2135A/B',
    kind: 'counselling',
    team: 'Course Counselling',
  },
  { name: 'School Talk', location: 'LT18A', room: 'LT18A', kind: 'counting', team: 'Room Ushers' },
  { name: 'Floating / Relief', location: '', room: '', kind: 'staffed', team: 'Relief' },
];

export const DEFAULT_SUCCESS_TARGETS = {
  dailyLoginPct: 80,
  medianAckMinutes: 10,
  appCapturePct: 90,
  surveyHelpedPct: 60,
  setupMinutes: 30,
};

/** Idempotent: safe to run on every start; only inserts what is missing. */
export async function seedDefaults(db: Db): Promise<void> {
  await db
    .insert(appConfig)
    .values({
      id: 1,
      teams: DEFAULT_TEAMS,
      portfolios: DEFAULT_PORTFOLIOS,
      successTargets: DEFAULT_SUCCESS_TARGETS,
    })
    .onConflictDoNothing();

  const [{ dayCount } = { dayCount: 0 }] = await db
    .select({ dayCount: sql<number>`count(*)::int` })
    .from(eventDay);
  if (dayCount === 0) {
    await db.insert(eventDay).values(DEFAULT_DAYS);
  }

  const [{ stationCount } = { stationCount: 0 }] = await db
    .select({ stationCount: sql<number>`count(*)::int` })
    .from(station);
  if (stationCount === 0) {
    await db
      .insert(station)
      .values(DEFAULT_STATIONS.map((s, index) => ({ ...s, sortOrder: index })));
  }
}
