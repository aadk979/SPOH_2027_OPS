import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Meter } from './Meter';
import { StatusPill } from './StatusPill';

describe('Button', () => {
  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Got it</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('StatusPill', () => {
  it('always includes a status word, not just colour (accessibility)', () => {
    render(<StatusPill status="busy">Counselling</StatusPill>);
    expect(screen.getByText('BUSY')).toBeInTheDocument();
    expect(screen.getByText('· Counselling')).toBeInTheDocument();
  });
});

describe('Meter', () => {
  it('clamps values to 0–100', () => {
    render(<Meter percent={140} label="Room" />);
    expect(screen.getByRole('meter', { name: 'Room' })).toHaveAttribute('aria-valuenow', '100');
  });
});
