import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const incidentReviewInputSchema = z.object({
  title: z.string(),
  severity: z.enum(["low", "moderate", "high", "critical"]),
  category: z.string(),
  requestedBy: z.string(),
  detectedAt: z.string(),
  detectedByRole: z.string()
});

export const incidentReviewDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "incident_review",
    name: "Incident review",
    description: "Track incident intake, review, and disposition with explicit audit trail.",
    approvalClass: "clinical_governance",
    inputSchemaName: "incidentReviewInputSchema",
    artifactTypes: ["incident_intake", "incident_review_note", "capa_request"],
    initialState: "new",
    allowedTransitions: {
      new: ["scoped"],
      scoped: ["drafted", "quality_checked"],
      drafted: ["quality_checked"],
      quality_checked: ["approved", "awaiting_human_review"],
      awaiting_human_review: ["approved", "rejected"],
      approved: ["archived"],
      rejected: ["drafted", "archived"],
      published: ["archived"],
      review_due: ["archived"],
      compliance_checked: ["awaiting_human_review"],
      archived: []
    },
    ownerRoles: ["quality_lead", "medical_director"]
  }),
  inputSchema: incidentReviewInputSchema
};
