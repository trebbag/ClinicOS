import { z } from "zod";
import { workflowDefinitionSchema } from "@clinic-os/domain";
import type { RegisteredWorkflowDefinition } from "../registry";

export const policyDraftInputSchema = z.object({
  title: z.string(),
  ownerRole: z.string(),
  approvalClass: z.enum(["policy_effective", "public_facing", "clinical_governance"]),
  serviceLines: z.array(z.string()).default([]),
  requestedBy: z.string(),
  objective: z.string()
});

export const policyLifecycleDefinition: RegisteredWorkflowDefinition = {
  ...workflowDefinitionSchema.parse({
    id: "policy_lifecycle",
    name: "Policy lifecycle",
    description: "Draft, review, approve, and publish a policy packet.",
    approvalClass: "policy_effective",
    inputSchemaName: "policyDraftInputSchema",
    artifactTypes: ["policy", "sop_outline", "audit_checklist", "training_notes"],
    initialState: "new",
    allowedTransitions: {
      new: ["scoped"],
      scoped: ["drafted"],
      drafted: ["quality_checked"],
      quality_checked: ["compliance_checked"],
      compliance_checked: ["awaiting_human_review"],
      awaiting_human_review: ["approved", "rejected"],
      approved: ["published"],
      published: ["review_due", "archived"],
      review_due: ["drafted", "archived"],
      rejected: [],
      archived: []
    },
    ownerRoles: ["medical_director", "quality_lead"]
  }),
  inputSchema: policyDraftInputSchema
};
