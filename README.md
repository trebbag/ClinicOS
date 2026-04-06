# Clinic OS

Clinic OS is a Microsoft-first, non-PHI clinic operating system scaffold designed to help an independent primary care clinic build repeatable administrative, HR, quality, accreditation, performance, and governance workflows with agentic assistance.

This repository is intentionally designed for **Codex-assisted development**:
- repo-level `AGENTS.md` instructions
- project-scoped custom agents in `.codex/agents/`
- reusable skills in `.agents/skills/`
- a workflow-first runtime architecture
- hard human approval gates
- a Responses-API-based agent runtime scaffold
- de-identified/manual data inputs for phase 1

## What this pack includes

- A monorepo scaffold for:
  - `apps/web`: internal portal
  - `apps/api`: control-plane API
  - `apps/worker`: background workflow worker
  - `packages/*`: shared domain, workflows, agents, prompts, tools, approvals, retrieval, metrics, evals, and database schema
- Codex configuration, custom agents, and reusable skills
- Architecture, implementation, and clinic-operations documentation
- Sample de-identified CSV input for staff scorecards
- A starter Prisma schema and operational domain model
- A 12-week build sequence and Codex kickoff prompts

## Design goals

1. Draft-first system. Nothing patient-facing, public-facing, or policy-effective publishes without human review.
2. Non-PHI phase 1. No live EHR integration. Only manual, de-identified data imports.
3. Workflow-first runtime. Agents move workflows through explicit states instead of taking free-form action.
4. Microsoft-first operating layer. SharePoint, Lists, Planner, Teams, and approvals sit behind internal tool wrappers.
5. Clinic-specific governance. Primary care, women’s health, telehealth, urgent-access, weight management, HRT, vaccines/testing, IV hydration, allergy testing, and aesthetics are modeled as separate service lines.

## Repository map

```text
clinic-os/
  AGENTS.md
  PLANS.md
  PROJECT_BACKLOG.md
  .codex/
  .agents/
  apps/
    web/
    api/
    worker/
  packages/
    db/
    domain/
    workflows/
    agents/
    prompts/
    tools/
    msgraph/
    approvals/
    retrieval/
    metrics/
    evals/
  docs/
  data/
  scripts/
```

## Phase 1 scope

Phase 1 is meant to create the operating layer for:
- policies and SOPs
- office manager workflows
- committees and packets
- scorecards and performance reviews
- approvals and document control
- quality, CAPA, and incident tracking
- de-identified audit and governance workflows
- public copy drafting and review routing

Phase 2 can add:
- Athena integration
- PHI-safe retrieval patterns
- chart-audit ingestion
- controlled, role-based patient-care workflows

## Local setup

### Prerequisites
- Node.js 22+
- npm 10+
- Docker Desktop or Docker Engine (optional, for Postgres)
- Codex CLI installed locally

### 1. Install dependencies
```bash
npm install
```

### 2. Copy environment template
```bash
cp .env.example .env
```

### 3. Start local Postgres (optional)
```bash
docker compose up -d postgres
```

### 4. Run local apps
```bash
npm run dev:api
npm run dev:web
npm run dev:worker
```

## Recommended Codex workflow

1. Open this repo in Codex and trust the project.
2. Review `AGENTS.md`.
3. Review `.codex/config.toml`.
4. Use the repo-local skills and custom agents instead of generic prompts.
5. Build in vertical slices:
   - policy / SOP / approval pipeline
   - office manager cockpit
   - staff scorecard engine
   - QAPI + CAPA + committees
   - marketing claims review
6. Keep approvals tight and network use deliberate.
7. Add evals for every new workflow and every new runtime agent.

See:
- `docs/implementation/codex-kickoff-prompts.md`
- `docs/implementation/build-sequence.md`
- `PLANS.md`
- `PROJECT_BACKLOG.md`

## First commands to run in Codex

```text
Use the control-tower agent. Read AGENTS.md, PLANS.md, and PROJECT_BACKLOG.md. Summarize the repo and identify the first three vertical slices.
```

```text
Use the workflow-engineer agent. Implement the policy-lifecycle workflow end to end with tests, then stop and report the diff.
```

```text
Use the frontend-architect agent. Build the office manager cockpit using the existing mock data and wire it to the API without changing the approval model.
```

## Security assumptions

- Do not place PHI in prompts, fixtures, screenshots, seed data, or tests.
- Treat all generated artifacts as drafts until approved.
- Do not let models call Microsoft Graph directly.
- Do not auto-publish public assets.
- Keep rule-based calculations deterministic in code.
- Log all workflow transitions and approval decisions.

## Operational outcomes this repo is designed to support

- objective staff-fit measurement
- increased revenue visibility
- safer clinical governance
- repeatable committee operations
- document control for accreditation readiness
- a manageable operating rhythm for a coached office manager

## What is intentionally incomplete

This pack is a **full implementation scaffold**, not a fully finished production clinic platform. It is designed so Codex can continue the build quickly with explicit structure, guardrails, prompts, and artifacts already in place.
