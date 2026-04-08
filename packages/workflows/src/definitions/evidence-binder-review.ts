import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const evidenceBinderReviewInputSchema = z.object({
  title: z.string(),
  ownerRole: z.string(),
  sourceAuthority: z.string(),
  standardIds: z.array(z.string()).min(1),
  surveyWindowLabel: z.string().nullable(),
  requestedBy: z.string(),
  reviewCadenceDays: z.number().int().positive()
});

export const evidenceBinderReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "evidence_binder_review",
    name: "Evidence binder review",
    description: "Draft, review, and publish survey-ready evidence binders through explicit clinical-governance approval.",
    approvalClass: "clinical_governance",
    inputSchemaName: "evidenceBinderReviewInputSchema",
    artifactTypes: ["evidence_binder"],
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
    ownerRoles: ["medical_director", "quality_lead", "hr_lead"]
  }),
  inputSchema: evidenceBinderReviewInputSchema
};
