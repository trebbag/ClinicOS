import { z } from "zod";
import { approvalClasses, roles, serviceLines, workflowStates } from "../enums";
import { actionItemKindSchema, actionItemStatusSchema } from "./actionItem";
import { capaCreateSchema, capaResolutionCommandSchema, capaUpdateSchema } from "./capa";
import { checklistItemStatusSchema } from "./checklist";
import {
  incidentCreateSchema,
  incidentReviewDecisionCommandSchema,
  incidentUpdateSchema
} from "./incident";
import {
  claimsReviewDecisionCommandSchema,
  publicAssetCreateSchema,
  publicAssetUpdateSchema
} from "./publicAsset";
import { trainingCompletionCreateSchema, trainingRequirementCreateSchema } from "./training";

export const workflowTransitionCommandSchema = z.object({
  nextState: z.enum(workflowStates),
  note: z.string().max(1000).optional()
});

export const approvalDecisionCommandSchema = z.object({
  decision: z.enum(["approved", "rejected", "sent_back"]),
  notes: z.string().max(2000).optional()
});

export const documentMetadataSchema = z.object({
  title: z.string().min(3),
  ownerRole: z.enum(roles),
  approvalClass: z.enum(approvalClasses),
  artifactType: z.string().min(2),
  summary: z.string().max(1000).default(""),
  workflowRunId: z.string().optional(),
  serviceLines: z.array(z.enum(serviceLines)).default([]),
  body: z.string().min(1)
});

export const actionItemCreateSchema = z.object({
  kind: actionItemKindSchema.default("action_item"),
  title: z.string().min(3),
  description: z.string().max(2000).optional(),
  ownerRole: z.enum(roles),
  dueDate: z.string().optional(),
  sourceWorkflowRunId: z.string().optional()
});

export const actionItemUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: actionItemStatusSchema.optional(),
  resolutionNote: z.string().max(2000).nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one action-item field must be updated."
);

export const scorecardImportJobSchema = z.object({
  filename: z.string().min(3),
  csv: z.string().min(1)
});

export const scorecardReviewDecisionCommandSchema = z.object({
  decision: z.enum(["signed_off", "sent_back", "escalated"]),
  notes: z.string().max(2000).optional()
});

export const checklistItemUpdateSchema = z.object({
  status: checklistItemStatusSchema,
  note: z.string().max(2000).nullable().optional()
}).superRefine((value, ctx) => {
  if (value.status === "blocked" && (!value.note || value.note.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Blocked checklist items require a note."
    });
  }
});

export type WorkflowTransitionCommand = z.infer<typeof workflowTransitionCommandSchema>;
export type ApprovalDecisionCommand = z.infer<typeof approvalDecisionCommandSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
export type ActionItemCreate = z.infer<typeof actionItemCreateSchema>;
export type ActionItemUpdateCommand = z.infer<typeof actionItemUpdateSchema>;
export type ScorecardImportJob = z.infer<typeof scorecardImportJobSchema>;
export type ScorecardReviewDecisionCommand = z.infer<typeof scorecardReviewDecisionCommandSchema>;
export type ChecklistItemUpdateCommand = z.infer<typeof checklistItemUpdateSchema>;
export type TrainingRequirementCreateCommand = z.infer<typeof trainingRequirementCreateSchema>;
export type TrainingCompletionCreateCommand = z.infer<typeof trainingCompletionCreateSchema>;
export type IncidentCreateCommand = z.infer<typeof incidentCreateSchema>;
export type IncidentUpdateCommand = z.infer<typeof incidentUpdateSchema>;
export type IncidentReviewDecisionCommand = z.infer<typeof incidentReviewDecisionCommandSchema>;
export type CapaCreateCommand = z.infer<typeof capaCreateSchema>;
export type CapaUpdateCommand = z.infer<typeof capaUpdateSchema>;
export type CapaResolutionCommand = z.infer<typeof capaResolutionCommandSchema>;

export {
  incidentCreateSchema,
  incidentUpdateSchema,
  incidentReviewDecisionCommandSchema,
  capaCreateSchema,
  capaUpdateSchema,
  capaResolutionCommandSchema,
  publicAssetCreateSchema,
  publicAssetUpdateSchema,
  claimsReviewDecisionCommandSchema,
  trainingRequirementCreateSchema,
  trainingCompletionCreateSchema
};
