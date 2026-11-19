/**
 * Event-day helpers shared by the server and the client. Dates are SGT calendar dates
 * (YYYY-MM-DD). Nothing here is tied to the real event dates (C-7).
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "2027-01-07" → "Thu 7 Jan". */
export function formatDayShort(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * The day a screen should open on: today if it is an event day, otherwise the next
 * upcoming day, otherwise the last one. Works on any date, so the app can be tested
 * weeks before the event (C-7).
 */
export function pickDefaultDay<T extends { date: string }>(days: readonly T[], today: string) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return (
    sorted.find((d) => d.date === today) ??
    sorted.find((d) => d.date > today) ??
    sorted[sorted.length - 1] ??
    null
  );
}

/** "HH:MM" 24-hour time, as used for report/dismiss times and "from" times. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
