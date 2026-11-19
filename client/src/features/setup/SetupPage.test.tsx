import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventDayDto } from '@spoh/shared';
import { mockApi } from '../../test/mockApi';
import { renderWithQuery } from '../../test/renderWithQuery';
import { SetupPage } from './SetupPage';

const THU = '00000000-0000-4000-8000-000000000007';

function setup() {
  let days: EventDayDto[] = [
    {
      id: THU,
      date: '2027-01-07',
      label: 'Open House Day 1',
      reportTime: '09:00',
      dismissTime: '18:00',
    },
  ];
  const api = mockApi({
    'GET /days': () => ({ body: { days } }),
    'POST /days': (body) => {
      const created = {
        id: '00000000-0000-4000-8000-000000000010',
        reportTime: null,
        dismissTime: null,
        ...(body as object),
      } as EventDayDto;
      days = [...days, created];
      return { status: 201, body: created };
    },
    [`PATCH /days/${THU}`]: (body) => {
      days = [{ ...days[0]!, ...(body as object) }];
      return { body: days[0] };
    },
    [`GET /days/${THU}/impact`]: () => ({
      body: {
        assignments: 12,
        breaks: 3,
        dutyChanges: 12,
        availablePeople: 40,
        registrationsKept: 5,
        footfallKept: 9,
      },
    }),
    [`DELETE /days/${THU}`]: () => {
      days = [];
      return { body: {} };
    },
  });
  return api;
}

describe('Setup: event days', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adds a day (FR-CFG-5)', async () => {
    const api = setup();
    renderWithQuery(<SetupPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add day' }));
    const form = screen.getByRole('form', { name: 'Add day' });
    await userEvent.type(within(form).getByLabelText('Date'), '2027-01-10');
    await userEvent.type(within(form).getByLabelText('Label'), 'Extra day');
    await userEvent.click(within(form).getByRole('button', { name: 'Save day' }));
    expect(await screen.findByText('Sun 10 Jan')).toBeVisible();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      date: '2027-01-10',
      label: 'Extra day',
      reportTime: null,
      dismissTime: null,
    });
  });

  it('warns that changing times asks people to acknowledge (FR-CFG-5b)', async () => {
    setup();
    renderWithQuery(<SetupPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit day' });
    const report = within(form).getByLabelText('Report time');
    await userEvent.clear(report);
    await userEvent.type(report, '08:30');
    expect(within(form).getByText(/will be asked to tap "Got it"/)).toBeVisible();
  });

  it('shows what removing a day affects before removing it (FR-CFG-5a)', async () => {
    const api = setup();
    renderWithQuery(<SetupPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(await screen.findByText(/12 posts, 3 breaks and 12 duty changes/)).toBeVisible();
    expect(screen.getByText(/Kept: 5 registrations and 9 room entries/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Remove day' }));
    expect(await screen.findByText(/No event days yet/)).toBeVisible();
    expect(api.calls.find((c) => c.method === 'DELETE')?.url.search).toBe('?confirm=true');
  });
});
