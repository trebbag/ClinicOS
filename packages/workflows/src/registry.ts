import type { WorkflowDefinition } from "@clinic-os/domain";
import type { ZodTypeAny } from "zod";
import { officeManagerDailyDefinition } from "./definitions/office-manager-daily";
import { policyLifecycleDefinition } from "./definitions/policy-lifecycle";
import { staffScorecardDefinition } from "./definitions/staff-scorecard";

export type RegisteredWorkflowDefinition = WorkflowDefinition & {
  inputSchema: ZodTypeAny;
};

export const workflowRegistry = new Map<string, RegisteredWorkflowDefinition>([
  [policyLifecycleDefinition.id, policyLifecycleDefinition],
  [officeManagerDailyDefinition.id, officeManagerDailyDefinition],
  [staffScorecardDefinition.id, staffScorecardDefinition]
]);
