# Policy Pack Skill

Use this skill when implementing the policy lifecycle slice.

## Required outputs
- typed document metadata
- explicit workflow state transitions
- approval routing using the clinic approval matrix
- append-only audit events
- no automatic publication without approval evidence

## Guardrails
- never place PHI in prompts or fixtures
- keep policy artifacts in draft until human approval is complete
- keep approval and publication logic deterministic in code
