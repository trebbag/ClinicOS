import type { RuntimeAgentSpec } from "./specs";
import { getRuntimeAgentById } from "./registry";

export function selectAgentForWorkflow(workflowId: string): RuntimeAgentSpec {
  if (workflowId === "policy_lifecycle") {
    return getRuntimeAgentById("policy_drafter")!;
  }

  if (workflowId === "office_manager_daily") {
    return getRuntimeAgentById("office_manager_copilot")!;
  }

  if (workflowId === "staff_scorecard_generation") {
    return getRuntimeAgentById("scorecard_builder")!;
  }

  if ([
    "incident_review",
    "capa_lifecycle",
    "practice_agreement_review",
    "telehealth_stewardship_review",
    "controlled_substance_stewardship_review",
    "evidence_binder_review"
  ].includes(workflowId)) {
    return getRuntimeAgentById("quality_governance_coordinator")!;
  }

  if ([
    "committee_packet_review",
    "qapi_monthly_review"
  ].includes(workflowId)) {
    return getRuntimeAgentById("committee_packet_coordinator")!;
  }

  if (workflowId === "public_asset_claims_review") {
    return getRuntimeAgentById("marketing_claims_reviewer")!;
  }

  if (workflowId === "service_line_pack_review") {
    return getRuntimeAgentById("service_line_governance_planner")!;
  }

  return getRuntimeAgentById("control_tower")!;
}
