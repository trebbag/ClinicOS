# Clinic OS UI/UX Implementation Spec

## Purpose

This document defines the intended product UX for Clinic OS as a desktop-first, executive-dashboard-first, unified command center. It is written to be directly usable by engineering and design without requiring another round of product-definition work.

The goal is not a generic admin console. Clinic OS should feel like an operating system for clinic governance:

- oversight before action
- fast visibility into operational risk
- strong draft/review/publish boundaries
- clear role-aware visibility without fragmenting the app into separate homepages
- deterministic, non-PHI workflow clarity

## Product UX principles

### Draft-first

- Every generated artifact starts life as a draft.
- The UI must visually distinguish `draft`, `review`, `approved`, `publish_pending`, and `published`.
- Publishing, final approval, and employment-affecting or policy-effective actions must never look like routine save actions.

### Oversight before action

- The primary experience is to understand status, exceptions, deadlines, and readiness before mutating records.
- Every major workspace should open with summary state and attention queues before detailed forms.

### Role-aware visibility

- Use capability-aware visibility to hide irrelevant workspaces and actions.
- Do not fork the app into separate role-specific products.
- A multi-role user should keep one consistent shell and switch context without losing orientation.

### Non-PHI operational clarity

- Summaries, dashboards, and trend views should remain safe for non-PHI oversight.
- Avoid dense narrative walls. Use counts, due windows, trend modules, status chips, and linked drilldowns.

### One command center, many workspaces

- There should be one command-center home for all signed-in users.
- Workspaces should feel like focused operational views under one shared navigation and component system.

## Information architecture

## Primary nav model

The app should use a single left navigation or persistent top nav with grouped destinations:

- Command Center
- Approvals
- Office Ops
- Quality & QAPI
- People & Training
- Revenue & Service Lines
- Standards & Evidence
- Governance Packs
- Pilot Ops

Secondary utilities should sit in a global utility bar:

- search
- notifications
- audit/history
- quick actions
- role/profile switcher

## Command Center home

The command center is the canonical landing page. It should answer:

- What needs attention right now?
- Which domains are healthy vs degraded?
- What approvals, deadlines, or operational blockers are approaching?
- Is the system itself healthy enough to trust?

## Workspace grouping

### Approvals

- pending approvals
- recently completed approvals
- publish-pending artifacts
- review bottlenecks by reviewer role

### Office Ops

- daily packet
- room readiness
- checklists
- issues and follow-through items
- planner reconciliation
- room analytics

### Quality & QAPI

- incidents
- CAPAs
- committee meetings
- QAPI dashboard and trend history
- practice agreements and stewardship packets

### People & Training

- scorecards
- recurring training plans
- requirement cycles
- coaching and overdue follow-ups

### Revenue & Service Lines

- payer issues
- pricing governance
- revenue reviews
- service-line risk and coverage

### Standards & Evidence

- standards registry
- evidence binders
- evidence gaps
- verification workflow
- standards/QAPI links

### Governance Packs

- service-line packs
- telehealth stewardship
- controlled-substance stewardship
- practice agreements
- public assets and claims review

### Pilot Ops

- deployment hardening
- worker health
- auth/device readiness
- Microsoft validation
- alerts
- cleanup and bounded operator actions

## Cross-cutting utilities

### Search

- Search should index titles, IDs, workflow references, committee names, service lines, and review artifacts.
- Search results should prioritize active/open items over archived records.

### Notifications

- Notifications should focus on approvals, overdue work, critical operational risk, and deployment/runtime warnings.
- Notifications should link directly into the relevant detail pane or workflow step.

### Audit/history

- Every key object should expose timeline and audit context without requiring a separate admin tool.
- The audit surface should be readable, not raw JSON-first.

### Quick actions

Global quick actions should support:

- create document
- create incident
- create CAPA
- create action item
- create public asset
- create evidence gap
- create payer issue
- generate daily packet
- create committee meeting

## Homepage / command-center design

## Top summary row

Use a horizontal summary row with high-signal metrics:

- open approvals
- critical alerts
- overdue action items
- overdue evidence gaps
- room readiness exceptions
- revenue/commercial attention items

Each tile should support:

- one primary metric
- one short explanatory subtitle
- one drill-through target

## Attention queue

This is the most important module on the page.

It should show prioritized, mixed-domain work such as:

- approvals waiting on the current user
- critical worker/Microsoft/runtime alerts
- overdue evidence gaps
- blocked CAPAs
- overdue room checklist follow-through
- pricing governance awaiting review

Each row should show:

- title
- domain
- severity/status chip
- due/age
- owner/reviewer role
- one primary action

## Domain health tiles

Show by-domain health cards for:

- Office Ops
- Quality & QAPI
- People & Training
- Revenue & Service Lines
- Standards & Evidence
- Pilot Ops

Each tile should include:

- current status
- top risk reason
- count of open exceptions
- trend direction if available

## Upcoming deadlines

Use a short horizon list grouped by:

- today
- next 7 days
- next 30 days

Include approvals, reviews, training due items, evidence verifications, pricing reviews, and committee deadlines.

## Recent approvals / publications

Show:

- recently approved
- recently published
- publish pending

This builds operator trust that the system is moving work through review and controlled release correctly.

## Worker / Microsoft operational strip

Place a narrow but always-visible strip near the top or upper-middle of the command center showing:

- worker operating state
- last heartbeat
- oldest queued job age
- Microsoft ready/degraded state
- explicit runtime-agent freeze state

This should feel like a reliability bar, not a full admin console.

## Role-aware module visibility

- Office manager should see Office Ops prominence.
- Quality lead should see Quality/QAPI prominence.
- HR lead should see People & Training prominence.
- CFO and medical director should see revenue, approvals, and governance summaries prominently.
- Admin multi-role accounts should see the full shell with no second-class experience.

## Workspace page patterns

## Register + detail split

Default pattern for most operational domains:

- left or upper register list
- right or lower detail pane

Registers should support:

- status filters
- due/age filters
- role/service-line filters where relevant
- search
- saved default sort emphasizing attention and recency

Detail panes should include:

- status chips
- timeline/audit summary
- linked records
- next valid actions

## Packet / review workflow pages

For documents, governance packs, practice agreements, evidence binders, pricing governance, and public assets:

- show a workflow header with:
  - current state
  - approval class
  - reviewer path
  - publication state
- body/content should sit in the center
- right rail should show:
  - approvals
  - status history
  - linked risks or evidence gaps
  - quick audit summary

## Analytics dashboard pages

Analytics pages should use:

- metric tiles at the top
- trend modules in the middle
- exception tables below
- explicit filter bar

Avoid large single tables as the first impression.

## Approval / publish states

Status language must stay consistent:

- `draft`
- `claims_reviewed`
- `approval_pending`
- `approved`
- `publish_pending`
- `published`
- `attention_needed`
- `blocked`
- `archived`

Do not create visually similar chips for materially different states.

## Empty / error / degraded / loading states

Every workspace must define:

- Empty: explain what the workspace is for and show the primary create action.
- Error: explain what failed and whether it is safe to retry.
- Degraded: show when Microsoft or worker/runtime state makes outcomes uncertain.
- Loading: skeletons or stable placeholders, not layout jump.

## Interaction model

## Global quick actions

Quick actions should be keyboard-accessible and consistent:

- `Create`
- `Submit for review`
- `Approve`
- `Publish`
- `Escalate`
- `Create follow-up`
- `Verify`

Only context-valid actions should be enabled.

## Switch role / profile

- The role/profile switcher should be global and obvious.
- Switching roles should preserve current page when safe.
- When a new role lacks access to the current workspace, route the user back to Command Center with a clear message.

## Status chips and severity language

Use one vocabulary consistently across the app.

For workflow state:

- draft
- in review
- approved
- publish pending
- published
- blocked
- archived

For operational severity:

- healthy
- warning
- critical

For attention:

- ready
- attention needed
- overdue

Avoid inventing near-duplicates like `ok`, `normal`, `good`, `live`, `green` interchangeably.

## Timeline / audit visibility

- Every major record needs a visible timeline.
- Timelines should include:
  - created
  - submitted
  - reviewed
  - approved
  - published
  - escalated
  - verified
- Prefer a collapsed summary with expandable full audit detail.

## Inline escalation and linked action items

- Escalation should be visible near the issue/gap/record it belongs to.
- When a linked action item exists, show it inline instead of forcing users to navigate away.
- Support quick transitions like:
  - create follow-up
  - mark in progress
  - mark done
  - open linked planner/item

## Component system guidance

## Cards

Cards should be the base summary unit. Good cards have:

- one concept only
- a clear heading
- one dominant metric or action
- optional supporting trend or explanation

## Status chips

Status chips must be:

- compact
- high contrast
- readable without color alone
- reused consistently across domains

## Split panes

Registers + detail views should use split panes on desktop for speed.

Rules:

- keep list context visible while reading detail
- avoid modal overload for routine editing
- modals are acceptable for destructive or publish-critical confirmations

## Action bars

Action bars should live at the top of detail views and show only valid next actions.

Priority order:

- review/approval actions
- publish actions
- escalation / follow-up actions
- edit / metadata actions

## Metric tiles

Metric tiles should carry:

- title
- metric
- comparison/trend or supporting explanation
- click target

## Trend modules

Trend modules should default to compact period buckets:

- weekly for room/readiness
- monthly for training/revenue/QAPI

Each module should support:

- period label
- current value
- contextual comparison when available

## Workflow stepper / timeline

Use a workflow header or stepper for:

- approvals
- publication
- evidence verification
- CAPA lifecycle
- practice agreement or stewardship packet lifecycle

It should show:

- current step
- prior completed steps
- blocked or required future steps

## Approval panels

Approval panels should show:

- required approver roles
- current approval decisions
- pending approvals
- blockers preventing publish

Do not hide approval-critical data behind tabs alone.

## Warning / degraded banners

Use banners for:

- Microsoft degraded
- worker not polling
- runtime freeze missing
- stale validation
- missing required env or readiness proof

Banner text should be actionable and specific.

## Responsive behavior

### Desktop as primary

- Desktop is the design target.
- Most authoring, review, analytics, and operational management happens here.

### Tablet as supported

- Tablet should preserve overview and triage capability.
- Split panes may collapse into stacked sections.

### Mobile as read / triage only

- Mobile should support:
  - review status
  - alerts
  - high-level queue browsing
  - approval triage
- Avoid full authoring, dense analytics editing, or major packet composition on mobile.

## Accessibility and safety rules

- Full keyboard support for navigation, primary actions, filters, and role switching.
- Clear focus states.
- Never use hover-only disclosure for approval-critical or publishing-critical information.
- Chips, banners, and status panels must pass contrast checks.
- Destructive actions require:
  - explicit confirmation
  - record context
  - consequence language
- Publish actions require:
  - current state visibility
  - approval confirmation
  - publication target clarity

## Domain-by-domain UX requirements

## Office Ops

- Landing state should emphasize today’s clinic rhythm:
  - daily packet
  - room readiness
  - unresolved issues
  - planner reconciliation
- Room analytics should show repeat attention rooms and missed required items over time.
- Checklist rows need inline note entry and quick status changes.
- Office-manager workflow should feel fast, tactical, and same-day oriented.

## Quality / QAPI

- Quality should default to risk and remediation visibility.
- Show incidents, CAPAs, committee state, QAPI trends, and evidence gaps together.
- QAPI pages need both current snapshot and trend modules.
- Committee meeting detail should show packet, decisions, linked action items, and unresolved follow-through.

## Standards / Evidence

- Standards should show review state, linked binders, linked gaps, and verification backlog.
- Evidence binders should clearly show publication status and unresolved linked evidence gaps before publish.
- Verification should be explicit and auditable, not implied by edit state.

## Revenue / Service Lines

- Revenue workspace should balance operational register and executive summary.
- Show payer issue aging, pricing-governance freshness, service-line coverage risk, and recent revenue reviews together.
- Service-line detail should expose commercial coverage, governance-pack freshness, public-asset risk, and pricing state.

## People / Training

- Employee detail should show scorecard status plus recurring training risk in one view.
- Recurring plans, overdue cycles, upcoming due windows, and follow-up burden should be visible without drilling into raw requirement rows first.
- HR leaders should be able to spot coaching backlog quickly.

## Practice Agreements / Stewardship slices

- Each stewardship slice should follow one shared workflow shell:
  - status header
  - linked service lines and governing records
  - content summary
  - approvals
  - publication state
  - linked risks or evidence

## Pilot Ops

- Pilot Ops should feel like a reliability and rollout console inside the main app, not an engineer-only debug screen.
- Key modules:
  - config status
  - worker health with recent runtime history
  - deployment promotion checklist execution
  - trusted proxy readiness
  - Microsoft validation
  - critical alerts
  - cleanup and bounded worker-batch recovery

## Implementation priorities

Order the UX work like this:

1. Command Center shell and cross-workspace information architecture
2. Shared components: cards, status chips, banners, split panes, trend modules
3. Office Ops + Quality/QAPI summaries
4. People/Training and Revenue/Service Lines summary patterns
5. Pilot Ops final polish and operational clarity
6. Empty/error/degraded states across all workspaces

## Explicit anti-patterns

Do not implement:

- separate first-class homepages per role
- hidden approval/publish state in deep tabs only
- table-only experiences as primary landing layouts
- mobile-first authoring compromises that weaken desktop oversight
- color-only status communication
- auto-publish or auto-approve shortcuts in the UI

## Acceptance standard

The UX is correct when:

- executives can open the app and understand operational risk in under a minute
- office leaders can move through daily work without losing cross-domain visibility
- quality leaders can move from evidence to committee to remediation without context switching into separate products
- HR leads can identify coaching/training risk from a single employee view
- Pilot Ops can diagnose rollout/runtime state without shell-only access
