import type { CounsellingCourse, FootfallVariant, StationDto } from '@spoh/shared';
import { getDeviceId, newId } from './device';
import {
  applyFootfall,
  footfallQueue,
  footfallSummaryKey,
  pendingByVariant,
  undoFootfall,
  useFootfallSummary,
} from './footfallApi';
import { useCountCapture } from './useCountCapture';

/** Footfall capture for one station: summary, taps, and per-variant totals incl. pending. */
export function useFootfallCapture(station: StationDto) {
  const summary = useFootfallSummary(station.id);
  const capture = useCountCapture({
    queue: footfallQueue,
    stationId: station.id,
    summaryKey: footfallSummaryKey,
    apply: applyFootfall,
    undo: undoFootfall,
  });

  const add = (
    variant: FootfallVariant,
    count: number,
    label: string,
    course: CounsellingCourse | null = null,
  ) => {
    const clientId = newId();
    capture.record({
      id: clientId,
      payload: {
        stationId: station.id,
        deviceId: getDeviceId(),
        records: [{ clientId, variant, count, course }],
      },
      people: count,
      label,
    });
  };

  const pending = pendingByVariant(capture.pending.map((j) => j.payload));
  const waiting = capture.pending.reduce((n, j) => n + j.people, 0);
  const data = summary.data;
  const totals = data && {
    total: data.total + waiting,
    device: data.device + waiting,
    entry: data.byVariant.entry + pending.entry,
    guided: data.byVariant.guided + pending.guided,
    walk_in: data.byVariant.walk_in + pending.walk_in,
  };

  return { summary, capture, add, totals };
}
