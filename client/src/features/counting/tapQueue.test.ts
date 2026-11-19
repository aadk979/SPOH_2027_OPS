import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { defaultRetryDelay, isRetryable, TapQueue } from './tapQueue';

const job = (id: string, people = 1) => ({
  id,
  stationId: 'st-1',
  payload: { id },
  people,
  label: `tap ${id}`,
});

const networkDown = () => new ApiError(0, 'NETWORK', 'No connection. Retrying…');

describe('TapQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a tap, reports it saved, and offers it for undo', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const queue = new TapQueue({ send });
    const saved = vi.fn();
    queue.onSaved(saved);
    queue.add(job('a', 4));
    expect(queue.getSnapshot().jobs).toHaveLength(1);
    await vi.runAllTimersAsync();
    expect(send).toHaveBeenCalledWith({ id: 'a' });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot().jobs).toHaveLength(0);
    expect(queue.getSnapshot().lastSaved?.job.people).toBe(4);
  });

  it('FR-REG-7: retries a failed tap with the same payload until it lands', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(networkDown())
      .mockRejectedValueOnce(new ApiError(503, 'HTTP_ERROR', 'down'))
      .mockResolvedValueOnce(undefined);
    const queue = new TapQueue({ send });
    queue.add(job('a'));
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.getSnapshot().jobs[0]).toMatchObject({ state: 'waiting', attempts: 1 });
    await vi.advanceTimersByTimeAsync(1000); // retry 1 after 1 s
    expect(queue.getSnapshot().jobs[0]).toMatchObject({ state: 'waiting', attempts: 2 });
    await vi.advanceTimersByTimeAsync(2000); // retry 2 after 2 s
    expect(queue.getSnapshot().jobs).toHaveLength(0);
    expect(send).toHaveBeenCalledTimes(3);
    expect(new Set(send.mock.calls.map((c) => c[0]))).toEqual(new Set([{ id: 'a' }]));
  });

  it('stops retrying when the user cancels', async () => {
    const send = vi.fn().mockRejectedValue(networkDown());
    const queue = new TapQueue({ send });
    queue.add(job('a'));
    queue.add(job('b'));
    await vi.advanceTimersByTimeAsync(0);
    queue.cancelAll();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot().jobs).toHaveLength(0);
    expect(queue.getSnapshot().lastSaved).toBeNull();
  });

  it('does not retry errors a retry cannot fix, and shows the message', async () => {
    const send = vi
      .fn()
      .mockRejectedValue(new ApiError(400, 'BAD_REQUEST', 'School Talk is closed.'));
    const queue = new TapQueue({ send });
    queue.add(job('a'));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot().jobs[0]).toMatchObject({
      state: 'failed',
      error: 'School Talk is closed.',
    });
  });

  it('keeps a job in the queue until saved-listeners finish (no dip in the count)', async () => {
    const queue = new TapQueue({ send: vi.fn().mockResolvedValue(undefined) });
    let jobsDuringListener = -1;
    queue.onSaved(async () => {
      jobsDuringListener = queue.getSnapshot().jobs.length;
    });
    queue.add(job('a'));
    await vi.runAllTimersAsync();
    expect(jobsDuringListener).toBe(1);
    expect(queue.getSnapshot().jobs).toHaveLength(0);
  });

  it('uses the time the successful attempt was sent to start the undo countdown', async () => {
    let now = 1_000;
    const send = vi.fn().mockRejectedValueOnce(networkDown()).mockResolvedValueOnce(undefined);
    const queue = new TapQueue({ send, now: () => now, retryDelayMs: () => 500 });
    queue.add(job('a'));
    await vi.advanceTimersByTimeAsync(0);
    now = 1_500;
    await vi.advanceTimersByTimeAsync(500);
    expect(queue.getSnapshot().lastSaved?.sentAt).toBe(1_500);
  });
});

describe('retry rules', () => {
  it('backs off 1, 2, 4 then 5 s', () => {
    expect([1, 2, 3, 4, 9].map(defaultRetryDelay)).toEqual([1000, 2000, 4000, 5000, 5000]);
  });

  it('retries network, timeout, rate-limit and server errors only', () => {
    expect(isRetryable(new ApiError(0, 'NETWORK', ''))).toBe(true);
    expect(isRetryable(new ApiError(429, 'X', ''))).toBe(true);
    expect(isRetryable(new ApiError(500, 'X', ''))).toBe(true);
    expect(isRetryable(new ApiError(400, 'X', ''))).toBe(false);
    expect(isRetryable(new ApiError(401, 'X', ''))).toBe(false);
    expect(isRetryable(new ApiError(403, 'X', ''))).toBe(false);
  });
});
