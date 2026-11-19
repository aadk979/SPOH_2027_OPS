# SPOH 2027 Ops

The operations app for the **Singapore Polytechnic School of Computing Open House 2027**. It covers volunteer duties and changes, breaks, anonymous visitor registration and room counts, gift stock, a live coordinator dashboard, and post-event reports.

> **Two rules the whole codebase protects**
>
> 1. Registration counts and footfall counts are **never merged**. They're kept in separate tables, endpoints and report sections.
> 2. **No visitor personal data** is collected anywhere.

## Stack

| Part      | Tech                                                                                    |
| --------- | --------------------------------------------------------------------------------------- |
| `client/` | React 19 · Vite · Tailwind CSS 4 · TanStack Query · React Router                        |
| `server/` | Node 22 · Fastify 5 · Zod · Drizzle ORM · PostgreSQL 16                                 |
| `shared/` | Enums, permission tiers, time helpers and schemas shared by both                        |
| Tests     | Vitest (server tests run on in-memory PGlite, so no Docker is needed) · Testing Library |

## Quick start (local)

```bash
npm install                      # 1. install everything (npm workspaces)
npm run db:up                    # 2. start Postgres in Docker (port 55432)
cp server/.env.example server/.env
npm run dev                      # 3. API on :3000, client on :5173
```

Open http://localhost:5173. The server runs migrations and seeds the SPOH 2027 defaults on start.

## Everyday commands

| Command                      | What it does                                               |
| ---------------------------- | ---------------------------------------------------------- |
| `npm run check`              | Typecheck + lint + all tests (run before every commit)     |
| `npm test`                   | All tests                                                  |
| `npm run db:generate`        | Create a migration after changing `server/src/db/schema/*` |
| `npm run build`              | Production build of the server and client                  |
| `docker build -t spoh-ops .` | Build the deployable image                                 |

## Project layout

```
shared/src/         enums · labels · permissions · time (SGT)
server/src/
  app.ts            builds the Fastify app (no listen), registers modules under /api
  index.ts          entry: migrate → seed → listen
  config.ts         env vars, validated with Zod
  deps.ts           injected dependencies (db, clock, email) for testability
  db/schema/        one file per area: people, event, deployment, counts, gifts, system
  modules/<area>/   routes + service + tests for each feature
  plugins/          cross-cutting Fastify plugins (errors, auth)
server/drizzle/     generated SQL migrations (committed)
server/test/        test helpers (in-memory DB, fake clock)
client/src/
  components/ui/    design-system components (Clean Lab)
  pages/            one folder/file per screen
  lib/              api client, theme, helpers
docs/               setup, deployment, contingency and teardown guides
```

## Design & requirements

The full engineering record lives outside this repo: interviews, problem statement, SRS v1.0, use cases, architecture, data model, wireframes and the test plan. The parts needed for handover are summarised in `docs/`.

## Conventions

- **Small modules:** one feature per folder, files stay under ~300 lines (enforced by a lint warning).
- **Server is the source of truth for permissions.** Every route checks the user's tier.
- **Every tap is idempotent:** the client generates a `clientId`, and duplicates are ignored.
- **No date locks:** nothing checks the calendar before allowing an action, so you can test any day.
- **Times are Singapore time** (`shared/src/time.ts`).
- Never commit `.env`, roster CSVs or exports. `.gitignore` blocks them.

## Licence

MIT
