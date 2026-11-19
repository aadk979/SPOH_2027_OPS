/**
 * Per-browser identity for counting. The device ID is random and anonymous: it only powers
 * "this device today" (FR-REG-4). The chosen station is remembered per device (FR-FOOT-1),
 * because shared laptops count for a station, not for a person (stakeholder decision T4).
 */

const DEVICE_KEY = 'spoh.deviceId';
const STATION_KEY = 'spoh.countStationId';

/** RFC 4122 v4 UUID. Falls back to getRandomValues where randomUUID is unavailable (plain http). */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

let sessionDeviceId: string | null = null;

export function getDeviceId(): string {
  const stored = read(DEVICE_KEY);
  if (stored) return stored;
  sessionDeviceId ??= newId();
  write(DEVICE_KEY, sessionDeviceId);
  return sessionDeviceId;
}

export const stationMemory = {
  get: () => read(STATION_KEY),
  set: (stationId: string | null) => write(STATION_KEY, stationId),
};
