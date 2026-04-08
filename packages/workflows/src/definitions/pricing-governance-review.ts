import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const pricingGovernanceReviewInputSchema = z.object({
  title: z.string(),
  ownerRole: z.string(),
  serviceLineId: z.string().nullable(),
  requestedBy: z.string(),
  reviewDueAt: z.string().nullable(),
  publicAssetCount: z.number().int().nonnegative()
});

export const pricingGovernanceReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "pricing_governance_review",
    name: "Pricing governance review",
    description: "Draft, review, and publish internal pricing-governance packets through explicit finance and medical approval.",
    approvalClass: "policy_effective",
    inputSchemaName: "pricingGovernanceReviewInputSchema",
    artifactTypes: ["pricing_governance_packet", "pricing_guardrails", "commercial_offer_review"],
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
    ownerRoles: ["medical_director", "cfo"]
  }),
  inputSchema: pricingGovernanceReviewInputSchema
};
