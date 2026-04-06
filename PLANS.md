# Clinic OS plan

## Product thesis
Clinic OS is a workflow-first internal platform that uses agentic drafting and orchestration to help a clinic build:
- policies and SOPs
- operational routines
- approvals and document control
- staff scorecards
- committee packets
- incident and CAPA tracking
- public copy review workflows
- service-line governance packs

## Product boundaries
Phase 1 excludes:
- live PHI
- direct Athena integration
- autonomous public publication
- autonomous HR action
- autonomous clinical decision-making
- patient-facing AI experiences

## Core vertical slices
1. Policy / SOP / approval pipeline
2. Office manager daily cockpit
3. Staff scorecard engine
4. QAPI / committee / CAPA engine
5. Public copy draft + claims review workflow
6. Contracted service oversight
7. Service-line governance packs

## Runtime planes

### Build plane
- repo
- Codex instructions
- custom agents
- skills
- tests
- evals
- docs
- deployment scripts

### Runtime plane
- internal portal
- workflow engine
- agent registry
- prompt registry
- approval engine
- Microsoft 365 adapters
- scorecards
- audit log
- document control
- retrieval of approved artifacts

## Top priorities for this clinic
1. Objective staff-fit measurement
2. Increased revenue visibility
3. Safer clinical governance
4. Office-manager operating rhythm
5. Joint-Commission-oriented documentation and controls

## Delivery order
### Milestone 0
- repo scaffold
- domain schemas
- workflow primitives
- approval matrix
- Codex setup
- docs

### Milestone 1
- policy-lifecycle workflow
- document metadata
- approval inbox
- published-document retrieval

### Milestone 2
- office manager cockpit
- issue tracking
- huddle packet
- Planner sync wrapper

### Milestone 3
- de-identified CSV import
- metric definitions
- scorecard engine
- manager packet generation

### Milestone 4
- QAPI / committee workflows
- CAPA engine
- incident register
- review calendars

### Milestone 5
- public asset drafting
- claims review workflow
- archive of approved public assets

## Engineering principles
- explicit state over hidden state
- typed contracts over prompt-only conventions
- small tools over broad permissions
- evidence trails over chat history
- deterministic math over model arithmetic
- human approval over “autonomy” in sensitive actions
