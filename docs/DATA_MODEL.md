# Data Model — SPOH 2027 Ops App

_Version 0.1 · 2026-11-19 · PostgreSQL 16 · ERD: `diagrams/erd.svg`_

**15 core tables** (NFR-M-6 target met) + 2 optional tables for the nice-to-haves.
Conventions: `id` = `uuid` PK (default `gen_random_uuid()`), timestamps are `timestamptz`, `created_at default now()`. Enums are Postgres enums mirrored in `shared/`.

## Enums

| Enum                 | Values                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `rank`               | `cc`, `deputy`, `shadow_ic`, `ic`, `volunteer`                                            |
| `course`             | `DAAA`, `DCDF`, `DCS`, `DCITP`, `Other`                                                   |
| `station_kind`       | `staffed`, `registration`, `counting`, `counselling` (counting with guided/walk-in split) |
| `reg_category`       | `sec1`, `sec2`, `sec3`, `sec4`, `sec5`, `graduated`, `parent`, `other`                    |
| `footfall_variant`   | `entry`, `guided`, `walk_in`                                                              |
| `gift_movement_kind` | `initial`, `redeem`, `restock`, `correct`, `transfer_in`, `transfer_out`                  |
| `email_status`       | `pending`, `sent`, `failed`, `skipped`                                                    |

## Tables

### 1. `person`

| Column            | Type                         | Notes                                                               |
| ----------------- | ---------------------------- | ------------------------------------------------------------------- |
| id                | uuid PK                      |                                                                     |
| name              | text not null                |                                                                     |
| email             | citext **unique** not null   | Login and import key                                                |
| phone             | text null                    | Visible only up the chain (NFR-S-2)                                 |
| course            | course null                  |                                                                     |
| rank              | rank not null                | → permission tier                                                   |
| team              | text null                    | One of the configured teams (null for CC / Shadow IC)               |
| portfolio         | text null                    | Deputy: their portfolio. Shadow IC: the portfolio shadowed, or `CC` |
| available_day_ids | uuid[] not null default '{}' | Availability per event day (FR-DUTY-1)                              |
| active            | boolean default true         | Deactivated people can't log in                                     |

### 2. `event_day`

| Column       | Type            | Notes                                        |
| ------------ | --------------- | -------------------------------------------- |
| id           | uuid PK         |                                              |
| date         | date **unique** |                                              |
| label        | text            | e.g. "Open House Day 1", "Discovery Evening" |
| report_time  | time            | One per day for all volunteers               |
| dismiss_time | time            |                                              |

### 3. `station`

| Column     | Type                 | Notes                                                                              |
| ---------- | -------------------- | ---------------------------------------------------------------------------------- |
| id         | uuid PK              |                                                                                    |
| name       | text unique          | e.g. "CoLab — DAAA"                                                                |
| location   | text                 | e.g. "AI & Analytics CoLab" (rolls footfall up per location, so no separate table) |
| room       | text                 | e.g. "T2131"                                                                       |
| kind       | station_kind         |                                                                                    |
| team       | text null            | Owning team → which IC may create gift points here                                 |
| capacity   | int null             | For busy/quiet. Null = no flag                                                     |
| sort_order | int                  | Display order                                                                      |
| active     | boolean default true |                                                                                    |

### 4. `assignment` — where a person is posted (history kept)

| Column                                                                                                                           | Type        | Notes                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| id                                                                                                                               | uuid PK     |                                                                                  |
| person_id                                                                                                                        | → person    |                                                                                  |
| day_id                                                                                                                           | → event_day |                                                                                  |
| station_id                                                                                                                       | → station   |                                                                                  |
| effective_from                                                                                                                   | timestamptz | Start of the day for the initial plan, or "now" / a chosen time for reassignment |
| created_by                                                                                                                       | → person    |                                                                                  |
| created_at                                                                                                                       | timestamptz |                                                                                  |
| Current post = the latest row per (person, day) with `effective_from ≤ now()`. Index `(day_id, person_id, effective_from desc)`. |

### 5. `break_period`

| Column                                                                                                            | Type        | Notes                       |
| ----------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------- |
| id                                                                                                                | uuid PK     |                             |
| person_id                                                                                                         | → person    |                             |
| day_id                                                                                                            | → event_day |                             |
| starts_at, ends_at                                                                                                | timestamptz | check `ends_at > starts_at` |
| label                                                                                                             | text null   | e.g. "Lunch"                |
| created_by                                                                                                        | → person    |                             |
| "Slots" in the UI = rows grouped by identical (day, start, end, label). Bulk editing a slot updates all its rows. |

### 6. `duty_change` — acknowledgement + email outbox

| Column          | Type                           | Notes                                                     |
| --------------- | ------------------------------ | --------------------------------------------------------- |
| id              | uuid PK                        |                                                           |
| person_id       | → person                       |                                                           |
| day_id          | → event_day null               |                                                           |
| kind            | text                           | `assignment`, `break`, `timing`                           |
| summary         | text                           | Human-readable "CoLab DAAA → Counselling Room from 13:00" |
| created_by      | → person                       |                                                           |
| created_at      | timestamptz                    |                                                           |
| acknowledged_at | timestamptz null               | FR-DUTY-7. Used for latency metrics                       |
| email_status    | email_status default 'pending' | D4                                                        |
| email_attempts  | int default 0                  |                                                           |
| emailed_at      | timestamptz null               |                                                           |

### 7. `registration` — **anonymous** visitor categories (rule 2)

| Column                             | Type            | Notes                           |
| ---------------------------------- | --------------- | ------------------------------- |
| id                                 | bigserial PK    |                                 |
| client_id                          | uuid **unique** | Idempotency (D3)                |
| station_id                         | → station       |                                 |
| category                           | reg_category    |                                 |
| group_id                           | uuid null       | Family/group                    |
| recorded_by                        | → person        |                                 |
| device_id                          | text            | Random ID stored in the browser |
| recorded_at                        | timestamptz     |                                 |
| voided_at / voided_by              | null            | Admin void (soft)               |
| Index `(station_id, recorded_at)`. |

### 8. `footfall` — kept separate from registration (rule 1)

Same shape as `registration`, except `variant footfall_variant` instead of `category`, plus `count int default 1` for **+n** groups and `course course null` (optional counselling tag, FR-FOOT-4).

### 9. `gift_point`

| Column                                                                                                        | Type             | Notes |
| ------------------------------------------------------------------------------------------------------------- | ---------------- | ----- |
| id                                                                                                            | uuid PK          |       |
| station_id                                                                                                    | → station        |       |
| gift_name                                                                                                     | text             |       |
| created_by                                                                                                    | → person         |       |
| created_at                                                                                                    | timestamptz      |       |
| closed_at                                                                                                     | timestamptz null |       |
| Stock is derived, not stored: `remaining = Σ movements`. Low-stock base = `initial + restocks + transfer_in`. |

### 10. `gift_movement` — append-only ledger

| Column                                                                                                                              | Type               | Notes                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------- |
| id                                                                                                                                  | bigserial PK       |                                  |
| client_id                                                                                                                           | uuid unique null   | Idempotent redeems               |
| gift_point_id                                                                                                                       | → gift_point       |                                  |
| kind                                                                                                                                | gift_movement_kind |                                  |
| qty                                                                                                                                 | int                | Signed: redeem −n, restock +n, … |
| reason                                                                                                                              | text null          | Required for `correct`           |
| related_gift_point_id                                                                                                               | uuid null          | For transfers                    |
| recorded_by, recorded_at                                                                                                            |                    |                                  |
| A redeem inserts inside a transaction that locks the gift point and checks `remaining ≥ n`, so stock is never negative (FR-GIFT-2). |

### 11. `auth_token` — login codes **and** sessions

| Column          | Type             | Notes                                    |
| --------------- | ---------------- | ---------------------------------------- |
| id              | uuid PK          |                                          |
| person_id       | → person         |                                          |
| kind            | text             | `code` or `session`                      |
| token_hash      | text unique      | SHA-256 of the code/token                |
| expires_at      | timestamptz      | Code: +15 min. Session: 23:59 SGT        |
| used_at         | timestamptz null | Code consumed                            |
| failed_attempts | int default 0    | Lockout (FR-AUTH-4)                      |
| issued_by       | → person null    | Set when an Admin issues a manual code   |
| created_at      | timestamptz      | Sessions kept → login metrics (FR-RPT-5) |

### 12. `audit_log`

`id bigserial`, `actor_id → person null`, `action text` (e.g. `roster.commit`, `counts.reset`, `assignment.create`), `target text`, `details jsonb`, `at timestamptz`.

### 13. `survey_response`

`id`, `person_id → person null` (null when anonymous), `helped smallint 1–5`, `most_useful text`, `most_annoying text`, `submitted_at`. Unique `(person_id)` when not null. To keep anonymous answers single-use, the person's `survey_done` is recorded in `audit_log` instead of being linked to the answer.

### 14. `cost_item`

`id`, `date`, `description`, `amount_sgd numeric(10,2)`, `created_by`.

### 15. `app_config` — single row

`id = 1`, `busy_window_min int default 30`, `busy_pct int default 80`, `quiet_pct int default 20`, `low_stock_pct int default 10`, `email_batch_min int default 2`, `survey_open boolean default false`, `teams text[]`, `portfolios text[]`, `success_targets jsonb`.

### Optional (nice-to-haves)

- 16. `attendance_checkin` — `person_id`, `day_id`, `checked_in_at`. Unique (person, day).
- 17. `lost_found_item` — `description`, `found_at_station_id`, `found_at`, `status` (`held`/`returned`), `returned_to_first_name`, `logged_by`.

## Seed data (FR-CFG-7)

- **Event days:** 6, 7, 8, 9 Jan 2027 (times blank until the CC sets them).
- **Teams:** Welcome Party, Sign-Up Booth, Welcome Lounge, Guides, Room Ushers, Relief, Visitor Tracking, Student Facilitators DAAA/DCDF/DCS, Course Counselling, Gift Redemption, Welfare, Safety, Communications.
- **Portfolios:** the 5 Deputy portfolios.
- **Stations:**

| Station              | Location             | Room     | Kind         | Team                      |
| -------------------- | -------------------- | -------- | ------------ | ------------------------- |
| Bus Bay / Foyer      | T19 Bus Bay          | —        | staffed      | Welcome Party             |
| Sign-Up Booth        | T19 Level 3          | —        | registration | Sign-Up Booth             |
| Welcome Lounge       | Welcome Lounge       | T2036    | counting     | Welcome Lounge            |
| Cyber Wargame Centre | Cyber Wargame Centre | T2034    | counting     | Student Facilitators DCDF |
| CoLab — DAAA         | AI & Analytics CoLab | T2131    | counting     | Student Facilitators DAAA |
| CoLab — DCS          | AI & Analytics CoLab | T2132    | counting     | Student Facilitators DCS  |
| Counselling Room     | Counselling Room     | T2135A/B | counselling  | Course Counselling        |
| School Talk          | LT18A                | LT18A    | counting     | Room Ushers               |
| Floating / Relief    | —                    | —        | staffed      | Relief                    |

## Rules enforced by the database

- `registration` and `footfall` are separate tables. No view or report ever sums them together (rule 1).
- No table has any column for visitor identity (rule 2).
- Unique `client_id` → no double counts (NFR-R-1).
- Stations with any records are **deactivated, never deleted** (FK `ON DELETE RESTRICT` from registration/footfall/gift_point).
- Deleting an `event_day` (after the FR-CFG-5a confirmation) cascades to its `assignment`, `break_period` and `duty_change` rows. Counts are not linked to days, only to timestamps, so they are always kept.
