# Deploy to Render (Singapore)

`render.yaml` describes everything: one Docker web service that serves the API and the
client, and one Postgres database. Migrations and default settings run on every start.

## First deploy (about 10 minutes)

1. Sign up at render.com with **GitHub**. Allow Render to read the `SPOH_2027_OPS` repo
   (only that repo is fine).
2. **New → Blueprint**, pick the repo and branch `main`. Render reads `render.yaml`.
3. When asked for `BOOTSTRAP_CC_EMAIL`, enter the CC's email. This is the only person who
   can sign in before a roster exists.
4. **Apply**. The first build takes 5–10 minutes. The address appears at the top of the
   service page, e.g. `https://spoh-2027-ops.onrender.com`.

## First sign-in (until email is set up in S4)

Email is in `console` mode, so sign-in codes are written to the log instead of sent.
Open the address, enter the CC email, then open the service's **Logs** tab and look for
the 6-digit code. After that, the CC can give other people codes from the People page.

## Updates

Every push to `main` deploys automatically.

## Limits of the free plan

- The service sleeps after 15 minutes idle; the first visit after that takes ~1 minute.
- The free database expires 30 days after it is created. Before the event, upgrade the
  web service and database to paid plans (Starter + Basic) so neither sleeps nor expires.
