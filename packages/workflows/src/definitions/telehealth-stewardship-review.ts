import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const telehealthStewardshipReviewInputSchema = z.object({
  title: z.string(),
  ownerRole: z.string(),
  supervisingPhysicianRole: z.string(),
  linkedPracticeAgreementId: z.string().nullable(),
  delegatedTaskCodes: z.array(z.string()),
  requestedBy: z.string(),
  reviewCadenceDays: z.number().int().positive()
});

export const telehealthStewardshipReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "telehealth_stewardship_review",
    name: "Telehealth stewardship review",
    description: "Draft, review, and publish telehealth stewardship packets through explicit clinical-governance approval.",
    approvalClass: "clinical_governance",
    inputSchemaName: "telehealthStewardshipReviewInputSchema",
    artifactTypes: ["telehealth_stewardship_packet"],
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
    ownerRoles: ["medical_director", "quality_lead", "patient_care_team_physician"]
  }),
  inputSchema: telehealthStewardshipReviewInputSchema
};
