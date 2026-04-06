import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const officeManagerDailyInputSchema = z.object({
  targetDate: z.string(),
  requestedBy: z.string(),
  unresolvedIssuesCount: z.number().nonnegative(),
  huddleTemplateId: z.string()
});

export const officeManagerDailyDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "office_manager_daily",
    name: "Office manager daily cockpit",
    description: "Prepare the office manager’s daily operating packet and follow-through queue.",
    approvalClass: "action_request",
    inputSchemaName: "officeManagerDailyInputSchema",
    artifactTypes: ["daily_checklist", "huddle_packet", "issue_queue"],
    initialState: "new",
    allowedTransitions: {
      new: ["scoped"],
      scoped: ["drafted"],
      drafted: ["quality_checked"],
      quality_checked: ["approved"],
      approved: ["published"],
      published: ["archived"],
      archived: []
    },
    ownerRoles: ["office_manager", "medical_director"]
  }),
  inputSchema: officeManagerDailyInputSchema
};
