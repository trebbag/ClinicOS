import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const serviceLinePackReviewInputSchema = z.object({
  serviceLineId: z.string(),
  ownerRole: z.string(),
  requestedBy: z.string(),
  reviewCadenceDays: z.number().int().positive(),
  publicAssetCount: z.number().int().nonnegative()
});

export const serviceLinePackReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "service_line_pack_review",
    name: "Service-line pack review",
    description: "Draft and review service-line governance packs with explicit clinical-governance approval and controlled publication.",
    approvalClass: "clinical_governance",
    inputSchemaName: "serviceLinePackReviewInputSchema",
    artifactTypes: ["service_line_pack", "service_line_charter", "service_line_claims_inventory"],
    initialState: "new",
    allowedTransitions: {
      new: ["scoped"],
      scoped: ["drafted"],
      drafted: ["quality_checked"],
      quality_checked: ["awaiting_human_review"],
      awaiting_human_review: ["approved", "rejected"],
      approved: ["published", "archived"],
      published: ["review_due", "archived"],
      review_due: ["approved", "archived"],
      rejected: ["drafted", "archived"],
      archived: []
    },
    ownerRoles: ["medical_director", "quality_lead", "cfo"]
  }),
  inputSchema: serviceLinePackReviewInputSchema
};
