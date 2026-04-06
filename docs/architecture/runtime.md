# Runtime architecture

## Workflow state machine
Every workflow has:
- definition
- input schema
- allowed states
- transition guards
- artifact outputs
- approval requirements
- audit events

Example lifecycle:
`new -> scoped -> drafted -> quality_checked -> compliance_checked -> awaiting_human_review -> approved -> published -> review_due -> archived`

## Runtime agent families
- Control tower
- Office operations
- People/performance
- Quality/accreditation
- Clinical governance (non-PHI)
- Public-claims review
- Revenue/commercial support

## Tools boundary
Agents can call internal business tools only.
The backend translates those tool calls into:
- SharePoint
- Lists
- Planner
- Teams
- approval APIs
- database writes
