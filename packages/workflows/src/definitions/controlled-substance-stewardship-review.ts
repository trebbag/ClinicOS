import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const controlledSubstanceStewardshipReviewInputSchema = z.object({
  title: z.string(),
  ownerRole: z.string(),
  supervisingPhysicianRole: z.string(),
  serviceLineIds: z.array(z.string()).min(1),
  linkedPracticeAgreementId: z.string().nullable(),
  requestedBy: z.string(),
  reviewCadenceDays: z.number().int().positive()
});

export const controlledSubstanceStewardshipReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "controlled_substance_stewardship_review",
    name: "Controlled-substance stewardship review",
    description: "Draft, review, and publish controlled-substance stewardship packets through explicit clinical-governance approval.",
    approvalClass: "clinical_governance",
    inputSchemaName: "controlledSubstanceStewardshipReviewInputSchema",
    artifactTypes: ["controlled_substance_stewardship_packet"],
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
  inputSchema: controlledSubstanceStewardshipReviewInputSchema
};
