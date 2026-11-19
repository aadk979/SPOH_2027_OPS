import { ApiError } from '../../lib/api';

/**
 * Delivers taps to the server and never silently loses or doubles one (FR-REG-7, NFR-R-1).
 *
 * Each job carries client-generated IDs, so re-sending it after a network failure is safe:
 * the server stores each ID once. Network and server errors retry with back-off until the
 * job lands or the user cancels; other errors (e.g. a closed station) stop and are shown.
 * Framework-free so the retry rules are unit-tested without React.
 */

export type JobState = 'sending' | 'waiting' | 'failed';

export interface TapJob<P> {
  /** The first record's clientId: also the key used to undo this tap. */
  id: string;
  stationId: string;
  payload: P;
  /** People this tap adds (1 for a single tap, n for "+n" or a family). */
  people: number;
  /** Shown in the undo toast, e.g. "Sec 4" or "+3". */
  label: string;
  createdAt: number;
  attempts: number;
  state: JobState;
  error?: string;
}

/** A tap the server confirmed; `sentAt` starts the undo countdown. */
export interface SavedTap<P> {
  job: TapJob<P>;
  sentAt: number;
}

export interface QueueSnapshot<P> {
  jobs: readonly TapJob<P>[];
  lastSaved: SavedTap<P> | null;
}

export interface TapQueueOptions<P> {
  send: (payload: P) => Promise<unknown>;
  now?: () => number;
  retryDelayMs?: (attempt: number) => number;
}

/** 1 s, 2 s, 4 s, then every 5 s. */
export const defaultRetryDelay = (attempt: number) => Math.min(1000 * 2 ** (attempt - 1), 5000);

/** Worth retrying: no connection, timeouts, rate limits and server errors. */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500;
}

function failureMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401)
    return 'Your session has ended. Sign in again.';
  if (err instanceof Error && err.message) return err.message;
  return 'Not saved.';
}

type SavedListener<P> = (saved: SavedTap<P>) => void | Promise<void>;

export class TapQueue<P> {
  private snapshot: QueueSnapshot<P> = { jobs: [], lastSaved: null };
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly listeners = new Set<() => void>();
  private readonly savedListeners = new Set<SavedListener<P>>();
  private readonly now: () => number;
  private readonly retryDelayMs: (attempt: number) => number;

  constructor(private readonly options: TapQueueOptions<P>) {
    this.now = options.now ?? Date.now;
    this.retryDelayMs = options.retryDelayMs ?? defaultRetryDelay;
  }

  getSnapshot = (): QueueSnapshot<P> => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Runs (and is awaited) before a saved job leaves the queue, so counts never dip. */
  onSaved(listener: SavedListener<P>): () => void {
    this.savedListeners.add(listener);
    return () => this.savedListeners.delete(listener);
  }

  add(job: Pick<TapJob<P>, 'id' | 'stationId' | 'payload' | 'people' | 'label'>): void {
    const full: TapJob<P> = { ...job, createdAt: this.now(), attempts: 0, state: 'sending' };
    this.update({ jobs: [...this.snapshot.jobs, full] });
    void this.attempt(job.id);
  }

  /** Stop retrying a job (the user chose to give up on it). */
  cancel(id: string): void {
    this.clearTimer(id);
    this.update({ jobs: this.snapshot.jobs.filter((j) => j.id !== id) });
  }

  cancelAll(): void {
    for (const job of this.snapshot.jobs) this.clearTimer(job.id);
    this.update({ jobs: [] });
  }

  clearLastSaved(): void {
    if (this.snapshot.lastSaved) this.update({ lastSaved: null });
  }

  private find(id: string) {
    return this.snapshot.jobs.find((j) => j.id === id);
  }

  private patch(id: string, changes: Partial<TapJob<P>>) {
    this.update({ jobs: this.snapshot.jobs.map((j) => (j.id === id ? { ...j, ...changes } : j)) });
  }

  private async attempt(id: string): Promise<void> {
    this.timers.delete(id);
    const job = this.find(id);
    if (!job) return;
    const attempts = job.attempts + 1;
    this.patch(id, { state: 'sending', attempts });
    const sentAt = this.now();
    try {
      await this.options.send(job.payload);
    } catch (err) {
      if (!this.find(id)) return; // cancelled meanwhile
      if (isRetryable(err)) {
        this.patch(id, { state: 'waiting', error: failureMessage(err) });
        this.timers.set(
          id,
          setTimeout(() => void this.attempt(id), this.retryDelayMs(attempts)),
        );
      } else {
        this.patch(id, { state: 'failed', error: failureMessage(err) });
      }
      return;
    }
    // Saved. Even if the user cancelled while it was in flight, the server has it: say so.
    const saved: SavedTap<P> = { job: { ...job, attempts }, sentAt };
    await Promise.all([...this.savedListeners].map((l) => l(saved)));
    this.update({ jobs: this.snapshot.jobs.filter((j) => j.id !== id), lastSaved: saved });
  }

  private clearTimer(id: string) {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
  }

  private update(changes: Partial<QueueSnapshot<P>>) {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const l of this.listeners) l();
  }
}
