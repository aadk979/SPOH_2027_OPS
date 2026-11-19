import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import type { SavedTap, TapJob, TapQueue } from './tapQueue';

/** Re-read the server total this long after the last save, to pick up other devices' taps. */
const REFRESH_AFTER_SAVE_MS = 1_500;

export interface CaptureOptions<P, S> {
  queue: TapQueue<P>;
  stationId: string;
  summaryKey: (stationId: string) => QueryKey;
  /** Adds (1) or removes (-1) a saved tap from the cached summary. */
  apply: (summary: S, payload: P, sign: 1 | -1) => S;
  undo: (clientId: string) => Promise<unknown>;
}

export interface Capture<P> {
  record: (job: Pick<TapJob<P>, 'id' | 'payload' | 'people' | 'label'>) => void;
  /** Taps at this station not yet confirmed by the server (still retrying). */
  pending: TapJob<P>[];
  /** Taps that a retry cannot fix (e.g. the station was closed). */
  failed: TapJob<P>[];
  lastSaved: SavedTap<P> | null;
  undoLast: () => void;
  undoing: boolean;
  undoError: string | null;
  dismissSaved: () => void;
  cancelPending: () => void;
  dismissFailed: (id: string) => void;
}

/**
 * Glue between a TapQueue and the summary shown on screen. Saved taps update the cached
 * summary at once (optimistic, then reconciled by polling); pending taps are added on top.
 * Used by each counting screen with its own queue, key and endpoint: never shared (Rule 1).
 */
export function useCountCapture<P, S>(options: CaptureOptions<P, S>): Capture<P> {
  const { queue, stationId, summaryKey, apply, undo } = options;
  const queryClient = useQueryClient();
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the latest callbacks without re-subscribing on every render.
  const latest = useRef({ summaryKey, apply });
  latest.current = { summaryKey, apply };

  useEffect(() => {
    const off = queue.onSaved(async ({ job }) => {
      const key = latest.current.summaryKey(job.stationId);
      // Drop any in-flight poll that started before this save, then add the tap.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<S>(key, (old) =>
        old === undefined ? old : latest.current.apply(old, job.payload, 1),
      );
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: key }),
        REFRESH_AFTER_SAVE_MS,
      );
    });
    return () => {
      off();
      clearTimeout(refreshTimer.current);
    };
  }, [queue, queryClient]);

  const here = snapshot.jobs.filter((j) => j.stationId === stationId);
  const lastSaved = snapshot.lastSaved?.job.stationId === stationId ? snapshot.lastSaved : null;

  const undoLast = () => {
    if (!lastSaved || undoing) return;
    setUndoing(true);
    setUndoError(null);
    const key = summaryKey(stationId);
    undo(lastSaved.job.id)
      .then(async () => {
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<S>(key, (old) =>
          old === undefined ? old : apply(old, lastSaved.job.payload, -1),
        );
      })
      .catch((err: unknown) => {
        // 404: already gone (e.g. undone twice). Anything else: tell the user why.
        if (err instanceof ApiError && err.status === 404) return;
        setUndoError(err instanceof Error ? err.message : 'Could not undo.');
        void queryClient.invalidateQueries({ queryKey: key });
      })
      .finally(() => {
        setUndoing(false);
        queue.clearLastSaved();
      });
  };

  return {
    record: (job) => {
      setUndoError(null);
      queue.add({ ...job, stationId });
    },
    pending: here.filter((j) => j.state !== 'failed'),
    failed: here.filter((j) => j.state === 'failed'),
    lastSaved,
    undoLast,
    undoing,
    undoError,
    dismissSaved: () => queue.clearLastSaved(),
    cancelPending: () => here.forEach((j) => j.state !== 'failed' && queue.cancel(j.id)),
    dismissFailed: (id) => queue.cancel(id),
  };
}
