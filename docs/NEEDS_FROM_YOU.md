# Needs From You

These are the remaining items I still need from you before Clinic OS can move from single-device/live-readiness into a broader real-user pilot.

## What is already in place

Using the current local `.env` and repo code:

- the external `DATABASE_URL` is reachable from this machine
- Prisma client generation succeeds
- the Prisma schema is pushed to Postgres successfully
- the database connection sanity check succeeds
- Local Microsoft live validation is green:
  - SharePoint: ready
  - Planner: ready
  - Teams webhooks: ready
  - Issue list: ready
  - Action item list: ready
  - Import status list: ready
- the API `readyz` check reports:
  - `databaseReady: true`
  - `readyForLive: true`
  - `pilotUsable: true`
- the worker code can start locally and process live jobs against the real database

That means the remaining pilot blockers are now mostly broader pilot validation, Render deployment consistency, and operations hardening.

## Current rollout checkpoint

- The local repo is healthy and connected to the external Postgres database.
- The database currently has:
  - `1` user profile
  - `1` enrolled device
  - `1` active session
- The first admin bootstrap has completed and the first approved device has been enrolled successfully.
- The current public Render smoke check against the configured `PUBLIC_APP_ORIGIN` is green:
  - web `healthz`: `200`
  - web `readyz`: `200`
  - proxied API `healthz`: `200`
- The deployed app is reachable end to end and first-device enrollment succeeded.
- The deployed auth state endpoint reports:
  - `authMode: device_profiles`
  - `needsEnrollment: true`
  - `deviceIssue: not_enrolled`
- A real admin device is enrolled and can log in successfully.
- A broader synthetic role-validation pass has now also been run against the live pilot:
  - office manager device flow: validated
  - quality lead device flow: validated
  - HR lead device flow: validated
  - temporary validation auth fixtures were revoked/deactivated after the run

## What the latest live validation found

The codebase and local env are healthy, but the deployed Render environment is no longer perfectly aligned with the locally validated Microsoft setup.

- Local Microsoft preflight is `ready`.
- Deployed Microsoft validation is currently `degraded`.
- The current deployed failure is SharePoint publication path reachability:
  - SharePoint policy folder returns `404 itemNotFound` from the deployed API
- The broader live smoke harness also showed that queued jobs were not draining on their own during validation, which points to Render worker/service operations rather than a code-path failure.
- A one-off local worker run against the same live DB was able to process queued jobs successfully, so the worker logic itself is still good.

## What I still need from you next

1. Real broader approved pilot device rollout
   - one label per computer/device
   - primary profile for that device
   - up to two backup profiles if needed

2. Real named pilot profiles for breadth validation
   - office manager
   - quality lead
   - HR lead
   - optional CFO if you want approvals and finance review exercised more broadly

3. Render deployment alignment check
   - compare the Render API and worker values for:
     - `MICROSOFT_SHAREPOINT_SITE_ID`
     - `MICROSOFT_SHAREPOINT_POLICY_FOLDER`
   - confirm they exactly match the working local `.env`
   - redeploy API and worker after correcting any mismatch

4. Render worker health check
   - confirm the worker service is actually running continuously on Render
   - inspect the Render worker logs for why live queued jobs were not draining during validation
   - after any fix, rerun:
     - `npm run smoke:pilot-live -- https://...`
     - `npm run validate:pilot-roles -- https://...`

5. A decision on whether to keep the optional trusted-proxy path documented as a later hardening phase
   - it is still not required for the first pilot
   - it can remain a future infrastructure path if desired

## Database rule

Postgres is still required even though Microsoft is now ready, because Clinic OS stores its system-of-record state in Postgres and uses Microsoft 365 as connected publication and operations surfaces.

- On Render services, use the **internal** Render Postgres URL for `DATABASE_URL`
- On your laptop or any machine outside Render, use the **external** Postgres URL

## The next command I am waiting to run

The next step is to realign the Render Microsoft/worker deployment and then rerun:

- `npm run smoke:pilot-live -- https://...`
- `npm run validate:pilot-roles -- https://...`

After that, the remaining step is real human pilot rollout on the approved office manager, quality lead, and HR lead devices.
