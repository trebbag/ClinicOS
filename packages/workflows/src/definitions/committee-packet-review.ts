import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const committeePacketReviewInputSchema = z.object({
  committeeId: z.string(),
  committeeName: z.string(),
  scheduledFor: z.string(),
  requestedBy: z.string(),
  qapiFocus: z.boolean(),
  agendaItemCount: z.number().int().nonnegative()
});

export const committeePacketReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "committee_packet_review",
    name: "Committee packet review",
    description: "Draft, review, and finalize governance committee packets with explicit audit and approval trails.",
    approvalClass: "clinical_governance",
    inputSchemaName: "committeePacketReviewInputSchema",
    artifactTypes: ["committee_packet", "committee_minutes", "committee_follow_up"],
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
    ownerRoles: ["medical_director", "quality_lead", "hr_lead", "cfo"]
  }),
  inputSchema: committeePacketReviewInputSchema
};
