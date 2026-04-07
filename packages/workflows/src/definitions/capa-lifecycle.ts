import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const capaLifecycleInputSchema = z.object({
  title: z.string(),
  sourceId: z.string(),
  sourceType: z.enum(["incident", "audit", "committee_review", "leadership_request"]),
  ownerRole: z.string(),
  dueDate: z.string(),
  requestedBy: z.string()
});

export const capaLifecycleDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "capa_lifecycle",
    name: "CAPA lifecycle",
    description: "Track corrective and preventive action from opening through verification and closure.",
    approvalClass: "clinical_governance",
    inputSchemaName: "capaLifecycleInputSchema",
    artifactTypes: ["capa_record", "verification_note"],
    initialState: "new",
    allowedTransitions: {
      new: ["scoped"],
      scoped: ["drafted"],
      drafted: ["quality_checked"],
      quality_checked: ["compliance_checked", "approved"],
      compliance_checked: ["approved"],
      awaiting_human_review: ["approved", "rejected"],
      approved: ["published", "archived"],
      published: ["review_due", "archived"],
      review_due: ["approved", "archived"],
      rejected: ["drafted", "archived"],
      archived: []
    },
    ownerRoles: ["quality_lead", "medical_director"]
  }),
  inputSchema: capaLifecycleInputSchema
};
