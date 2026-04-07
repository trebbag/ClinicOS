import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const qapiMonthlyReviewInputSchema = z.object({
  committeeId: z.string(),
  committeeName: z.string(),
  scheduledFor: z.string(),
  requestedBy: z.string(),
  qapiFocus: z.literal(true),
  agendaItemCount: z.number().int().nonnegative()
});

export const qapiMonthlyReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "qapi_monthly_review",
    name: "QAPI monthly review",
    description: "Generate and route the monthly QAPI packet with incidents, CAPAs, operational exceptions, and review actions.",
    approvalClass: "clinical_governance",
    inputSchemaName: "qapiMonthlyReviewInputSchema",
    artifactTypes: ["qapi_committee_packet", "qapi_minutes", "qapi_follow_up"],
    initialState: "new",
    allowedTransitions: {
      new: ["scoped"],
      scoped: ["drafted"],
      drafted: ["quality_checked"],
      quality_checked: ["awaiting_human_review"],
      awaiting_human_review: ["approved", "rejected"],
      approved: ["archived"],
      rejected: ["drafted", "archived"],
      published: ["archived"],
      review_due: ["archived"],
      compliance_checked: ["awaiting_human_review"],
      archived: []
    },
    ownerRoles: ["medical_director", "quality_lead"]
  }),
  inputSchema: qapiMonthlyReviewInputSchema
};
