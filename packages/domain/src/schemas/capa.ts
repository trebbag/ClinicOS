import { z } from "zod";
import { randomId } from "../common";
import { roles, type Role } from "../enums";

export const capaSourceTypeSchema = z.enum([
  "incident",
  "audit",
  "committee_review",
  "leadership_request"
]);

export const capaStatusSchema = z.enum([
  "open",
  "in_progress",
  "pending_verification",
  "overdue",
  "closed"
]);

export const capaRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  sourceId: z.string(),
  sourceType: capaSourceTypeSchema,
  incidentId: z.string().nullable().default(null),
  ownerRole: z.enum(roles),
  dueDate: z.string(),
  status: capaStatusSchema,
  correctiveAction: z.string(),
  preventiveAction: z.string(),
  verificationPlan: z.string().nullable().default(null),
  resolutionNote: z.string().nullable().default(null),
  workflowRunId: z.string().nullable().default(null),
  actionItemId: z.string().nullable().default(null),
  closedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const capaCreateSchema = z.object({
  title: z.string().min(3),
  summary: z.string().min(5).max(4000),
  sourceId: z.string().min(1),
  sourceType: capaSourceTypeSchema,
  incidentId: z.string().optional(),
  ownerRole: z.enum(roles),
  dueDate: z.string(),
  correctiveAction: z.string().min(5).max(4000),
  preventiveAction: z.string().min(5).max(4000),
  verificationPlan: z.string().max(2000).optional()
});

export const capaUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  summary: z.string().min(5).max(4000).optional(),
  ownerRole: z.enum(roles).optional(),
  dueDate: z.string().optional(),
  correctiveAction: z.string().min(5).max(4000).optional(),
  preventiveAction: z.string().min(5).max(4000).optional(),
  verificationPlan: z.string().max(2000).nullable().optional(),
  resolutionNote: z.string().max(2000).nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one CAPA field must be updated."
);

export const capaResolutionCommandSchema = z.object({
  decision: z.enum(["start", "request_verification", "close", "reopen"]),
  notes: z.string().max(2000).optional()
});

export type CapaSourceType = z.infer<typeof capaSourceTypeSchema>;
export type CapaStatus = z.infer<typeof capaStatusSchema>;
export type CapaRecord = z.infer<typeof capaRecordSchema>;
export type CAPA = CapaRecord;

export function createCapaRecord(input: {
  title: string;
  summary: string;
  sourceId: string;
  sourceType: CapaSourceType;
  ownerRole: Role;
  dueDate: string;
  correctiveAction: string;
  preventiveAction: string;
  incidentId?: string | null;
  verificationPlan?: string | null;
  resolutionNote?: string | null;
  workflowRunId?: string | null;
  actionItemId?: string | null;
  closedAt?: string | null;
  status?: CapaStatus;
}): CapaRecord {
  const now = new Date().toISOString();
  return capaRecordSchema.parse({
    id: randomId("capa"),
    title: input.title,
    summary: input.summary,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    incidentId: input.incidentId ?? null,
    ownerRole: input.ownerRole,
    dueDate: input.dueDate,
    status: input.status ?? "open",
    correctiveAction: input.correctiveAction,
    preventiveAction: input.preventiveAction,
    verificationPlan: input.verificationPlan ?? null,
    resolutionNote: input.resolutionNote ?? null,
    workflowRunId: input.workflowRunId ?? null,
    actionItemId: input.actionItemId ?? null,
    closedAt: input.closedAt ?? null,
    createdAt: now,
    updatedAt: now
  });
}
