# Repo status

The repository now has a working pilot backbone for:
- role-aware API requests with resolver-based auth, trusted-device session support, and optional signed-proxy groundwork
- append-only audit events on write paths
- Prisma-backed application repositories and initial migration SQL
- policy/document submission, approval, publication, and approved-context retrieval
- office-manager issue/action-item workflow records with closeout and escalation tracking
- de-identified CSV scorecard imports with deterministic metric persistence and review sign-off records
- live web pages wired to the API instead of static mock data
- a persisted worker outbox with queue, retry, and dead-letter status
- stub/live Microsoft integration adapters for SharePoint, Lists, Planner, and Teams webhook notifications
- operational visibility for worker jobs across overview, quality, office-manager, and scorecard screens
- persisted Microsoft preflight validation records and pilot-ops status endpoints
- a pilot-ops admin page for auth, worker, and Microsoft readiness checks
- office-ops dashboard reads, daily closeout artifacts, overdue maintenance sweeps, and scorecard history views
- room-readiness checklist templates/runs/items with closeout gating and office-manager inline updates
- Planner task reconciliation back into Clinic OS action-item status and sync health
- manual HR/training requirement tracking with gap summaries and follow-up task creation from scorecard reviews
- scorecard history enrichment with rolling averages and open training-gap counts
- device-bound profile auth with enrollment codes, trusted device/session cookies, pilot-ops profile/device management, and a simple login flow
- same-origin deployment plumbing for a public web origin that proxies browser API requests through `/clinic-api/*`
- Render-first blueprint, startup/readiness validation, and a deploy smoke script for stub-mode pilots
- explicit stub-mode pilot readiness surfaces so Microsoft can stay optional for the first pilot
- clearer device-auth state reporting for enrollment-required, revoked-device, and expired-device cases
- local approved-document archive browsing/downloading for stub-mode pilots
- admin-ready deployment status surfaces with worker health, publication mode, and pilot-usable checks
- a shared role-to-capability matrix for pilot-ops/admin surfaces, instead of scattered hardcoded route-role lists
- maintenance summary and cleanup actions for stale enrollment codes, expired sessions, and stale worker processing locks
- a repeatable live pilot smoke harness that can exercise device auth, Lists sync, Planner sync, Teams delivery, and optional publish flows
- a pilot ops runbook with Render promotion, rollback, cleanup, and smoke instructions
- real prompt loading groundwork for runtime agents is still partial, but the repo now has deployment-safe feature-flag scaffolding for a later pass
- live Microsoft validation now distinguishes between Graph-probed surfaces and config-only Teams webhook checks
- the repo now has a working Microsoft-live local readiness path with external Postgres bootstrap, persisted integration validation records, API readiness checks, and worker startup on real env values
- API and worker runtime now use `tsx` start scripts as the pilot-safe execution path while the workspace-package compiled ESM layout remains a later cleanup item

The following areas are still placeholders or partial:
- production identity integration beyond enrolled-browser trust and the optional trusted-proxy groundwork
- richer alert routing and operational dashboards beyond the new cleanup/runbook baseline
- multi-room office master data, richer checklist analytics, and fuller Planner reconciliation breadth
- broader HR/training workflows beyond manual requirements/completions and longer-range scorecard analytics
- runtime agent structured tool execution loop and full eval-backed feature flag rollout
- deeper deployment, observability, and environment promotion workflows
