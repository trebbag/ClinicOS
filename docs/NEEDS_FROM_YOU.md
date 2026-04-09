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
- the first incident + CAPA parity slice is now implemented in the repo
  - incident register endpoints and quality UI
  - CAPA lifecycle endpoints and quality UI
  - linked workflow/action-item/audit behavior
  - optional Microsoft List sync hooks for incident and CAPA registers when those list IDs are provided
- the public asset + claims review slice is now implemented in the repo
  - public asset inventory endpoints and dedicated UI
  - explicit structured claim records and claims-review commands
  - linked `public_facing` document approvals and controlled publication path
  - approved archive visibility through the same SharePoint-backed publish pipeline
- the committee + QAPI slice is now implemented in the repo
  - committee registry and recommended committee bootstrap
  - committee meeting scheduling and QAPI snapshot generation
  - packet generation through the existing document/workflow engine
  - explicit approval routing for committee packets
  - committee decision logging with linked action-item follow-up creation
- the service-line governance slice is now implemented in the repo
  - service-line registry and default bootstrap for the initial clinic service lines
  - governance-pack drafting with charter, competency, audit, pricing, and claims-governance sections
  - linked `clinical_governance` approval routing and controlled publication
  - publish-sync back into service-line governance status and next-review scheduling
- the delegation-matrix slice is now implemented in the repo
  - service-line/task/role delegation-rule registry
  - deterministic allowed/not-allowed evaluation
  - default bootstrap templates for high-risk service lines
  - dedicated delegation management UI and API routes
- the telehealth-stewardship slice is now implemented in the repo
  - telehealth stewardship packet registry and default bootstrap
  - linkage to the telehealth practice agreement and delegated task coverage
  - explicit clinical-governance approval routing and controlled publication
  - publish-sync back into the telehealth stewardship record and a dedicated UI
- the controlled-substance-stewardship slice is now implemented in the repo
  - controlled-substance stewardship packet registry and default bootstrap
  - linkage to supervising physician oversight and related practice-agreement coverage
  - service-line coverage, explicit clinical-governance approval routing, and controlled publication
  - publish-sync back into the stewardship record and a dedicated UI
- the standards/evidence-binder slice is now implemented in the repo
  - standards registry with deterministic mapping and review status
  - evidence-binder registry with linked standards coverage and controlled clinical-governance approval
  - binder publish-sync back into linked standards, evidence document history, and next-review scheduling
  - dedicated standards/evidence UI and API routes
- the committee/QAPI slice now also includes a live dashboard summary
  - incidents, CAPAs, approvals, worker queue, standards, binders, stewardship packets, and expiring practice agreements are visible in one QAPI snapshot
- the runtime-agent slice is now implemented in the repo
  - bounded agent registry with prompt-backed specs
  - approved internal tool allowlists and structured output requirements
  - OpenAI Responses API tool-loop execution through internal wrappers instead of direct business-logic calls
  - capability-gated API routes and a dedicated runtime-agents UI
- the revenue/commercial slice is now implemented in the repo
  - payer issue register with deterministic escalation into linked action items
  - pricing-governance packets that reuse the existing approval and publication path
  - revenue-review records with live commercial snapshots and committee linkage
  - a dedicated `/revenue` dashboard for commercial governance
- the evidence-gap and deeper analytics slice is now implemented in the repo
  - explicit evidence-gap records with manual creation, deterministic deduped refresh, and verification workflow
  - QAPI trend buckets for incidents, CAPAs, evidence gaps, overdue standards reviews, and evidence-binder states
  - richer revenue and service-line analytics for aging, stale governance coverage, and claims-governance risk
- the room/training/deploy-hardening slice is now implemented in the repo
  - room master-data records with default bootstrap and per-room office-readiness checklist binding
  - recurring training plans with deterministic requirement materialization, cycle tracking, and follow-up task closure
  - deployment-promotion checklist records and Pilot Ops hardening visibility for smoke proof, rollback proof, target auth mode, and explicit runtime-agent freeze posture
- the live smoke path now also checks that deployed runtime agents remain intentionally disabled
- the repo now ships an authenticated worker-health diagnostic command:
  - `npm run smoke:worker-health -- https://your-pilot-url.example.com`
  - it signs in through device-profile auth, reads `/ops/worker-health`, prints queue ages and thresholds, and exits nonzero only for `critical` worker health

That means the remaining pilot blockers are now mostly the latest Render redeploy, broader pilot validation, and worker/runtime operations hardening.

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

The deployed Render stack is still healthy and pilot-usable, but the main remaining operational concern is the deployed worker's steady-state pickup behavior.

- The deployed Render smoke check is green:
  - web `healthz`: `200`
  - web `readyz`: `200`
  - proxied API `healthz`: `200`
- The live pilot smoke harness succeeded against the deployed app for:
  - device enrollment + profile login
  - SharePoint-backed document publish path
  - Planner/list-triggering workflow actions
- The expanded live smoke harness now also includes:
  - controlled-substance stewardship bootstrap, submit, approve, and publish
  - standards bootstrap
  - evidence-binder create, submit, approve, and publish
  - a runtime-agent status check that confirms deployed agents stay disabled
- Pilot Ops now also exposes worker heartbeat/runtime detail directly:
  - last worker heartbeat
  - last completed batch summary
  - latest batch failure message
  - oldest queued job age
  - oldest processing lock age
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
- A fresh deployed live smoke run for the new controlled-substance and standards/evidence-binder flows still stalled on a newly queued `lists.issue.upsert` worker job.
  - the route logic itself did not fail
  - a one-off local worker batch against the same live database processed the queued job successfully
  - that strongly suggests the remaining problem is Render worker pickup/lease behavior, not broken workflow logic
- The worker loop is now more resilient:
  - it records periodic runtime heartbeat events into the shared audit stream
  - it records recent batch failures for Pilot Ops visibility
  - it no longer exits the whole process on one transient batch exception
- There is now also a bounded operator fallback:
  - Pilot Ops can run one worker batch intentionally through the API
  - that means a stalled queue no longer requires local shell access just to confirm or drain one batch
- The dedicated authenticated worker-health smoke now confirms the current deployed worker concern is still real:
  - `health: critical`
  - `lastHeartbeatAt: null`
  - `lastCompletedBatchAt: null`
  - `queued: 2`
  - `oldestQueuedMinutes: 67`
  - recommendation: run one bounded batch, then inspect Render worker pickup/heartbeat behavior
- The deployed runtime-agent status check succeeded, but the disabled reason is currently:
  - `OPENAI_API_KEY is not configured for runtime-agent execution.`
  - if you want the freeze to stay explicit even after adding the key later, also set `RUNTIME_AGENTS_ENABLED=false` on Render

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

4. Controlled-substance stewardship and standards/evidence-binder routes are implemented, tested, deployed, and reachable.
   - The remaining open item for those slices is worker steadiness during full live smoke, not missing product code.

5. Runtime agents are no longer a future placeholder.
   - The first bounded execution slice is implemented and verified locally.
   - The current chosen default is to keep them deployed but disabled until a later rollout.

6. Room-based office ops, recurring training plans, and deployment hardening are now implemented locally and in the live database.
   - The remaining open item for those three slices is just getting the newest code deployed on Render and then validating the live UI/API paths.

## What I still need from you next

1. Redeploy the latest web, API, and worker
   - this newest pass adds room master data, recurring training plans, and deployment-promotion checklist surfaces
   - the repo and database are ready, but the deployed app will not show them until this redeploy happens

2. Keep `RUNTIME_AGENTS_ENABLED=false` explicit on Render
   - runtime agents should stay shipped but intentionally disabled
   - the live smoke path now checks this posture
   - the current deployed disabled reason may still be coming from missing runtime-agent key/config rather than the explicit freeze flag

3. Optional later real-user rollout details
   - one label per additional computer/device
   - primary profile for that device
   - up to two backup profiles if needed
   - named office manager / quality lead / HR lead profiles when you want them added

4. After the next deploy, watch the new Pilot Ops worker-health surface
   - confirm `last heartbeat` keeps moving forward
   - confirm `oldest queued job` does not keep climbing during normal use
   - if the queue stalls again, compare Pilot Ops worker-health timing with the Render worker logs
   - if the queue is stuck and you need an immediate recovery path, use `Run one worker batch now` in Pilot Ops
   - no new secrets or Microsoft tenant setup are required for this step

## Database rule

Postgres is still required even though Microsoft is now ready, because Clinic OS stores its system-of-record state in Postgres and uses Microsoft 365 as connected publication and operations surfaces.

- On Render services, use the **internal** Render Postgres URL for `DATABASE_URL`
- On your laptop or any machine outside Render, use the **external** Postgres URL

## The next command I am waiting to run

The next bounded validation step is:

- redeploy the latest room/training/deploy-hardening code on Render
- rerun the expanded deployed live smoke once that newest code is live
- use the new `/ops/worker-health` surface to confirm the worker is heartbeating before and after that smoke run
- use `npm run smoke:worker-health -- https://your-pilot-url.example.com` when you want an auth-backed, shell-friendly worker diagnostic without opening Pilot Ops
- because the current worker-health smoke is still `critical`, the next operational check should be:
  - open Pilot Ops
  - use `Run one worker batch now`
  - confirm queued work drops and heartbeat timestamps begin advancing
  - if they do not, inspect the Render `clinic-os-worker` service logs for pickup/loop failures
- if needed during pilot operations, use the new `/worker-jobs/run-once` operator action as a bounded fallback while continuing to diagnose Render worker pickup

After that, the next major engineering step should be:

- live validation of the new room/training/deploy-hardening surfaces, then either deeper office/HR analytics or later post-pilot identity hardening and runtime-agent rollout discipline
