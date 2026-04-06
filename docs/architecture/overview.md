# Architecture overview

Clinic OS uses a **workflow-first** architecture.

## Layers
1. Interface layer: internal web portal
2. Control plane API: stateful workflow and approval endpoints
3. Worker layer: asynchronous workflow processing
4. Runtime agent layer: bounded drafting/orchestration agents
5. Business tool layer: safe internal tools
6. Integration adapters: Microsoft 365 wrappers
7. Data layer: workflow, documents, approvals, metrics, incidents, CAPAs
8. Retrieval layer: approved documents only

## Core principles
- workflow state is explicit
- artifacts are first-class
- approvals are first-class
- audit trails are append-only
- agent roles are bounded
- business tools mediate external effects
