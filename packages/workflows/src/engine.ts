import type { WorkflowDefinition, WorkflowRun, WorkflowState } from "@clinic-os/domain";

export function canTransition(
  definition: WorkflowDefinition,
  current: WorkflowState,
  next: WorkflowState
): boolean {
  const allowed = definition.allowedTransitions[current] ?? [];
  return allowed.includes(next);
}

export function transitionWorkflow(
  definition: WorkflowDefinition,
  run: WorkflowRun,
  next: WorkflowState
): WorkflowRun {
  if (!canTransition(definition, run.state, next)) {
    throw new Error(`Invalid transition: ${run.state} -> ${next}`);
  }

  return {
    ...run,
    state: next,
    updatedAt: new Date().toISOString()
  };
}
