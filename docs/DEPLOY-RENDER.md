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

## First sign-in

Until email is set up (below), `EMAIL_PROVIDER` is unset (`console`) and sign-in codes are
written to the log instead of sent. Open the address, enter the CC email, then open the
service's **Logs** tab and look for the 6-digit code. Admins can also give people codes
from the People page.

## Email (Gmail now, swappable later)

Email goes through Nodemailer (SMTP), so any provider works by changing settings only.
For Gmail:

1. On the Gmail account: turn on 2-Step Verification, then create an **app password**
   (Google Account → Security → App passwords). Copy the 16 characters.
2. Render → the web service → **Environment** → add:

   | Key              | Value                               |
   | ---------------- | ----------------------------------- |
   | `EMAIL_PROVIDER` | `smtp`                              |
   | `SMTP_HOST`      | `smtp.gmail.com`                    |
   | `SMTP_PORT`      | `465`                               |
   | `SMTP_SECURE`    | `true`                              |
   | `SMTP_USER`      | the Gmail address                   |
   | `SMTP_PASS`      | the app password                    |
   | `EMAIL_FROM`     | `SPOH 2027 Ops <the Gmail address>` |

3. **Save, rebuild and deploy**. The log shows `Email provider ready` with `provider: smtp`.

Gmail allows about 500 emails a day. Duty emails are batched (one per person per
2 minutes). To switch provider later (Brevo or SendGrid SMTP, or `resend` with
`RESEND_API_KEY`), change these values and redeploy. Failed emails are retried 3 times,
then listed for Admins under Deployment → Changes.

## Updates

Every push to `main` deploys automatically.

## Limits of the free plan

- The service sleeps after 15 minutes idle; the first visit after that takes ~1 minute.
- The free database expires 30 days after it is created. Before the event, upgrade the
  web service and database to paid plans (Starter + Basic) so neither sleeps nor expires.
