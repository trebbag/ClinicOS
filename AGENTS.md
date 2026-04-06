# Clinic OS project rules

## Mission
Build a Microsoft-first, non-PHI clinic operating system for:
- office operations
- people / HR / training
- quality and accreditation
- performance scorecards
- de-identified clinical governance workflows
- public copy drafting and review
- contracted-service oversight
- committee management and CAPA

## Non-negotiables
- Never place PHI in prompts, fixtures, screenshots, tests, or seed data.
- Treat every generated artifact as a draft until approved.
- Public-facing or patient-facing material must never be published automatically.
- Policy-effective documents must never become active automatically.
- Employment-affecting documentation must never be finalized automatically.
- Clinical governance artifacts require explicit human review.
- Agents must not call Microsoft Graph directly; they must use internal tool wrappers.
- Every workflow must define:
  - a typed input schema
  - a state machine
  - allowed transitions
  - approval requirements
  - an audit log trail
- Every new agent must define:
  - clear purpose
  - allowed tools
  - structured output shape
  - forbidden actions
  - eval coverage
- Use deterministic code for:
  - permissions
  - state transitions
  - score calculations
  - due dates
  - approval routing
  - metric thresholds
- Prefer vertical slices over broad rewrites.
- Prefer small, reviewable diffs.

## Coding conventions
- TypeScript everywhere unless there is a strong reason not to.
- Use Zod for runtime validation.
- Keep prompts in version-controlled files.
- Keep agent specs small and explicit.
- Use comments to explain business rules, not obvious syntax.
- Write docs for the next Codex session.

## What to do before changing architecture
Read:
- `README.md`
- `PLANS.md`
- `PROJECT_BACKLOG.md`
- `docs/architecture/overview.md`
- `docs/architecture/security-boundaries.md`

## Delivery expectations
When you change something:
1. explain what changed
2. explain how it was tested
3. name remaining risks
4. recommend the next bounded step

## Forbidden shortcuts
- No fake “approved” status for drafts
- No direct publishing path that bypasses approvals
- No use of real patient examples
- No hidden business logic inside prompts when it belongs in code
- No giant generic “master agent”
- No silent changes to approval rules
