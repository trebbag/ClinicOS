# Entity model

Key entities:
- WorkflowDefinition
- WorkflowRun
- DocumentRecord
- ApprovalTask
- MetricRun
- RoleScorecard
- Incident
- CAPA
- Committee
- ActionItem
- ServiceLineRecord
- PublicAsset

The product should avoid embedding business rules only inside chat threads.
Instead:
- entities hold state
- workflows govern transitions
- tools perform effects
- prompts draft and explain
