# Needs From You

These are the remaining items I still need from you before Clinic OS moves from current pilot-ready state into broader day-to-day use and deeper product expansion.

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
- The `admin` profile is now configured as a multi-role account and can act as all current product roles from one enrolled device/session.

## What the latest live validation found

The deployed Render stack is now healthy and pilot-usable, but there is still one worker-operations concern to keep watching.

- The deployed Render smoke check is green:
  - web `healthz`: `200`
  - web `readyz`: `200`
  - proxied API `healthz`: `200`
- The live pilot smoke harness succeeded against the deployed app for:
  - device enrollment + profile login
  - SharePoint-backed document publish path
  - Planner/list-triggering workflow actions
- The broader synthetic role-validation pass also succeeded for:
  - office manager flow
  - quality lead flow
  - HR lead flow
- A fresh deployed Microsoft validation run is now `ready` again:
  - SharePoint policy folder: ready
  - Planner: ready
  - Teams webhooks: ready
  - Issue list: ready
  - Action item list: ready
  - Import status list: ready
- The Render worker is processing jobs during live validation, but it is still worth checking its steady-state behavior:
  - the queue dropped during validation, but it settled at `2` fresh `lists.action-item.upsert` jobs tied to office-ops maintenance actions
  - that may be expected maintenance churn, or it may point to a Render worker/runtime issue that still needs inspection

## What is now effectively closed

1. Broader named-role validation is no longer a pilot blocker.
   - The `admin` profile can now switch among all current roles from the same enrolled account.
   - That means office manager, quality lead, HR lead, CFO, and other role-specific flows can be exercised without waiting for separate user setup.

2. Additional real pilot users can be registered later.
   - Separate named profiles are still recommended for real-world accountability and adoption.
   - They are no longer required before continuing pilot validation.

3. The Render worker exists and is reported healthy.
   - The remaining queue behavior is now a monitor-and-observe concern rather than a launch blocker.
   - If queue depth starts growing or jobs stop draining, inspect the worker logs and rerun the live smoke commands.

## What I still need from you next

1. A decision on whether to keep the optional trusted-proxy path documented as a later hardening phase
   - it is still not required for the first pilot
   - it can remain a future infrastructure path if desired

2. Optional later real-user rollout details
   - one label per additional computer/device
   - primary profile for that device
   - up to two backup profiles if needed
   - named office manager / quality lead / HR lead profiles when you want them added

## Database rule

Postgres is still required even though Microsoft is now ready, because Clinic OS stores its system-of-record state in Postgres and uses Microsoft 365 as connected publication and operations surfaces.

- On Render services, use the **internal** Render Postgres URL for `DATABASE_URL`
- On your laptop or any machine outside Render, use the **external** Postgres URL

## The next command I am waiting to run

The next step is no longer additional named-role setup. The next major engineering step after this pilot hardening phase is the first missing major domain slice:

- incident + CAPA parity
