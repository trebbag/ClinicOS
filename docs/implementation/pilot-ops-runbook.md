# Pilot Ops Runbook

This runbook covers the first-pilot hardening loop now built into Clinic OS:

- capability-based admin and operator permissions
- maintenance summary and cleanup actions
- repeatable live smoke validation
- Render promotion and rollback checks

## Core operator surfaces

- `GET /ops/config-status`
- `GET /ops/maintenance-summary`
- `POST /ops/cleanup`
- `GET /ops/role-capabilities`
- `GET /worker-jobs`
- `POST /worker-jobs/:jobId/retry`
- `GET /audit-events?eventTypePrefix=auth.`

The Pilot Ops page now exposes the same information for normal admin use.

## Capability model

Admin-sensitive operations no longer rely on scattered hardcoded role lists. The repo now uses a role-to-capability matrix for:

- pilot-ops visibility
- device/profile/enrollment management
- worker-job visibility and retry
- Microsoft status and validation
- cleanup execution
- auth-audit visibility

Business workflow rules that are still domain-specific remain enforced in service code and should be converted incrementally as those slices mature.

## Default cleanup path

The default cleanup path is intentionally conservative. It targets:

- expired or consumed enrollment codes older than the auth retention window
- expired active sessions, plus revoked sessions older than the auth retention window
- stale processing jobs whose lock age exceeded the stale-processing threshold

The default cleanup does **not** purge succeeded or dead-letter worker jobs unless you explicitly include those targets in the API call.

### Preview cleanup

Use the Pilot Ops UI or call:

```bash
curl -X POST "$PUBLIC_APP_ORIGIN/clinic-api/ops/cleanup" \
  -H "Content-Type: application/json" \
  -H "Origin: $PUBLIC_APP_ORIGIN" \
  -b "clinic_device=...; clinic_session=..." \
  -d '{"dryRun":true}'
```

### Run default cleanup

```bash
curl -X POST "$PUBLIC_APP_ORIGIN/clinic-api/ops/cleanup" \
  -H "Content-Type: application/json" \
  -H "Origin: $PUBLIC_APP_ORIGIN" \
  -b "clinic_device=...; clinic_session=..." \
  -d '{"dryRun":false}'
```

### Optional deeper cleanup

To also purge old succeeded and dead-letter worker jobs:

```bash
curl -X POST "$PUBLIC_APP_ORIGIN/clinic-api/ops/cleanup" \
  -H "Content-Type: application/json" \
  -H "Origin: $PUBLIC_APP_ORIGIN" \
  -b "clinic_device=...; clinic_session=..." \
  -d '{
    "dryRun": false,
    "targets": [
      "enrollment_codes",
      "expired_sessions",
      "stale_processing_jobs",
      "succeeded_worker_jobs",
      "dead_letter_worker_jobs"
    ]
  }'
```

## Live smoke workflow

The repo now ships a repeatable pilot smoke command:

```bash
npm run smoke:pilot-live -- https://your-pilot-url.example.com
```

### Minimum environment

- `PILOT_SMOKE_BASE_URL` or the URL argument
- `PILOT_SMOKE_PIN`

If the target browser is not already enrolled, also provide:

- `PILOT_SMOKE_ENROLLMENT_CODE`
- optionally `PILOT_SMOKE_DEVICE_LABEL`

### What the live smoke does

The live smoke script:

- verifies public web and proxied API readiness
- enrolls a device if needed
- logs into the allowed device profile
- revalidates Microsoft live status
- creates a smoke issue for Lists sync
- creates a smoke follow-through item for Planner plus List sync
- imports a de-identified smoke scorecard row for import-status List plus Teams notification
- requests planner reconciliation

### Optional publish smoke

If the enrolled device is allowed to use both an office-manager and medical-director profile, the same script can also run the document publish path. For that, provide:

- `PILOT_SMOKE_OFFICE_MANAGER_PIN`
- `PILOT_SMOKE_MEDICAL_DIRECTOR_PIN`

That optional publish sequence:

- switches into the office-manager profile
- creates and submits a non-PHI smoke document
- approves the office-manager review
- switches into the medical-director profile
- approves the medical-director review
- requests publication and waits for the published state

## Render release / promotion checklist

Before promoting a new pilot build:

1. Confirm the Render web, API, worker, and Postgres services are all in the same workspace and region.
2. Confirm `AUTH_MODE=device_profiles` and `NEXT_PUBLIC_AUTH_MODE=device_profiles`.
3. Confirm `PUBLIC_APP_ORIGIN` and `INTERNAL_API_BASE_URL` are set correctly.
4. Confirm `DATABASE_URL` is the internal Render Postgres URL on deployed services.
5. Confirm the Microsoft env set is present on API and worker for live mode.
6. Run:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `npm run codex:doctor`
7. Run:
   - `npm run smoke:render -- https://your-pilot-url.example.com`
8. Run:
   - `npm run smoke:pilot-live -- https://your-pilot-url.example.com`
9. Review Pilot Ops for:
   - no blocking runtime issues
   - no stale processing jobs
   - no failed or dead-letter jobs that need intervention

## Rollback checklist

If a deploy regresses the pilot:

1. Roll back the affected Render service to the prior deploy.
2. Recheck:
   - `/healthz`
   - `/readyz`
   - `/clinic-api/readyz`
3. Open Pilot Ops and confirm:
   - pilot usable
   - Microsoft still ready for live
   - worker backlog not growing unexpectedly
4. Re-run the Render smoke check.
5. If needed, run cleanup preview and then default cleanup.
6. Retry only the failed or dead-letter jobs that were introduced by the bad deploy.

## Notes for later hardening

Still intentionally deferred past this wave:

- richer alert delivery integrations
- more complete smoke-artifact cleanup beyond auth/session/job primitives
- broader capability coverage across every business workflow route
- production-grade migration discipline and environment promotion automation
