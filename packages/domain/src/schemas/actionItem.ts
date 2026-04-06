import { z } from "zod";
import { randomId } from "../common";

export const actionItemKindSchema = z.enum([
  "action_item",
  "issue",
  "review"
]);

export const actionItemStatusSchema = z.enum([
  "open",
  "in_progress",
  "blocked",
  "done"
]);

export const actionItemEscalationStatusSchema = z.enum([
  "none",
  "needs_review",
  "escalated"
]);

export const plannerSyncStatusSchema = z.enum([
  "not_synced",
  "pending_create",
  "synced",
  "sync_error",
  "completed_external"
]);

export const actionItemRecordSchema = z.object({
  id: z.string(),
  kind: actionItemKindSchema,
  title: z.string(),
  description: z.string().nullable().default(null),
  ownerRole: z.string(),
  createdBy: z.string(),
  status: actionItemStatusSchema,
  resolutionNote: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  closedAt: z.string().nullable().default(null),
  escalationStatus: actionItemEscalationStatusSchema.default("none"),
  escalatedToRole: z.string().nullable().default(null),
  needsReviewAt: z.string().nullable().default(null),
  escalatedAt: z.string().nullable().default(null),
  plannerTaskId: z.string().nullable().default(null),
  syncStatus: plannerSyncStatusSchema.default("not_synced"),
  lastSyncedAt: z.string().nullable().default(null),
  lastSyncError: z.string().nullable().default(null),
  completedExternallyAt: z.string().nullable().default(null),
  sourceWorkflowRunId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ActionItemRecord = z.infer<typeof actionItemRecordSchema>;
export type PlannerSyncStatus = z.infer<typeof plannerSyncStatusSchema>;

export function createActionItemRecord(input: {
  kind: z.infer<typeof actionItemKindSchema>;
  title: string;
  description?: string | null;
  ownerRole: string;
  createdBy: string;
  dueDate?: string | null;
  resolutionNote?: string | null;
  closedAt?: string | null;
  escalationStatus?: z.infer<typeof actionItemEscalationStatusSchema>;
  escalatedToRole?: string | null;
  needsReviewAt?: string | null;
  escalatedAt?: string | null;
  plannerTaskId?: string | null;
  syncStatus?: PlannerSyncStatus;
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
  completedExternallyAt?: string | null;
  sourceWorkflowRunId?: string | null;
}): ActionItemRecord {
  const now = new Date().toISOString();
  return actionItemRecordSchema.parse({
    id: randomId("action"),
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    ownerRole: input.ownerRole,
    createdBy: input.createdBy,
    status: "open",
    resolutionNote: input.resolutionNote ?? null,
    dueDate: input.dueDate ?? null,
    closedAt: input.closedAt ?? null,
    escalationStatus: input.escalationStatus ?? "none",
    escalatedToRole: input.escalatedToRole ?? null,
    needsReviewAt: input.needsReviewAt ?? null,
    escalatedAt: input.escalatedAt ?? null,
    plannerTaskId: input.plannerTaskId ?? null,
    syncStatus: input.syncStatus ?? "not_synced",
    lastSyncedAt: input.lastSyncedAt ?? null,
    lastSyncError: input.lastSyncError ?? null,
    completedExternallyAt: input.completedExternallyAt ?? null,
    sourceWorkflowRunId: input.sourceWorkflowRunId ?? null,
    createdAt: now,
    updatedAt: now
  });
}
