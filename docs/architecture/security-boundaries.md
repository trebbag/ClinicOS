# Security boundaries

## Phase 1
- no PHI in prompts or fixtures
- no direct EHR access
- no autonomous publication
- no autonomous HR action
- no direct agent access to Graph
- no uncontrolled browsing inside runtime agents

## Why
The goal is to create safe leverage for operations, quality, and governance before expanding into PHI-adjacent systems.

## Required patterns
- structured inputs
- deterministic formulas in code
- approval gates
- audit log
- role-based access
- draft-first publication model
