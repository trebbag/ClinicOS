import type { ApprovalClass } from "@clinic-os/domain";
import { approvalMatrix } from "./matrix";

export function reviewersForApprovalClass(approvalClass: ApprovalClass): string[] {
  return [...approvalMatrix[approvalClass]];
}

export function requiresHumanReview(approvalClass: ApprovalClass): boolean {
  return reviewersForApprovalClass(approvalClass).length > 0;
}
