import type { RuntimeAgentSpec } from "./specs";

export const runtimeAgentRegistry: RuntimeAgentSpec[] = [
  {
    id: "control_tower",
    name: "Control Tower",
    purpose: "Route work into the correct workflow and assemble executive packets.",
    model: "gpt-5.4",
    reasoning: "high",
    allowedTools: ["save_draft_document", "submit_document_for_review", "create_action_item"],
    promptKey: "controlTower",
    reviewerRoles: ["medical_director", "cfo"],
    requiresApproval: true,
    forbiddenActions: ["publish_without_approval", "call_graph_directly"],
    outputShape: "Concise routing summary with workflow recommendation, draft artifacts created, follow-up actions, and human approvals still required."
  },
  {
    id: "policy_drafter",
    name: "Policy Drafter",
    purpose: "Draft policy packets and SOP outlines.",
    model: "gpt-5.4",
    reasoning: "high",
    allowedTools: ["save_draft_document", "submit_document_for_review"],
    promptKey: "policyDraft",
    reviewerRoles: ["medical_director", "quality_lead"],
    requiresApproval: true,
    forbiddenActions: ["mark_as_approved"],
    outputShape: "Policy drafting summary with draft document status, missing policy inputs, and reviewer handoff notes."
  },
  {
    id: "office_manager_copilot",
    name: "Office Manager Copilot",
    purpose: "Generate daily office management packets and task routing suggestions.",
    model: "gpt-5.4-mini",
    reasoning: "medium",
    allowedTools: ["create_action_item", "send_teams_notification"],
    promptKey: "officeManager",
    reviewerRoles: ["office_manager", "medical_director"],
    requiresApproval: false,
    forbiddenActions: ["publish_without_approval"],
    outputShape: "Operational summary with created action items, queued notifications, and open office-ops blockers."
  },
  {
    id: "scorecard_builder",
    name: "Scorecard Builder",
    purpose: "Generate scorecard narratives from deterministic metric outputs.",
    model: "gpt-5.4-mini",
    reasoning: "medium",
    allowedTools: ["save_draft_document"],
    promptKey: "scorecard",
    reviewerRoles: ["medical_director", "hr_lead"],
    requiresApproval: true,
    forbiddenActions: ["invent_metrics"],
    outputShape: "Scorecard narrative summary with metric observations, follow-up items, and reviewer handoff."
  },
  {
    id: "marketing_claims_reviewer",
    name: "Marketing Claims Reviewer",
    purpose: "Review draft public-facing copy for unsupported claims and missing approvals.",
    model: "gpt-5.4",
    reasoning: "high",
    allowedTools: ["save_draft_document", "submit_document_for_review"],
    promptKey: "marketingReview",
    reviewerRoles: ["medical_director", "cfo"],
    requiresApproval: true,
    forbiddenActions: ["publish_without_approval"],
    outputShape: "Claims-review summary with flagged claims, draft changes, and approval requirements."
  },
  {
    id: "quality_governance_coordinator",
    name: "Quality Governance Coordinator",
    purpose: "Draft and route quality, accreditation, and clinical-governance packets.",
    model: "gpt-5.4",
    reasoning: "high",
    allowedTools: ["save_draft_document", "submit_document_for_review", "create_action_item"],
    promptKey: "qualityGovernance",
    reviewerRoles: ["medical_director", "quality_lead"],
    requiresApproval: true,
    forbiddenActions: ["mark_as_approved", "publish_without_approval"],
    outputShape: "Governance packet summary with created draft artifacts, risk flags, and next human review steps."
  },
  {
    id: "committee_packet_coordinator",
    name: "Committee Packet Coordinator",
    purpose: "Assemble committee packet drafts and QAPI review packets with bounded follow-up actions.",
    model: "gpt-5.4-mini",
    reasoning: "medium",
    allowedTools: ["save_draft_document", "submit_document_for_review", "create_action_item", "send_teams_notification"],
    promptKey: "committeePacket",
    reviewerRoles: ["medical_director", "quality_lead", "cfo"],
    requiresApproval: true,
    forbiddenActions: ["record_final_decision_without_human_review"],
    outputShape: "Committee packet summary with agenda risks, follow-up actions, and reviewer handoff."
  },
  {
    id: "service_line_governance_planner",
    name: "Service-line Governance Planner",
    purpose: "Draft service-line governance packs and escalate missing controls or evidence.",
    model: "gpt-5.4",
    reasoning: "high",
    allowedTools: ["save_draft_document", "submit_document_for_review", "create_action_item"],
    promptKey: "serviceLinePack",
    reviewerRoles: ["medical_director", "cfo", "quality_lead"],
    requiresApproval: true,
    forbiddenActions: ["publish_without_approval", "invent_controls"],
    outputShape: "Service-line governance summary with risk gaps, created draft pack artifacts, and required approvals."
  }
];

export function listRuntimeAgents(): RuntimeAgentSpec[] {
  return runtimeAgentRegistry.map((spec) => ({ ...spec, allowedTools: [...spec.allowedTools], reviewerRoles: [...spec.reviewerRoles], forbiddenActions: [...spec.forbiddenActions] }));
}

export function getRuntimeAgentById(agentId: string): RuntimeAgentSpec | null {
  return runtimeAgentRegistry.find((agent) => agent.id === agentId) ?? null;
}
