# Needs From You

These are the remaining items I still need from you before Clinic OS can move from local readiness into a real pilot rollout.

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

That means the remaining pilot blockers are now mostly deployment and enrollment inputs, not missing product code or missing Microsoft configuration.

## Current rollout checkpoint

- The local repo is healthy and connected to the external Postgres database.
- The database currently has:
  - `0` user profiles
  - `0` enrolled devices
  - `0` active sessions
- That means the first admin bootstrap and device enrollment have not happened yet.
- The current public Render smoke check against the configured `PUBLIC_APP_ORIGIN` is still failing with web `500` responses, so the deployed web service needs a fresh redeploy using the latest code before pilot enrollment can begin.

## What I still need from you next

1. The final same-origin pilot URL on Render
   - Example: `https://clinic-os.example.com`
   - I will use this as `PUBLIC_APP_ORIGIN`

2. The private/internal API base URL used by the public web service
   - Use the exact internal address Render shows for the API service under `Connect > Internal`
   - Example shape: `http://<render-internal-hostname>:<render-private-port>`
   - I will use this as `INTERNAL_API_BASE_URL`

3. The first admin bootstrap details
   - display name
   - role
   - 6-digit PIN

   I need these so I can run:

   ```bash
   npm --workspace @clinic-os/api run auth:bootstrap-admin -- --displayName "Pilot Admin" --role medical_director --pin 123456
   ```

4. The approved pilot device list
   - one label per computer/device
   - primary profile for that device
   - up to two backup profiles if needed

5. The final deployment decision for the first pilot
   - `AUTH_MODE=device_profiles`
   - `NEXT_PUBLIC_AUTH_MODE=device_profiles`
   - `MICROSOFT_INTEGRATION_MODE=live`

6. Whether you want me to keep the optional trusted-proxy path documented for a later hardening phase
   - It is no longer required for the first pilot
   - I can keep it documented as a future infrastructure path if you want

## Database rule

Postgres is still required even though Microsoft is now ready, because Clinic OS stores its system-of-record state in Postgres and uses Microsoft 365 as connected publication and operations surfaces.

- On Render services, use the **internal** Render Postgres URL for `DATABASE_URL`
- On your laptop or any machine outside Render, use the **external** Postgres URL

## The next command I am waiting to run

Once you give me the first admin details, I can immediately run the bootstrap command and generate the enrollment code for the first approved pilot computer.
