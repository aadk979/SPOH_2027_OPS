import type { Config } from './config.js';
import type { Db } from './db/client.js';

/** Source of "now". Injected so tests can control time (undo windows, sessions, batching). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/**
 * Everything a module needs from the outside world. Passed into buildApp() so each
 * module is testable with fakes (in-memory DB, fixed clock, captured emails).
 * Later slices extend this with the email sender.
 */
export interface AppDeps {
  config: Config;
  db: Db;
  clock: Clock;
}
