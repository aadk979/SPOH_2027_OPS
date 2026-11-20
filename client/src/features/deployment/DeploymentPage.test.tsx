import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardPerson, StationAdminDto } from '@spoh/shared';
import { mockApi } from '../../test/mockApi';
import { renderWithQuery } from '../../test/renderWithQuery';
import { DeploymentPage } from './DeploymentPage';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const THU = id(7);
const FRI = id(8);
const LOUNGE = id(100);

const station = (sid: string, name: string): StationAdminDto => ({
  id: sid,
  name,
  location: '',
  room: '',
  kind: 'counting',
  team: null,
  sortOrder: 0,
  capacity: null,
  active: true,
});

const person = (n: number, name: string, extra: Partial<BoardPerson> = {}): BoardPerson => ({
  id: id(n),
  name,
  rank: 'volunteer',
  team: 'Room Ushers',
  available: true,
  stationId: null,
  later: [],
  unacked: 0,
  onBreakUntil: null,
  ...extra,
});

function setup(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /notifications/failed': () => ({ body: { failed: [], queued: 0 } }),
    'GET /days': () => ({
      body: {
        days: [
          { id: THU, date: '2027-01-07', label: '', reportTime: null, dismissTime: null },
          { id: FRI, date: '2027-01-08', label: '', reportTime: null, dismissTime: null },
        ],
      },
    }),
    'GET /setup/stations': () => ({ body: { stations: [station(LOUNGE, 'Welcome Lounge')] } }),
    'GET /deployment/unacked': () => ({ body: { changes: [] } }),
    'GET /config/lists': () => ({ body: { teams: ['Room Ushers'], portfolios: [] } }),
    'GET /deployment/board': () => ({
      body: {
        dayId: THU,
        people: [
          person(1, 'Mei Ling'),
          person(2, 'Hari Kumar'),
          person(3, 'Ben Ho', { stationId: LOUNGE, onBreakUntil: '12:45' }),
          person(4, 'Zoe Tan', { available: false }),
        ],
      },
    }),
    'POST /deployment/assign': (body) =>
      (body as { override: boolean }).override
        ? { body: { assigned: 4, unchanged: 0 } }
        : {
            status: 409,
            body: {
              error: {
                code: 'NOT_AVAILABLE',
                message: 'Some people are not available on the chosen days.',
                details: [{ personId: id(2), name: 'Hari Kumar', dayId: FRI, day: 'Fri 8 Jan' }],
              },
            },
          },
    ...extra,
  });
}

describe('Deployment', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('groups people: unassigned, by station, then not available', async () => {
    setup();
    renderWithQuery(<DeploymentPage />);
    const unassigned = await screen.findByRole('group', { name: 'Unassigned' });
    expect(await within(unassigned).findByText('Mei Ling')).toBeVisible();
    expect(
      within(screen.getByRole('group', { name: 'Welcome Lounge' })).getByText('Ben Ho'),
    ).toBeVisible();
    expect(
      within(screen.getByRole('group', { name: 'Not available this day' })).getByText('Zoe Tan'),
    ).toBeVisible();
  });

  it('bulk move: warns about availability, then assigns anyway (FR-DUTY-2/4)', async () => {
    const api = setup();
    renderWithQuery(<DeploymentPage />);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Mei Ling/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Hari Kumar/ }));
    const panel = screen.getByRole('group', { name: 'Move people' });
    expect(within(panel).getByText('Move 2 people')).toBeVisible();
    await userEvent.selectOptions(within(panel).getByLabelText('To station'), 'Welcome Lounge');
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'Fri 8 Jan' }));
    await userEvent.click(within(panel).getByRole('radio', { name: 'From' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Confirm move' }));

    expect(
      await within(panel).findByText(/Hari Kumar is not available on Fri 8 Jan/),
    ).toBeVisible();
    await userEvent.click(within(panel).getByRole('button', { name: 'Assign anyway' }));
    expect(await screen.findByText(/Saved: 4 posts/)).toBeVisible();

    const posts = api.calls.filter((c) => c.path === '/deployment/assign').map((c) => c.body);
    expect(posts).toEqual([
      {
        personIds: [id(1), id(2)],
        stationId: LOUNGE,
        dayIds: [THU, FRI],
        from: '13:00',
        override: false,
      },
      {
        personIds: [id(1), id(2)],
        stationId: LOUNGE,
        dayIds: [THU, FRI],
        from: '13:00',
        override: true,
      },
    ]);
  });

  it('shows who is on a break now (FR-BRK-5)', async () => {
    setup();
    renderWithQuery(<DeploymentPage />);
    const lounge = await screen.findByRole('group', { name: 'Welcome Lounge' });
    expect(within(lounge).getByText('On break until 12:45')).toBeVisible();
  });

  it('lists failed duty emails and retries them (FR-NOTIF-3)', async () => {
    const api = setup({
      'GET /notifications/failed': () => ({
        body: {
          failed: [
            {
              personId: id(2),
              name: 'Hari Kumar',
              email: 'hari@example.test',
              changes: 2,
              lastError: 'SMTP 535 bad credentials',
              lastTriedAt: '2027-01-07T02:00:00Z',
            },
          ],
          queued: 0,
        },
      }),
      'POST /notifications/retry': () => ({ body: { requeued: 2 } }),
    });
    renderWithQuery(<DeploymentPage />);
    expect(await screen.findByText(/1 person didn.t get their duty email/)).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: /^Changes/ }));
    const panel = await screen.findByRole('region', { name: 'Emails not delivered' });
    expect(within(panel).getByText('SMTP 535 bad credentials')).toBeVisible();
    await userEvent.click(within(panel).getByRole('button', { name: 'Retry' }));
    expect(api.calls.find((c) => c.path === '/notifications/retry')?.body).toEqual({
      personId: id(2),
    });
  });
});
