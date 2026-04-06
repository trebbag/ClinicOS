import type { ApprovalClass } from "@clinic-os/domain";

export function publicationAllowed(approvalClass: ApprovalClass, approved: boolean): boolean {
  if (!approved) {
    return false;
  }

  return approvalClass === "policy_effective" ||
    approvalClass === "public_facing" ||
    approvalClass === "action_request" ||
    approvalClass === "clinical_governance";
}
