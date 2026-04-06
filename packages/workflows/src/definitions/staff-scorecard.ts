import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const staffScorecardInputSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  rowsImported: z.number().positive(),
  requestedBy: z.string()
});

export const staffScorecardDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "staff_scorecard_generation",
    name: "Staff scorecard generation",
    description: "Generate role-based staff scorecards from de-identified operational inputs.",
    approvalClass: "action_request",
    inputSchemaName: "staffScorecardInputSchema",
    artifactTypes: ["scorecard_packet", "metric_snapshot", "manager_review_packet"],
    initialState: "new",
    allowedTransitions: {
      new: ["scoped"],
      scoped: ["drafted"],
      drafted: ["quality_checked"],
      quality_checked: ["awaiting_human_review"],
      awaiting_human_review: ["approved", "rejected"],
      approved: ["published"],
      published: ["archived"],
      rejected: [],
      archived: []
    },
    ownerRoles: ["medical_director", "office_manager", "hr_lead"]
  }),
  inputSchema: staffScorecardInputSchema
};
