import { parse } from 'csv-parse/sync';
import {
  COURSES,
  dayColumnName,
  EmailSchema,
  PhoneSchema,
  RANK_CSV_VALUES,
  type Course,
  type PersonInput,
  type RosterIssue,
} from '@spoh/shared';
import { canonical, checkRoleFields } from '../people/person-rules.js';

export interface RosterContext {
  teams: readonly string[];
  portfolios: readonly string[];
  days: readonly { id: string; date: string }[];
}

export interface ParsedRosterRow extends PersonInput {
  row: number;
}

export interface ParseResult {
  people: ParsedRosterRow[];
  errors: RosterIssue[];
}

/** Excel often saves UTF-8 CSVs with a byte-order mark; drop it before parsing. */
const BOM = String.fromCharCode(0xfeff);
const stripBom = (text: string) => (text.startsWith(BOM) ? text.slice(BOM.length) : text);

const REQUIRED_COLUMNS = ['name', 'email', 'rank'] as const;
const OPTIONAL_COLUMNS = ['phone', 'course', 'team', 'shadows'] as const;

/** Column order of the downloadable template (always matches the configured days). */
export function templateColumns(days: RosterContext['days']): string[] {
  return [
    ...REQUIRED_COLUMNS.slice(0, 2),
    'phone',
    'course',
    'rank',
    'team',
    'shadows',
    ...days.map((d) => dayColumnName(d.date)),
  ];
}

/**
 * Parses and validates a roster CSV in one pass, collecting *every* problem with its
 * row and column so the CC can fix the file in one go (FR-CFG-1). Never throws for bad data.
 */
export function parseRosterCsv(csv: string, ctx: RosterContext): ParseResult {
  const errors: RosterIssue[] = [];
  let table: string[][];
  try {
    table = parse(stripBom(csv), {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    const message = `Could not read the CSV: ${(err as Error).message}`;
    return { people: [], errors: [{ row: 0, column: '', message }] };
  }

  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const records: (Record<string, string> | null)[] = table
    .slice(1)
    .map((cells) =>
      cells.length === header.length
        ? Object.fromEntries(header.map((h, i) => [h, cells[i]!]))
        : null,
    );
  const dayColumns = new Map(ctx.days.map((d) => [dayColumnName(d.date), d.id]));
  const known = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS, ...dayColumns.keys()]);
  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col))
      errors.push({ row: 1, column: col, message: `Missing required column "${col}".` });
  }
  for (const col of header) {
    if (!known.has(col)) {
      const hint = col.startsWith('day_')
        ? ' That date is not a configured event day — download a fresh template.'
        : '';
      errors.push({ row: 1, column: col, message: `Unknown column "${col}".${hint}` });
    }
  }
  if (errors.length > 0) return { people: [], errors };
  if (records.length === 0)
    return {
      people: [],
      errors: [{ row: 0, column: '', message: 'The file has no people in it.' }],
    };

  const people: ParsedRosterRow[] = [];
  const seenEmails = new Map<string, number>();

  records.forEach((rec, index) => {
    const row = index + 2; // header is line 1
    if (!rec) {
      errors.push({ row, column: '', message: `Expected ${header.length} columns on this row.` });
      return;
    }
    const before = errors.length;
    const issue = (column: string, message: string) => errors.push({ row, column, message });

    const name = rec.name ?? '';
    if (!name) issue('name', 'Name is required.');

    const email = EmailSchema.safeParse(rec.email ?? '');
    if (!email.success) issue('email', 'Not a valid email address.');
    else if (seenEmails.has(email.data))
      issue('email', `Duplicate of row ${seenEmails.get(email.data)} (${email.data}).`);
    else seenEmails.set(email.data, row);

    let phone: string | null = null;
    if (rec.phone) {
      const p = PhoneSchema.safeParse(rec.phone);
      if (p.success) phone = p.data;
      else issue('phone', 'Phone must be an 8-digit Singapore number (or leave it blank).');
    }

    let course: Course | null = null;
    if (rec.course) {
      const c = COURSES.find((x) => x.toLowerCase() === rec.course!.toLowerCase());
      if (c) course = c;
      else issue('course', `"${rec.course}" is not one of ${COURSES.join(', ')}.`);
    }

    const rankKey = (rec.rank ?? '').toLowerCase() as keyof typeof RANK_CSV_VALUES;
    const rank = RANK_CSV_VALUES[rankKey];
    if (!rank)
      issue('rank', `"${rec.rank ?? ''}" is not one of CC, Deputy, IC, Shadow IC, Volunteer.`);

    // The CSV's "team" column holds a Deputy's portfolio; "shadows" holds a Shadow IC's.
    let team: string | null = null;
    let portfolio: string | null = null;
    if (rank === 'deputy') portfolio = rec.team ? canonical(rec.team, ctx.portfolios) : null;
    else if (rank === 'shadow_ic')
      portfolio = rec.shadows ? canonical(rec.shadows, [...ctx.portfolios, 'CC']) : null;
    else if (rank === 'ic' || rank === 'volunteer')
      team = rec.team ? canonical(rec.team, ctx.teams) : null;
    if (rank) {
      for (const v of checkRoleFields({ rank, team, portfolio }, ctx)) {
        issue(v.field === 'portfolio' && rank === 'shadow_ic' ? 'shadows' : 'team', v.message);
      }
    }

    const availableDayIds: string[] = [];
    for (const [col, dayId] of dayColumns) {
      const value = (rec[col] ?? '').toUpperCase();
      if (value === 'Y' || value === 'YES') availableDayIds.push(dayId);
      else if (value !== '' && value !== 'N' && value !== 'NO') issue(col, 'Use Y or N.');
    }

    if (errors.length === before && rank && email.success) {
      people.push({
        row,
        name,
        email: email.data,
        phone,
        course,
        rank,
        team,
        portfolio,
        availableDayIds,
      });
    }
  });

  return { people, errors };
}
