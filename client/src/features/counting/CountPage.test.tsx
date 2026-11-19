import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderCountPage, useFakeCountingApi } from './counting.test-utils';
import { stationMemory } from './device';

describe('Count page', () => {
  const fake = useFakeCountingApi();

  it('asks for a station first and lists only stations that are counted', async () => {
    renderCountPage();
    expect(await screen.findByRole('heading', { name: 'Where are you counting?' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sign-Up Booth/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Counselling Room/ })).toBeVisible();
    expect(screen.queryByText('Bus Bay / Foyer')).not.toBeInTheDocument();
  });

  it('remembers the chosen station on this device and opens the right screen', async () => {
    const first = renderCountPage();
    await userEvent.click(await screen.findByRole('button', { name: /Sign-Up Booth/ }));
    expect(await screen.findByRole('button', { name: 'Sec 1' })).toBeVisible();
    expect(stationMemory.get()).toBe('s-booth');
    first.unmount();

    renderCountPage();
    expect(await screen.findByRole('heading', { name: 'Sign-Up Booth' })).toBeVisible();
  });

  it('switches station from the header, and each kind gets its own screen', async () => {
    stationMemory.set('s-booth');
    renderCountPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Change station' }));
    await userEvent.click(screen.getByRole('button', { name: /Welcome Lounge/ }));
    expect(await screen.findByRole('button', { name: 'Add one person' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Sec 1' })).not.toBeInTheDocument();
    expect(stationMemory.get()).toBe('s-lounge');
  });

  it('asks again when the remembered station no longer exists', async () => {
    stationMemory.set('s-deleted');
    renderCountPage();
    expect(await screen.findByRole('heading', { name: 'Where are you counting?' })).toBeVisible();
    expect(fake.api.calls.some((c) => c.path === '/stations')).toBe(true);
  });
});
