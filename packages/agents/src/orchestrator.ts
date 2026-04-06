import type { RuntimeAgentSpec } from "./specs";
import { runtimeAgentRegistry } from "./registry";

export function selectAgentForWorkflow(workflowId: string): RuntimeAgentSpec {
  if (workflowId === "policy_lifecycle") {
    return runtimeAgentRegistry.find((agent) => agent.id === "policy_drafter")!;
  }

  if (workflowId === "office_manager_daily") {
    return runtimeAgentRegistry.find((agent) => agent.id === "office_manager_copilot")!;
  }

  if (workflowId === "staff_scorecard_generation") {
    return runtimeAgentRegistry.find((agent) => agent.id === "scorecard_builder")!;
  }

  return runtimeAgentRegistry.find((agent) => agent.id === "control_tower")!;
}
