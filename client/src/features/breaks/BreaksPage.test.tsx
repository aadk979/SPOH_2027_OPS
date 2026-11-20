import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardPerson, BreakSlot } from '@spoh/shared';
import { mockApi } from '../../test/mockApi';
import { renderWithQuery } from '../../test/renderWithQuery';
import { BreaksPage } from './BreaksPage';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const THU = id(7);
const LOUNGE = id(100);

const person = (n: number, name: string, extra: Partial<BoardPerson> = {}): BoardPerson => ({
  id: id(n),
  name,
  rank: 'volunteer',
  team: 'Room Ushers',
  available: true,
  stationId: LOUNGE,
  later: [],
  unacked: 0,
  onBreakUntil: null,
  ...extra,
});

function setup(slots: BreakSlot[] = []) {
  return mockApi({
    'GET /days': () => ({
      body: {
        days: [{ id: THU, date: '2027-01-07', label: '', reportTime: null, dismissTime: null }],
      },
    }),
    'GET /breaks': () => ({ body: { slots } }),
    'GET /breaks/people': () => ({
      body: {
        dayId: THU,
        people: [person(1, 'Amy Lim'), person(2, 'Ben Koh', { onBreakUntil: '12:45' })],
      },
    }),
    'GET /stations': () => ({
      body: {
        stations: [
          {
            id: LOUNGE,
            name: 'Welcome Lounge',
            location: '',
            room: 'T2036',
            kind: 'staffed',
            team: null,
          },
        ],
      },
    }),
    'GET /config/lists': () => ({ body: { teams: ['Room Ushers', 'Welfare'], portfolios: [] } }),
    'POST /breaks': (body) =>
      (body as { override: boolean }).override
        ? { body: { added: 1, unchanged: 0 } }
        : {
            status: 409,
            body: {
              error: {
                code: 'COVERAGE_GAP',
                message: 'Nobody would be left at Welcome Lounge (from 12:00).',
                details: [],
              },
            },
          },
    'PATCH /breaks/slot': () => ({ body: { updated: 1 } }),
  });
}

describe('Breaks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows who is on a break now (FR-BRK-5)', async () => {
    setup();
    renderWithQuery(<BreaksPage />);
    expect(await screen.findByText('On break now: Ben Koh (until 12:45)')).toBeVisible();
  });

  it('adds a break, warns about an empty station, then goes ahead (FR-BRK-1/2/4)', async () => {
    const api = setup();
    renderWithQuery(<BreaksPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add break' }));
    const form = screen.getByRole('form', { name: 'Add break' });
    await userEvent.click(await within(form).findByRole('checkbox', { name: /Amy Lim/ }));
    await userEvent.click(within(form).getByRole('button', { name: 'Add break for 1' }));

    expect(await within(form).findByText(/Nobody would be left at Welcome Lounge/)).toBeVisible();
    await userEvent.click(within(form).getByRole('button', { name: 'Yes, go ahead' }));
    expect(await screen.findByText(/Break added for 1 person/)).toBeVisible();

    const posts = api.calls.filter((c) => c.method === 'POST');
    expect(posts.map((c) => c.body)).toEqual([
      expect.objectContaining({
        start: '12:00',
        end: '12:45',
        label: 'Lunch',
        personIds: [id(1)],
        override: false,
      }),
      expect.objectContaining({ override: true }),
    ]);
  });

  it('adds by team', async () => {
    const api = setup();
    renderWithQuery(<BreaksPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add break' }));
    const form = screen.getByRole('form', { name: 'Add break' });
    await userEvent.click(within(form).getByRole('radio', { name: 'Team' }));
    await userEvent.selectOptions(await within(form).findByLabelText('Team'), 'Welfare');
    await userEvent.click(within(form).getByRole('button', { name: 'Add break' }));
    await vi.waitFor(() =>
      expect(api.calls.find((c) => c.method === 'POST')?.body).toMatchObject({
        teams: ['Welfare'],
        personIds: [],
      }),
    );
  });

  it('moves a slot (FR-BRK-3)', async () => {
    const api = setup([
      {
        start: '12:00',
        end: '12:45',
        label: 'Lunch',
        people: [
          {
            breakId: id(50),
            personId: id(1),
            name: 'Amy Lim',
            team: 'Room Ushers',
            stationName: 'Welcome Lounge',
          },
        ],
      },
    ]);
    renderWithQuery(<BreaksPage />);
    const card = await screen.findByRole('group', { name: 'Break 12:00–12:45 · Lunch' });
    expect(within(card).getByText('Amy Lim')).toBeVisible();
    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const start = within(card).getByLabelText('Start');
    await userEvent.clear(start);
    await userEvent.type(start, '12:30');
    await userEvent.click(within(card).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() =>
      expect(api.calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({
        slot: { dayId: THU, start: '12:00', end: '12:45', label: 'Lunch' },
        to: { start: '12:30', end: '12:45', label: 'Lunch' },
      }),
    );
  });
});
