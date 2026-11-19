# Architecture — SPOH 2027 Ops App

_Version 0.1 · 2026-11-19 · Implements SRS v1.0 · Diagrams: `diagrams/architecture.svg`, `diagrams/erd.svg`_

## 1. Guiding principles

1. **Boring and small.** One server process, one database, one static client. No queues, caches, microservices, policy engines or multi-tenancy.
2. **Portable.** One Docker image plus env vars runs on Render, Lightsail or any VPS (C-2).
3. **Correct counts first.** Every tap is idempotent. Registration and footfall live in separate tables (rule 1).
4. **Server is the source of truth for permissions.** The client only hides buttons for convenience.

## 2. System context

```
 Volunteers / ICs / Admins (phones & laptops, browser)
                │  HTTPS
                ▼
 ┌──────────────────────────┐        ┌──────────────────────────┐
 │ Client (static SPA)      │  API   │ Server (Fastify, Node 22)│
 │ React + Vite + Tailwind  │ ─────► │ REST/JSON, Bearer token  │
 │ Firebase Hosting *or*    │ HTTPS  │ Docker on Render SG /    │
 │ served by the server     │        │ Lightsail SG / VPS       │
 └──────────────────────────┘        └────────────┬─────────────┘
                                                  │ SQL (DATABASE_URL)
                                     ┌────────────▼─────────────┐
                                     │ PostgreSQL 16 (Singapore)│
                                     └──────────────────────────┘
                                                  │
                                     ┌────────────▼─────────────┐
                                     │ Email provider (adapter) │
                                     │ SMTP / HTTP API / console│
                                     └──────────────────────────┘
```

## 3. Technology choices

| Concern      | Choice                                                                                 | Why                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Language     | TypeScript (strict) everywhere                                                         | C-5, shared types                                                                    |
| Server       | **Fastify 5** + `fastify-type-provider-zod`                                            | User's choice. Fast, small, schema validation built in                               |
| Validation   | **Zod** schemas in `shared/`                                                           | One definition shared by client forms and server routes                              |
| DB access    | **Drizzle ORM** + `drizzle-kit` migrations                                             | Thin, SQL-like, typed, no code generation step or engine binary (unlike v1's Prisma) |
| Database     | PostgreSQL 16                                                                          | Reliable, on every host, unique constraints for idempotency                          |
| Client       | **React 19 + Vite + Tailwind 4**, React Router, TanStack Query                         | User's choice. TanStack Query handles polling, retries and caching                   |
| Charts       | Chart.js (client)                                                                      | Used for the dashboard and the printable PDF report                                  |
| Excel export | `exceljs` (server)                                                                     | One workbook, one sheet per dataset                                                  |
| PDF report   | Print-optimised report page in the client → browser "Save as PDF" (one-click button)   | No headless Chrome on the server. Charts render exactly as on screen                 |
| Email        | `EmailSender` interface. Adapters: `smtp` (nodemailer), `resend` (HTTP API), `console` | C-4. Swap via `EMAIL_PROVIDER` env                                                   |
| Tests        | Vitest (unit + API against a real Postgres), Playwright for 3–4 smoke flows            | Critical paths only (NFR-M-3)                                                        |
| Container    | Single multi-stage Dockerfile                                                          | C-2                                                                                  |

## 4. Key design decisions

### D1. Auth: email code → opaque bearer token (not cookies)

- Firebase Hosting (`*.web.app`) and Render (`*.onrender.com`) are different sites. Safari and Chrome block cross-site cookies, so **cookies would break** in the most likely hosting setup.
- Login: `POST /auth/request {email}` → emails code + magic link. `POST /auth/verify {email, code}` → returns a random 256-bit token. The server stores only its SHA-256 hash, with an expiry of 23:59 SGT that day.
- The client stores the token in `localStorage` and sends `Authorization: Bearer …`. No CSRF exposure. XSS risk is mitigated by a strict Content-Security-Policy, React escaping and no third-party scripts.
- The magic link opens `/login#code=…&email=…`. The fragment never reaches server logs.

### D2. Live updates: polling, not WebSockets

- The dashboard, My Duty and counters refetch every **10 s** through TanStack Query, and again when the window regains focus.
- Load: ~150 users × 1 request per 10 s ≈ 15 requests/s, which is trivial. No sticky sessions or socket infrastructure, and it works through every proxy and host.

### D3. Idempotent taps

- Each tap is generated on the client with a UUID (`client_id`). The insert uses `ON CONFLICT (client_id) DO NOTHING`. Retries can never double count (FR-REG-5/6, NFR-R-1).
- A family is one request with n rows sharing a `group_id`.
- Undo = `DELETE … WHERE client_id = ? AND created_at > now() - 10 s AND user_id = ?`. Later removals are an Admin "void" (soft delete + audit).

### D4. Email outbox inside `duty_change`

- A duty change writes a `duty_change` row (`email_status = pending`). An in-process timer runs every 30 s and finds people whose oldest pending change is ≥ 2 min old. It sends **one** email per person covering all their pending changes, and marks them `sent` (or retries 3× → `failed`, shown to Admins).
- Login codes are sent immediately (synchronously).
- One server instance only, so no distributed locking is needed. A `FOR UPDATE SKIP LOCKED` query makes it safe even if a second instance ever runs.

### D5. Time

- All timestamps are stored as `timestamptz`. All business logic and display use **Asia/Singapore**.
- No feature checks the calendar date before allowing an action (C-7). Event days only drive defaults, such as today's duty, report ranges and the CSV template.

### D6. Permissions

Small, explicit checks in route handlers, no framework:

```ts
requireTier('admin'); // CC, Deputy, Shadow IC
requireCC(); // import, reset, wipe
requireStationIC(stationId); // IC of this station's team, or admin
requireWelfareOrAdmin();
```

Tier comes from `person.rank`: CC→cc, Deputy/Shadow IC→admin, IC→ic, Volunteer→volunteer. The Welfare IC is the IC whose team = Welfare.

### D7. Busy/quiet calculation

`entries(station, last N min) / capacity`. Busy if > 80%, quiet if < 20%. N, the thresholds and the low-stock % live in `app_config`. Computed in SQL on each dashboard request (cheap at this scale).

### D8. "Volunteers per station now"

For each person rostered today, the effective assignment is the latest `assignment` row with `effective_from ≤ now`. "On break" = a `break_period` covering now. Computed per request.

## 5. Repository layout

```
spoh2027-ops/
├─ client/                 React SPA
│  └─ src/{pages,components,api,lib}
├─ server/
│  ├─ src/{routes,services,db,email,jobs,auth}
│  └─ drizzle/             migrations
├─ shared/                 zod schemas, enums, types
├─ docs/                   engineering docs (this folder moves here) + guides
│  ├─ SETUP.md  DEPLOY-render-firebase.md  DEPLOY-lightsail.md  DEPLOY-vps-duckdns.md
│  ├─ CONTINGENCY.md  TEARDOWN.md
├─ Dockerfile  docker-compose.yml (local Postgres)  .env.example
└─ README.md
```

## 6. API outline (REST, JSON, all under `/api`)

| Area         | Endpoints                                                                                                                                                                | Tier                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Auth         | `POST /auth/request`, `POST /auth/verify`, `POST /auth/logout`, `GET /me`, `POST /auth/issue-code/:personId`                                                             | public / admin         |
| My Duty      | `GET /me/duty?day=`, `POST /me/ack/:changeId`, `POST /me/survey`                                                                                                         | volunteer              |
| Registration | `POST /registrations` (1..n rows), `DELETE /registrations/:clientId` (undo), `GET /registrations/summary?station=&day=`                                                  | volunteer              |
| Footfall     | `POST /footfall`, `DELETE /footfall/:clientId`, `GET /footfall/summary`                                                                                                  | volunteer              |
| Gifts        | `GET /gift-points`, `POST /gift-points`, `POST /gift-points/:id/redeem`, `POST /gift-points/:id/adjust`, `POST /gift-points/:id/transfer`, `POST /gift-points/:id/close` | volunteer / station-IC |
| Team         | `GET /team`                                                                                                                                                              | ic                     |
| Deployment   | `GET /people`, `POST /assignments` (bulk), `GET /duty-changes?unacked=1`                                                                                                 | admin                  |
| Breaks       | `GET/POST/PATCH/DELETE /breaks` (bulk by people/team/station)                                                                                                            | welfare / admin        |
| Dashboard    | `GET /dashboard?day=`                                                                                                                                                    | admin                  |
| Config       | `GET/POST/PATCH/DELETE /days`, `/stations`, `PATCH /config`                                                                                                              | admin                  |
| Roster       | `GET /roster/template.csv`, `POST /roster/preview`, `POST /roster/commit`                                                                                                | cc                     |
| Danger       | `POST /danger/reset-counts`, `POST /danger/wipe-all`                                                                                                                     | cc                     |
| Reports      | `GET /reports/workbook.xlsx?from=&to=`, `GET /reports/summary?from=&to=` (JSON for the print page), `GET/POST /costs`, `PATCH /survey/state`                             | admin                  |
| Audit        | `GET /audit`                                                                                                                                                             | admin                  |
| Health       | `GET /health`                                                                                                                                                            | public                 |

## 7. Configuration (env vars)

`DATABASE_URL`, `APP_ORIGIN` (CORS allow-list), `PUBLIC_APP_URL` (for email links), `EMAIL_PROVIDER` (`console|smtp|resend`), `SMTP_HOST/PORT/USER/PASS/FROM` or `RESEND_API_KEY`/`EMAIL_FROM`, `SERVE_CLIENT` (`true` → the server also serves the built SPA, for the single-server/DuckDNS setup), `TZ=Asia/Singapore`, `BOOTSTRAP_CC_EMAIL` (first login before any roster exists).

## 8. Deployment topologies (same image)

| Option          | Client                                 | Server + DB                                                                         | Notes                                                                  |
| --------------- | -------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **A (default)** | Firebase Hosting                       | Render web service (Singapore) + Render Postgres or external managed PG (Singapore) | Use a paid instance from Dry Run #2 to the end of the event (no sleep) |
| B               | Firebase Hosting                       | AWS Lightsail container/VM (ap-southeast-1) + Lightsail PG or PG in Docker          | If SP approves                                                         |
| C               | Served by server (`SERVE_CLIENT=true`) | One VM + Docker Compose + Caddy (auto-HTTPS) + DuckDNS                              | Cheapest single box                                                    |

## 9. Security checklist

HTTPS only · CORS restricted to `APP_ORIGIN` · tokens hashed at rest · rate limits on `/auth/*` (per IP and per email) · Zod validation on every input · contact fields filtered by tier in the serializer (NFR-S-2) · CSP + Helmet headers · audit log for admin and danger actions · no visitor PII anywhere · CSV import size limit (1 MB) and formula-injection escaping in exports.

## 10. Risks & mitigations

| Risk                                               | Mitigation                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Emails land in iChat spam                          | Test with real iChat inboxes by M3. Brief volunteers to whitelist the sender. Admin manual-code fallback (FR-AUTH-5) |
| Render free instance sleeps or the free DB expires | Paid instance + durable DB from ~Dry Run #2. Health-check ping before the event day starts                           |
| Outlook SMTP needs OAuth2                          | Adapter interface. Decide the mailbox by ~1 Dec                                                                      |
| App outage on the day                              | `CONTINGENCY.md`: clickers + paper sheet. Counts entered afterwards by an Admin via "+n with note"                   |
| Scope creep                                        | SRS baseline + change log                                                                                            |
