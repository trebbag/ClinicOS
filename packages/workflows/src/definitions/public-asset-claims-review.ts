import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const publicAssetClaimsReviewInputSchema = z.object({
  title: z.string(),
  ownerRole: z.string(),
  assetType: z.string(),
  serviceLine: z.string().nullable().optional(),
  requestedBy: z.string(),
  claimsCount: z.number().int().positive()
});

export const publicAssetClaimsReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "public_asset_claims_review",
    name: "Public asset claims review",
    description: "Draft, review claims, route for human approval, and publish public-facing copy safely.",
    approvalClass: "public_facing",
    inputSchemaName: "publicAssetClaimsReviewInputSchema",
    artifactTypes: ["public_asset", "claims_register", "approved_public_copy"],
    initialState: "new",
    allowedTransitions: {
      new: ["scoped"],
      scoped: ["drafted"],
      drafted: ["quality_checked"],
      quality_checked: ["awaiting_human_review"],
      awaiting_human_review: ["approved", "rejected"],
      approved: ["published", "archived"],
      published: ["archived"],
      rejected: ["drafted", "archived"],
      archived: []
    },
    ownerRoles: ["quality_lead", "medical_director", "cfo"]
  }),
  inputSchema: publicAssetClaimsReviewInputSchema
};
