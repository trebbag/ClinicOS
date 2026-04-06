# Codex kickoff prompts

## Session 1: orient the repo
Use the control-tower agent. Read README.md, AGENTS.md, PLANS.md, PROJECT_BACKLOG.md, and docs/architecture/overview.md. Summarize the architecture, identify the most complete vertical slice, and recommend the first implementation task with tests.

## Session 2: policy pipeline
Use the workflow-engineer agent and the policy-pack skill. Implement the policy-lifecycle workflow end to end:
- create draft
- capture metadata
- submit for review
- record approval
- publish approved document
- retrieve approved version
Add tests and stop after the slice works.

## Session 3: office manager cockpit
Use the frontend-architect agent. Build the office manager cockpit using existing mock data, then wire it to the API. Preserve the approval model and do not add PHI.

## Session 4: scorecards
Use the backend-architect agent and the deidentified-import-pipeline skill. Implement CSV import, metric calculations, and manager review packet generation for staff scorecards. Keep formulas deterministic.

## Session 5: eval hardening
Use the eval-engineer agent and the eval-builder skill. Add routing, structured-output, approval-boundary, and malformed-input coverage for the first three slices.

## Session 6: Graph wrappers
Use the graph-integrations agent and the graph-adapter skill. Replace placeholder integration functions with concrete SharePoint, Planner, Lists, Teams, and approvals wrappers while preserving the internal tool interface.
