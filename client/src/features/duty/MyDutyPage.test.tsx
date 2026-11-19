import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MyDutyResponse } from '@spoh/shared';
import { mockApi } from '../../test/mockApi';
import { renderWithQuery } from '../../test/renderWithQuery';
import { MyDutyPage } from './MyDutyPage';

const THU = '00000000-0000-4000-8000-000000000007';
const FRI = '00000000-0000-4000-8000-000000000008';
const CHANGE = '00000000-0000-4000-8000-0000000000c1';

function duty(pending: MyDutyResponse['pending']): MyDutyResponse {
  const station = {
    id: '00000000-0000-4000-8000-0000000000aa',
    name: 'Welcome Lounge',
    room: 'T2036',
  };
  return {
    team: 'Room Ushers',
    icNames: ['Casey Ong'],
    defaultDayId: THU,
    todayDayId: THU,
    pending,
    days: [
      {
        day: {
          id: THU,
          date: '2027-01-07',
          label: 'Open House Day 1',
          reportTime: '09:00',
          dismissTime: '18:00',
        },
        available: true,
        station,
        later: [
          { from: '13:00', station: { ...station, name: 'Counselling Room', room: 'T2135A/B' } },
        ],
        breaks: [{ start: '12:00', end: '12:45', label: 'Lunch' }],
      },
      {
        day: { id: FRI, date: '2027-01-08', label: '', reportTime: null, dismissTime: null },
        available: false,
        station: null,
        later: [],
        breaks: [],
      },
    ],
  };
}

describe('My Duty', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows today's station, IC, times, break, and days not rostered (FR-DUTY-5)", async () => {
    mockApi({ 'GET /duty/me': () => ({ body: duty([]) }) });
    renderWithQuery(<MyDutyPage />);
    expect(await screen.findByTestId('duty-station')).toHaveTextContent('Welcome Lounge');
    expect(screen.getByText('From 13:00 → Counselling Room')).toBeVisible();
    expect(screen.getByText('Casey Ong')).toBeVisible();
    expect(screen.getByText('09:00')).toBeVisible();
    expect(screen.getByText('12:00–12:45')).toBeVisible();
    expect(screen.getByText('Not rostered: Fri 8 Jan')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument();
  });

  it('highlights a change and Got it acknowledges it (FR-DUTY-7)', async () => {
    let pending: MyDutyResponse['pending'] = [
      {
        id: CHANGE,
        kind: 'assignment',
        summary: 'Thu 7 Jan: CoLab — DAAA → Welcome Lounge from 13:00',
        createdAt: '2027-01-07T04:41:00Z',
        createdBy: 'Dana Deputy',
      },
    ];
    const api = mockApi({
      'GET /duty/me': () => ({ body: duty(pending) }),
      'POST /duty/ack': () => {
        pending = [];
        return { body: { acknowledged: 1 } };
      },
    });
    renderWithQuery(<MyDutyPage />);
    const banner = await screen.findByRole('region', { name: 'Your duty changed' });
    expect(within(banner).getByText(/CoLab — DAAA → Welcome Lounge/)).toBeVisible();
    expect(within(banner).getByText('Changed by Dana Deputy · 12:41')).toBeVisible();

    await userEvent.click(within(banner).getByRole('button', { name: 'Got it' }));
    expect(api.calls.find((c) => c.path === '/duty/ack')?.body).toEqual({ ids: [CHANGE] });
    await vi.waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Your duty changed' })).not.toBeInTheDocument(),
    );
  });

  it('can look at another day', async () => {
    mockApi({ 'GET /duty/me': () => ({ body: duty([]) }) });
    renderWithQuery(<MyDutyPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Fri 8 Jan' }));
    expect(screen.getByText('You are not rostered on this day.')).toBeVisible();
    expect(screen.getAllByText('TBC')).toHaveLength(2);
  });
});
