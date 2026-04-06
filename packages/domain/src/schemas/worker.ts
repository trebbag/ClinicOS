import { z } from "zod";
import { randomId } from "../common";

export const workerJobTypeSchema = z.enum([
  "approval.reminder",
  "planner.task.create",
  "planner.task.reconcile",
  "lists.issue.upsert",
  "lists.action-item.upsert",
  "lists.import-status.upsert",
  "office_ops.closeout.reminder",
  "office_ops.checklist.reminder",
  "office_ops.checklist.escalation",
  "office_ops.escalation.notice",
  "scorecard.review.reminder",
  "scorecard.review.escalation",
  "training.requirement.reminder",
  "teams.notification",
  "document.publish"
]);

export const workerJobStatusSchema = z.enum([
  "queued",
  "processing",
  "succeeded",
  "failed",
  "dead_letter"
]);

export const workerJobRecordSchema = z.object({
  id: z.string(),
  type: workerJobTypeSchema,
  status: workerJobStatusSchema,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  scheduledAt: z.string(),
  lockedAt: z.string().nullable().default(null),
  lastError: z.string().nullable().default(null),
  payload: z.record(z.unknown()),
  resultJson: z.unknown().nullable().default(null),
  sourceEntityType: z.string().nullable().default(null),
  sourceEntityId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const workerJobSummarySchema = z.object({
  queued: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  deadLetter: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative()
});

export type WorkerJobType = z.infer<typeof workerJobTypeSchema>;
export type WorkerJobStatus = z.infer<typeof workerJobStatusSchema>;
export type WorkerJobRecord = z.infer<typeof workerJobRecordSchema>;
export type WorkerJobSummary = z.infer<typeof workerJobSummarySchema>;

export function createWorkerJob(input: {
  type: WorkerJobType;
  payload: Record<string, unknown>;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  maxAttempts?: number;
  scheduledAt?: string;
}): WorkerJobRecord {
  const now = new Date().toISOString();
  return workerJobRecordSchema.parse({
    id: randomId("job"),
    type: input.type,
    status: "queued",
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    scheduledAt: input.scheduledAt ?? now,
    lockedAt: null,
    lastError: null,
    payload: input.payload,
    resultJson: null,
    sourceEntityType: input.sourceEntityType ?? null,
    sourceEntityId: input.sourceEntityId ?? null,
    createdAt: now,
    updatedAt: now
  });
}
