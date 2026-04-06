export const roles = [
  "medical_director",
  "cfo",
  "office_manager",
  "hr_lead",
  "quality_lead",
  "patient_care_team_physician",
  "nurse_practitioner",
  "medical_assistant",
  "front_desk"
] as const;

export type Role = (typeof roles)[number];

export const serviceLines = [
  "primary_care",
  "women_health",
  "telehealth",
  "weight_management",
  "hrt",
  "vaccines",
  "waived_testing",
  "contracted_lab",
  "iv_hydration",
  "aesthetics",
  "allergy_testing"
] as const;

export type ServiceLine = (typeof serviceLines)[number];

export const workflowStates = [
  "new",
  "scoped",
  "drafted",
  "quality_checked",
  "compliance_checked",
  "awaiting_human_review",
  "approved",
  "published",
  "review_due",
  "archived",
  "rejected"
] as const;

export type WorkflowState = (typeof workflowStates)[number];

export const approvalClasses = [
  "policy_effective",
  "public_facing",
  "action_request",
  "clinical_governance"
] as const;

export type ApprovalClass = (typeof approvalClasses)[number];
