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
    forbiddenActions: ["publish_without_approval", "call_graph_directly"]
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
    forbiddenActions: ["mark_as_approved"]
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
    forbiddenActions: ["publish_without_approval"]
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
    forbiddenActions: ["invent_metrics"]
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
    forbiddenActions: ["publish_without_approval"]
  }
];
