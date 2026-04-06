# Codex runbook

## Session start ritual
1. Open the repo.
2. Trust the project so `.codex/config.toml` and project instructions load.
3. Read:
   - README.md
   - AGENTS.md
   - PLANS.md
   - PROJECT_BACKLOG.md
4. Choose one vertical slice.
5. Name the test plan before asking for implementation.

## Prompt pattern
Use this structure:

```text
Use the <custom-agent> agent and the <skill-name> skill.
Goal:
Constraints:
Files likely involved:
Acceptance criteria:
Stop condition:
```

## Good stop conditions
- “Stop after the API and tests pass.”
- “Stop after the UI is wired to mock data.”
- “Stop after the Graph wrapper skeleton exists.”
- “Stop after you summarize risks and next steps.”

## Review pattern
After a Codex run, ask:
- What changed?
- What tests did you run?
- What remains risky?
- What is the next bounded step?

## When to use subagents
Use subagents only when the work naturally splits:
- backend schema + workflow
- frontend view
- tests / evals
- Microsoft adapter shell

Keep `max_depth = 1`.
