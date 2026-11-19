import { describe, expect, it } from 'vitest';
import { DEFAULT_PORTFOLIOS, DEFAULT_TEAMS } from '../../db/seed.js';
import { parseRosterCsv, templateColumns } from './roster.parse.js';

const days = [
  { id: '00000000-0000-4000-8000-000000000006', date: '2027-01-06' },
  { id: '00000000-0000-4000-8000-000000000007', date: '2027-01-07' },
];
const ctx = { teams: DEFAULT_TEAMS, portfolios: DEFAULT_PORTFOLIOS, days };
const HEADER = templateColumns(days).join(',');
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');

describe('parseRosterCsv', () => {
  it('builds the template header from the configured days', () => {
    expect(HEADER).toBe('name,email,phone,course,rank,team,shadows,day_2027-01-06,day_2027-01-07');
  });

  it('parses every rank with the right team / portfolio mapping', () => {
    const { people, errors } = parseRosterCsv(
      csv(
        'Alex Tan,AlexTan.25@ichat.sp.edu.sg,+65 9123 4567,dcs,Volunteer,sign-up booth,,Y,n',
        'Priya,priya.25@ichat.sp.edu.sg,,DAAA,IC,Sign-Up Booth,,Y,Y',
        'Dee,dee.25@ichat.sp.edu.sg,,,Deputy,Operations & Crowd Management,,Y,Y',
        'Sam,sam.26@ichat.sp.edu.sg,,,Shadow IC,,cc,,',
        'Chief,chief.25@ichat.sp.edu.sg,,,CC,,,Y,Y',
      ),
      ctx,
    );
    expect(errors).toEqual([]);
    expect(people[0]).toMatchObject({
      email: 'alextan.25@ichat.sp.edu.sg',
      phone: '91234567',
      course: 'DCS',
      rank: 'volunteer',
      team: 'Sign-Up Booth',
      availableDayIds: [days[0]!.id],
    });
    expect(people[2]).toMatchObject({
      rank: 'deputy',
      team: null,
      portfolio: 'Operations & Crowd Management',
    });
    expect(people[3]).toMatchObject({ rank: 'shadow_ic', portfolio: 'CC', availableDayIds: [] });
    expect(people[4]).toMatchObject({ rank: 'cc', team: null, portfolio: null });
  });

  it('reports every problem with row and column (T-10)', () => {
    const { people, errors } = parseRosterCsv(
      csv(
        ',bad-email,123,XYZ,Vol,Nowhere,,maybe,Y',
        'Ok,ok.25@ichat.sp.edu.sg,,,Volunteer,Relief,,Y,Y',
        'Dup,OK.25@ichat.sp.edu.sg,,,Volunteer,Relief,,Y,Y',
        'NoTeam,noteam.25@ichat.sp.edu.sg,,,IC,,,Y,Y',
      ),
      ctx,
    );
    const at = (row: number) =>
      errors
        .filter((e) => e.row === row)
        .map((e) => e.column)
        .sort();
    expect(at(2)).toEqual(['course', 'day_2027-01-06', 'email', 'name', 'phone', 'rank']);
    expect(at(4)).toEqual(['email']);
    expect(errors.find((e) => e.row === 4)!.message).toContain('Duplicate of row 3');
    expect(at(5)).toEqual(['team']);
    expect(people.map((p) => p.name)).toEqual(['Ok']);
  });

  it('rejects unknown and missing columns, with a hint for stale day columns', () => {
    const { errors } = parseRosterCsv('name,email,day_2026-12-25\nA,a@x.sg,Y', ctx);
    expect(errors.map((e) => e.column)).toEqual(['rank', 'day_2026-12-25']);
    expect(errors[1]!.message).toContain('download a fresh template');
  });

  it('handles quoted fields, BOM and Windows line endings', () => {
    const file = `${String.fromCharCode(0xfeff)}${HEADER}\r\n"Tan, Alex",alex@ichat.sp.edu.sg,,,Volunteer,"Welcome Party",,Y,Y\r\n`;
    const { people, errors } = parseRosterCsv(file, ctx);
    expect(errors).toEqual([]);
    expect(people[0]!.name).toBe('Tan, Alex');
  });

  it('flags rows with the wrong number of columns', () => {
    const { errors } = parseRosterCsv(csv('Only,two'), ctx);
    expect(errors[0]).toMatchObject({ row: 2, message: expect.stringContaining('columns') });
  });

  it('says so when the file has no people', () => {
    expect(parseRosterCsv(HEADER, ctx).errors[0]!.message).toContain('no people');
  });
});
