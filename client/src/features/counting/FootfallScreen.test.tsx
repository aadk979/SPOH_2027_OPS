import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderCountPage, useFakeCountingApi } from './counting.test-utils';
import { stationMemory } from './device';

describe('Footfall screens', () => {
  const fake = useFakeCountingApi();

  it('FR-FOOT-1: +1 five times and +3 counts 8 people at the chosen room', async () => {
    stationMemory.set('s-lounge');
    renderCountPage();
    // FR-FOOT-6: the station being counted is always on screen.
    expect(await screen.findByRole('heading', { name: 'Welcome Lounge' })).toBeVisible();
    expect(screen.getByText('T2036')).toBeVisible();
    await waitFor(() => expect(screen.getByTestId('station-total')).toHaveTextContent('0'));

    for (let i = 0; i < 5; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Add one person' }));
    }
    await userEvent.click(screen.getByRole('button', { name: 'Add 3 people' }));
    await waitFor(() => expect(screen.getByTestId('station-total')).toHaveTextContent('8'));
    await waitFor(() => expect(fake.api.footfall).toHaveLength(6));
    expect(fake.api.footfall.map((r) => r.count)).toEqual([1, 1, 1, 1, 1, 3]);
    expect(fake.api.footfall.every((r) => r.variant === 'entry' && r.course === null)).toBe(true);
  });

  it('+n asks for the group size', async () => {
    stationMemory.set('s-lounge');
    renderCountPage();
    await userEvent.click(await screen.findByRole('button', { name: '+n' }));
    await userEvent.type(screen.getByLabelText('How many people in the group?'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Add 12' }));
    expect(await screen.findByText('✓ Saved: +12')).toBeVisible();
    expect(fake.api.footfall[0]!.count).toBe(12);
  });

  it('FR-FOOT-3/4: counselling splits guided and walk-in; the course tag is optional', async () => {
    stationMemory.set('s-counsel');
    renderCountPage();
    await screen.findByRole('heading', { name: 'Counselling Room' });
    await waitFor(() => expect(screen.getByTestId('guided-total')).toHaveTextContent('0'));

    await userEvent.click(screen.getByRole('button', { name: '+ Guided group member' }));
    await userEvent.click(screen.getByRole('button', { name: 'DAAA' }));
    expect(screen.getByRole('button', { name: 'DAAA' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '+ Walk-in (counselling only)' }));
    // The tag applied to that tap only.
    expect(screen.getByRole('button', { name: 'DAAA' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: '+ Walk-in (counselling only)' }));

    await waitFor(() => expect(screen.getByTestId('walkin-total')).toHaveTextContent('2'));
    expect(screen.getByTestId('guided-total')).toHaveTextContent('1');
    await waitFor(() => expect(fake.api.footfall).toHaveLength(3));
    expect(fake.api.footfall.map((r) => [r.variant, r.course])).toEqual([
      ['guided', null],
      ['walk_in', 'DAAA'],
      ['walk_in', null],
    ]);
  });

  it('Undo removes a +n tap as one record', async () => {
    stationMemory.set('s-lounge');
    renderCountPage();
    await waitFor(() => expect(screen.getByTestId('station-total')).toHaveTextContent('0'));
    await userEvent.click(screen.getByRole('button', { name: 'Add 4 people' }));
    await screen.findByText('✓ Saved: +4');
    await userEvent.click(screen.getByRole('button', { name: /^Undo/ }));
    await waitFor(() => expect(screen.getByTestId('station-total')).toHaveTextContent('0'));
    expect(fake.api.writes('/footfall').map((c) => c.method)).toEqual(['POST', 'DELETE']);
  });
});
