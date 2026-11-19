/**
 * Time helpers. Singapore has no daylight saving, so SGT is always UTC+08:00.
 * All business logic (sessions ending at midnight, "today", event days) uses SGT.
 */

export const SGT_OFFSET_MINUTES = 8 * 60;
const MS_PER_MINUTE = 60_000;

function shiftToSgt(instant: Date): Date {
  return new Date(instant.getTime() + SGT_OFFSET_MINUTES * MS_PER_MINUTE);
}

/** The calendar date in Singapore for an instant, as YYYY-MM-DD. */
export function sgtDateString(instant: Date): string {
  return shiftToSgt(instant).toISOString().slice(0, 10);
}

/** Format an instant as HH:MM in Singapore time. */
export function sgtTimeString(instant: Date): string {
  return shiftToSgt(instant).toISOString().slice(11, 16);
}

/** Combine a Singapore date (YYYY-MM-DD) and time (HH:MM or HH:MM:SS) into an instant. */
export function sgtInstant(date: string, time: string): Date {
  const hms = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${hms}+08:00`);
}

/** The instant of 23:59:59.999 SGT on the same Singapore calendar day as `instant`. */
export function endOfSgtDay(instant: Date): Date {
  return sgtInstant(sgtDateString(instant), '23:59:59.999');
}

/** The half-open range [00:00 SGT, next 00:00 SGT) of the Singapore day containing `instant`. */
export function sgtDayBounds(instant: Date): { date: string; start: Date; end: Date } {
  const date = sgtDateString(instant);
  const start = sgtInstant(date, '00:00');
  return { date, start, end: new Date(start.getTime() + 24 * 60 * MS_PER_MINUTE) };
}
