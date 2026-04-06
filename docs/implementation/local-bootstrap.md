# Local Bootstrap

## 1. Install dependencies

```bash
npm install
```

## 2. Create local environment

```bash
cp .env.example .env
```

- If you are using a Render Postgres instance from your laptop, use the **external** database URL in your local `.env`.
- Render service-to-database connections should use the **internal** database URL inside Render.
- A Render internal database hostname will not resolve from your local machine.

## 3. Start Postgres

```bash
docker compose up -d postgres
```

## 4. Generate Prisma client and push schema

```bash
npm --workspace @clinic-os/db run prisma:generate
npx prisma db push --schema packages/db/prisma/schema.prisma
```

## 5. Run the apps

```bash
npm run dev:api
npm run dev:web
npm run dev:worker
```

For a production-shaped local smoke using the current source runtime:

```bash
npm --workspace @clinic-os/api run start
npm --workspace @clinic-os/worker run start
```

- The API and worker `start` scripts run through `tsx`, which is the current pilot-safe runtime path for this repo.

## Same-origin local shape

- The browser now talks to the Next app on `http://localhost:3000`.
- The Next app proxies browser API requests through `/clinic-api/*`.
- The proxy forwards to `INTERNAL_API_BASE_URL`, which defaults locally to `http://127.0.0.1:4000`.
- `NEXT_PUBLIC_API_BASE_URL` is now only a legacy fallback for local proxy development, not a required production browser setting.

## Auth mode

- Local development should stay on:
  - `AUTH_MODE=dev_headers`
  - `NEXT_PUBLIC_AUTH_MODE=dev_headers`
- Pilot environments should move to:
  - `AUTH_MODE=device_profiles`
  - `NEXT_PUBLIC_AUTH_MODE=device_profiles`
  - a same-origin deployment for the web app and API so secure cookies stay on one site
- Bootstrap the first admin profile before enrolling any device:

```bash
npm --workspace @clinic-os/api run auth:bootstrap-admin -- --displayName "Pilot Admin" --role medical_director --pin 123456
```

- That command prints a one-time enrollment code. On the approved computer:
  - open the Clinic OS login screen
  - enter the enrollment code and a device label
  - sign in with the enrolled profile’s 6-digit PIN
- `device_profiles` mode ignores caller-supplied actor headers and resolves identity only from the trusted device cookie plus the active profile session cookie.
- `trusted_proxy` mode still exists as future infrastructure. If you choose to use it later, configure:
  - `AUTH_MODE=trusted_proxy`
  - `NEXT_PUBLIC_AUTH_MODE=trusted_proxy`
  - `TRUSTED_PROXY_SHARED_SECRET=<shared secret between proxy and API>`
  - `TRUSTED_PROXY_ALLOWED_SKEW_SECONDS=300`

## Microsoft integration mode

- Local development should stay on `MICROSOFT_INTEGRATION_MODE=stub`.
- Switch to `MICROSOFT_INTEGRATION_MODE=live` only after supplying:
  - tenant/client credentials
  - SharePoint site + policy folder
  - Lists site + issue/action/import list IDs
  - Planner plan + bucket IDs
  - Teams approvals + office-ops webhook URLs
  - a green result from `POST /integrations/microsoft/validate`

- Live Microsoft mode now uses:
  - Graph app credentials for SharePoint publication, Lists sync, and Planner sync
  - Teams webhooks for approval and office-ops notifications
- Teams webhook validation is config-only during preflight, so run a real smoke test after switching to `live`.
- SharePoint does not replace the application database. Postgres is still required as the system of record for workflows, audit history, queueing, auth, and operational state.

## Worker behavior

- The worker polls the database-backed outbox using `WORKER_BATCH_SIZE` and `WORKER_POLL_INTERVAL_MS`.
- Publish requests now return `publish_pending` first; the worker finalizes SharePoint publication and the workflow transition to `published`.

## Pilot cutover checklist

1. Keep `AUTH_MODE=dev_headers` and `MICROSOFT_INTEGRATION_MODE=stub` locally.
2. Deploy web and API in the Render-friendly same-origin layout documented in [render-pilot.md](/Users/gregorygabbert/Github/ClinicOS/docs/implementation/render-pilot.md) and switch to `AUTH_MODE=device_profiles`.
3. Bootstrap the first admin and enroll each approved pilot computer from the login screen.
4. Run `npm run smoke:render -- https://your-pilot-url.example.com`.
5. If you are using the now-validated Microsoft live setup, set `MICROSOFT_INTEGRATION_MODE=live` on the deployed services.
6. Run `POST /integrations/microsoft/validate` from the deployed app and then complete end-to-end smoke tests for SharePoint publish, Lists sync, Planner sync, and Teams delivery.
