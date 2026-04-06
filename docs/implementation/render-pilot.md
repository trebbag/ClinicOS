# Render pilot deployment

Clinic OS is now prepared for a **same-origin Render deployment** that keeps the browser on one public URL and proxies all browser API traffic through `/clinic-api/*`.

## Recommended topology

- `clinic-os-web`: public Render web service
- `clinic-os-api`: private Render service
- `clinic-os-worker`: private Render worker
- `clinic-os-db`: Render Postgres

## Required runtime shape

- `AUTH_MODE=device_profiles`
- `NEXT_PUBLIC_AUTH_MODE=device_profiles`
- `MICROSOFT_INTEGRATION_MODE=live` for a Microsoft-backed pilot
- `PUBLIC_APP_ORIGIN=https://<your-final-pilot-url>`
- `INTERNAL_API_BASE_URL=<Render private host:port or full http:// URL>`
- a real `DATABASE_URL` from Render Postgres

The browser should only open the public app URL. It should never call the API directly on a separate origin.

Even with SharePoint, Lists, Planner, and Teams configured, Clinic OS still requires Postgres because it remains the system of record for:
- device enrollment and sessions
- workflow runs and transitions
- document drafts and approval state
- audit logs
- worker jobs and retries
- scorecards, training, and office-ops records

## Database URL rule

- On Render services, use the **internal** Render Postgres URL for `DATABASE_URL`.
- On your laptop or any machine outside Render, use the **external** Postgres URL.
- Do not use a Render internal hostname in a local `.env` if you expect local Prisma commands or local API startup to work.

## Deployment flow

1. Create the Render database.
2. Create the private API and worker services.
3. Create the public web service.
4. Set `PUBLIC_APP_ORIGIN` on both the web and API services.
5. Set `INTERNAL_API_BASE_URL` on the web service to the API service's exact `Connect > Internal` address.
   - If you are syncing from `render.yaml`, the Blueprint now wires this automatically from the API service `hostport`.
   - Do not guess the host or port.
   - Do not use `:10000` manually unless Render explicitly shows that exact value for the API service.
6. Set the Microsoft env vars on API and worker, and keep `MICROSOFT_INTEGRATION_MODE=live`.
7. Bootstrap the first admin:

```bash
npm --workspace @clinic-os/api run auth:bootstrap-admin -- --displayName "Pilot Admin" --role medical_director --pin 123456
```

8. Enroll each approved pilot computer from the login screen.

## Runtime note

- The web service still runs from the Next production build.
- The API and worker `start` scripts now run their TypeScript source entrypoints through `tsx`.
- This avoids the current workspace-package ESM build mismatch while keeping the pilot runtime and local smoke path consistent with the checked-in code.
- The web proxy accepts either a full `http://...` internal API URL or a raw Render `host:port` value and normalizes it automatically.

## Smoke test

After deployment, run:

```bash
npm run smoke:render -- https://your-pilot-url.example.com
```

That script checks:
- public web health
- public web readiness
- same-origin proxy access to API health

For the deeper live pilot check, use:

```bash
npm run smoke:pilot-live -- https://your-pilot-url.example.com
```

That command is documented in [pilot-ops-runbook.md](/Users/gregorygabbert/Github/ClinicOS/docs/implementation/pilot-ops-runbook.md) and can now exercise:
- live auth and device enrollment
- Lists sync
- Planner sync
- Teams notification delivery
- optional document publish when both office-manager and medical-director profiles are available on the test device

## First-pilot recommendation

Use:
- `AUTH_MODE=device_profiles`
- `MICROSOFT_INTEGRATION_MODE=live` once your Render database and same-origin deployment are in place

Your tenant validation is already green, so the remaining blockers are deployment, database, and device enrollment rather than Microsoft setup.
