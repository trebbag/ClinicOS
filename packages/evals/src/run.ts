import { reviewersForApprovalClass } from "@clinic-os/approvals";
import { selectAgentForWorkflow } from "@clinic-os/agents";
import { routingCases } from "./cases/routing";
import { approvalBoundaryCases } from "./cases/approvalBoundaries";

export function runLocalEvals(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];

  for (const testCase of routingCases) {
    const actual = selectAgentForWorkflow(testCase.workflowId).id;
    if (actual !== testCase.expectedAgentId) {
      failures.push(`Routing mismatch: ${testCase.name}`);
    }
  }

  for (const testCase of approvalBoundaryCases) {
    const requires = reviewersForApprovalClass(testCase.approvalClass as any).length > 0;
    if (requires !== testCase.shouldRequireHumanReview) {
      failures.push(`Approval mismatch: ${testCase.name}`);
    }
  }

  return {
    passed: routingCases.length + approvalBoundaryCases.length - failures.length,
    failed: failures.length,
    failures
  };
}
