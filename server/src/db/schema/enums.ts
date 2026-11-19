import { pgEnum } from 'drizzle-orm/pg-core';
import {
  AUTH_TOKEN_KINDS,
  COURSES,
  DUTY_CHANGE_KINDS,
  EMAIL_STATUSES,
  FOOTFALL_VARIANTS,
  GIFT_MOVEMENT_KINDS,
  RANKS,
  REG_CATEGORIES,
  STATION_KINDS,
} from '@spoh/shared';

// Postgres enums derived from the shared lists so the DB and the app never drift.
export const rankEnum = pgEnum('rank', RANKS);
export const courseEnum = pgEnum('course', COURSES);
export const stationKindEnum = pgEnum('station_kind', STATION_KINDS);
export const regCategoryEnum = pgEnum('reg_category', REG_CATEGORIES);
export const footfallVariantEnum = pgEnum('footfall_variant', FOOTFALL_VARIANTS);
export const giftMovementKindEnum = pgEnum('gift_movement_kind', GIFT_MOVEMENT_KINDS);
export const emailStatusEnum = pgEnum('email_status', EMAIL_STATUSES);
export const dutyChangeKindEnum = pgEnum('duty_change_kind', DUTY_CHANGE_KINDS);
export const authTokenKindEnum = pgEnum('auth_token_kind', AUTH_TOKEN_KINDS);
