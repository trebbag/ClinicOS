# Needs From You

These are the remaining items I still need from you before Clinic OS can move from first-device/live-readiness into broader pilot validation.

## What is already in place

Using the current local `.env` and repo code:

- the external `DATABASE_URL` is reachable from this machine
- Prisma client generation succeeds
- the Prisma schema is pushed to Postgres successfully
- the database connection sanity check succeeds
- Microsoft live validation is green:
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
- the worker can start and complete an idle batch against the real database

That means the remaining pilot blockers are now mostly broader pilot validation and operations hardening, not missing Microsoft configuration or missing core product code.

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
- The deployed app is now reachable end to end and ready for first-device enrollment.
- The deployed auth state endpoint reports:
  - `authMode: device_profiles`
  - `needsEnrollment: true`
  - `deviceIssue: not_enrolled`
- The next product step is enrolling the first approved device.
- The deployed API now reports:
  - `integrationMode: live`
  - `publicationMode: sharepoint_live`
  - `configComplete: true`
  - `readyForLive: true`
- The Render deployment is now aligned with the validated local/live Microsoft configuration.
- A real live smoke pass has now been run against the production database and Microsoft tenant.
- These live surfaces succeeded:
  - SharePoint approved-document publish
  - Planner task creation
  - SharePoint Lists sync for issues, action items, and import status
  - Teams approval reminder delivery
  - Teams office-ops notification delivery
- The previously failed list-sync jobs were retried after the required columns were added and all retries succeeded.
- There are currently no failed or dead-letter worker jobs left from the live smoke pass.

## What I still need from you next

1. The broader approved pilot device list
   - one label per computer/device
   - primary profile for that device
   - up to two backup profiles if needed

2. Additional real pilot profiles for breadth validation
   - office manager
   - quality lead
   - HR lead
   - optional CFO if you want approvals and finance review exercised more broadly

3. A decision on whether to keep the new live smoke artifacts in place or clean them up after each validation pass
   - the repo now has cleanup tooling for auth/session/job maintenance
   - tenant-owned smoke artifacts for documents, lists, planner tasks, and notifications still require operator intent

4. Whether you want the optional trusted-proxy path kept documented as a later hardening phase
   - it is still not required for the first pilot
   - it can remain a future infrastructure path if desired

## Database rule

Postgres is still required even though Microsoft is now ready, because Clinic OS stores its system-of-record state in Postgres and uses Microsoft 365 as connected publication and operations surfaces.

- On Render services, use the **internal** Render Postgres URL for `DATABASE_URL`
- On your laptop or any machine outside Render, use the **external** Postgres URL

## The next command I am waiting to run

The next step is broader pilot use on the enrolled device, enrolling additional approved pilot devices, and using the new `npm run smoke:pilot-live -- https://...` path plus Pilot Ops cleanup/runbook steps for repeatable validation.
