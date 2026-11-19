import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderCountPage, useFakeCountingApi } from './counting.test-utils';
import { stationMemory } from './device';

interface RegBody {
  stationId: string;
  deviceId: string;
  groupId: string | null;
  records: { clientId: string; category: string }[];
}

describe('Registration screen', () => {
  const fake = useFakeCountingApi();
  const open = async () => {
    stationMemory.set('s-booth');
    renderCountPage();
    await screen.findByRole('heading', { name: 'Sign-Up Booth' });
    await waitFor(() => expect(screen.getByTestId('station-total')).toHaveTextContent('0'));
  };

  it('FR-REG-1: one tap saves one anonymous visitor and updates both totals', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Sec 4' }));
    expect(await screen.findByText('✓ Saved: Sec 4')).toBeInTheDocument();
    expect(screen.getByTestId('station-total')).toHaveTextContent('1');
    expect(screen.getByTestId('device-total')).toHaveTextContent('1');

    const [post] = fake.api.writes('/registrations');
    const body = post!.body as RegBody;
    expect(body).toMatchObject({ stationId: 's-booth', groupId: null });
    expect(body.records).toEqual([{ clientId: expect.any(String), category: 'sec4' }]);
    expect(body.deviceId).toBe(localStorage.getItem('spoh.deviceId'));
    // Rule 2: nothing about the visitor is sent.
    expect(Object.keys(body.records[0]!).sort()).toEqual(['category', 'clientId']);
  });

  it('FR-REG-2: a family of 4 is sent as 4 records sharing one group ID', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'A family arriving together' }));
    await userEvent.click(screen.getByRole('button', { name: 'One more Sec 4' }));
    await userEvent.click(screen.getByRole('button', { name: 'One more Parent / Guardian' }));
    await userEvent.click(screen.getByRole('button', { name: 'One more Parent / Guardian' }));
    await userEvent.click(screen.getByRole('button', { name: 'One more Other' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm (4 people)' }));

    expect(await screen.findByText('✓ Saved: family of 4')).toBeInTheDocument();
    expect(screen.getByTestId('station-total')).toHaveTextContent('4');
    const body = fake.api.writes('/registrations')[0]!.body as RegBody;
    expect(body.groupId).toEqual(expect.any(String));
    expect(body.records.map((r) => r.category)).toEqual(['sec4', 'parent', 'parent', 'other']);
    expect(new Set(body.records.map((r) => r.clientId)).size).toBe(4);
  });

  it('FR-REG-3: Undo removes the last tap (the whole family for a family)', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Sec 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'A family arriving together' }));
    await userEvent.click(screen.getByRole('button', { name: 'One more Sec 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'One more Sec 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm (2 people)' }));
    await screen.findByText('✓ Saved: family of 2');
    expect(screen.getByTestId('station-total')).toHaveTextContent('3');

    await userEvent.click(screen.getByRole('button', { name: /^Undo/ }));
    await waitFor(() => expect(screen.getByTestId('station-total')).toHaveTextContent('1'));
    expect(screen.queryByText(/Saved:/)).not.toBeInTheDocument();
    expect(fake.api.registrations.map((r) => r.category)).toEqual(['sec1']);
  });

  it('FR-REG-7: shows "Not saved, retrying…" and retries with the same IDs until saved', async () => {
    await open();
    fake.api.failNextWrites(2); // fails at 0 s and 1 s, succeeds at 3 s
    await userEvent.click(screen.getByRole('button', { name: 'Sec 5' }));
    // Counted on screen straight away, even before the server confirms.
    expect(screen.getByTestId('station-total')).toHaveTextContent('1');
    expect(await screen.findByText(/Not saved, retrying/, {}, { timeout: 3000 })).toBeVisible();
    expect(await screen.findByText('✓ Saved: Sec 5', {}, { timeout: 4000 })).toBeVisible();
    expect(screen.queryByText(/Not saved/)).not.toBeInTheDocument();

    const ids = fake.api
      .writes('/registrations')
      .map((c) => (c.body as RegBody).records[0]!.clientId);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(1);
    expect(fake.api.registrations).toHaveLength(1);
    expect(screen.getByTestId('station-total')).toHaveTextContent('1');
  }, 10_000);

  it('Cancel stops retrying and takes the tap off the count', async () => {
    await open();
    fake.api.failNextWrites(100);
    await userEvent.click(screen.getByRole('button', { name: 'Sec 2' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }, { timeout: 3000 }));
    expect(screen.getByTestId('station-total')).toHaveTextContent('0');
    expect(screen.queryByText(/Not saved/)).not.toBeInTheDocument();
  }, 10_000);
});
