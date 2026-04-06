# Workflow state model

## States
- `new`
- `scoped`
- `drafted`
- `quality_checked`
- `compliance_checked`
- `awaiting_human_review`
- `approved`
- `published`
- `review_due`
- `archived`
- `rejected`

## Transition rules
- Drafts cannot jump directly to `published`
- `approved` requires a matching approval record
- `published` requires both approval and a publish action
- `review_due` can only be reached from `published`
- `rejected` captures a terminal decision but may spawn a new revision workflow

## Audit events
- workflow.created
- workflow.transitioned
- artifact.created
- artifact.updated
- approval.requested
- approval.decided
- artifact.published
- workflow.archived
