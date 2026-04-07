import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const practiceAgreementReviewInputSchema = z.object({
  title: z.string(),
  agreementType: z.string(),
  ownerRole: z.string(),
  supervisingPhysicianRole: z.string(),
  supervisedRole: z.string(),
  serviceLineIds: z.array(z.string()).min(1),
  requestedBy: z.string(),
  reviewCadenceDays: z.number().int().positive()
});

export const practiceAgreementReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "practice_agreement_review",
    name: "Practice agreement review",
    description: "Draft, review, and publish physician-oversight and practice-agreement documents through explicit clinical-governance approval.",
    approvalClass: "clinical_governance",
    inputSchemaName: "practiceAgreementReviewInputSchema",
    artifactTypes: ["practice_agreement", "physician_oversight_plan", "standing_order_supervision"],
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
  inputSchema: practiceAgreementReviewInputSchema
};
