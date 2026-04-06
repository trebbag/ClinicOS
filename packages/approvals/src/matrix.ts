export const approvalMatrix = {
  policy_effective: ["medical_director", "cfo"],
  public_facing: ["medical_director", "cfo"],
  action_request: ["office_manager", "medical_director"],
  clinical_governance: ["medical_director", "patient_care_team_physician"]
} as const;

export type ApprovalMatrix = typeof approvalMatrix;
