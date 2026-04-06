import { z } from "zod";
import { randomId } from "../common";
import { roles } from "../enums";

export const trainingRequirementTypeSchema = z.enum([
  "training",
  "competency"
]);

export const trainingGapStatusSchema = z.enum([
  "complete",
  "expiring_soon",
  "overdue",
  "missing"
]);

export const trainingRequirementSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeRole: z.string(),
  requirementType: trainingRequirementTypeSchema,
  title: z.string(),
  dueDate: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  lastReminderSentAt: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const trainingCompletionRecordSchema = z.object({
  id: z.string(),
  requirementId: z.string(),
  employeeId: z.string(),
  employeeRole: z.string(),
  completedAt: z.string(),
  validUntil: z.string().nullable().default(null),
  recordedBy: z.string(),
  note: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const trainingGapItemSchema = z.object({
  requirementId: z.string(),
  employeeId: z.string(),
  employeeRole: z.string(),
  requirementType: trainingRequirementTypeSchema,
  title: z.string(),
  status: trainingGapStatusSchema,
  dueDate: z.string().nullable(),
  latestCompletionAt: z.string().nullable(),
  validUntil: z.string().nullable(),
  notes: z.string().nullable()
});

export const trainingGapSummarySchema = z.object({
  employeeId: z.string(),
  employeeRole: z.string(),
  generatedAt: z.string(),
  counts: z.object({
    complete: z.number().int().nonnegative(),
    expiringSoon: z.number().int().nonnegative(),
    overdue: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative()
  }),
  items: z.array(trainingGapItemSchema)
});

export const trainingDashboardSchema = z.object({
  employeeId: z.string(),
  employeeRole: z.string(),
  requirements: z.array(trainingRequirementSchema),
  completions: z.array(trainingCompletionRecordSchema),
  gapSummary: trainingGapSummarySchema
});

export type TrainingRequirementType = z.infer<typeof trainingRequirementTypeSchema>;
export type TrainingGapStatus = z.infer<typeof trainingGapStatusSchema>;
export type TrainingRequirement = z.infer<typeof trainingRequirementSchema>;
export type TrainingCompletionRecord = z.infer<typeof trainingCompletionRecordSchema>;
export type TrainingGapItem = z.infer<typeof trainingGapItemSchema>;
export type TrainingGapSummary = z.infer<typeof trainingGapSummarySchema>;
export type TrainingDashboard = z.infer<typeof trainingDashboardSchema>;

export function createTrainingRequirement(input: {
  employeeId: string;
  employeeRole: string;
  requirementType: TrainingRequirementType;
  title: string;
  dueDate?: string | null;
  notes?: string | null;
  createdBy: string;
}): TrainingRequirement {
  const now = new Date().toISOString();
  return trainingRequirementSchema.parse({
    id: randomId("training_requirement"),
    employeeId: input.employeeId,
    employeeRole: input.employeeRole,
    requirementType: input.requirementType,
    title: input.title,
    dueDate: input.dueDate ?? null,
    notes: input.notes ?? null,
    lastReminderSentAt: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  });
}

export function createTrainingCompletionRecord(input: {
  requirementId: string;
  employeeId: string;
  employeeRole: string;
  completedAt?: string;
  validUntil?: string | null;
  note?: string | null;
  recordedBy: string;
}): TrainingCompletionRecord {
  const now = new Date().toISOString();
  return trainingCompletionRecordSchema.parse({
    id: randomId("training_completion"),
    requirementId: input.requirementId,
    employeeId: input.employeeId,
    employeeRole: input.employeeRole,
    completedAt: input.completedAt ?? now,
    validUntil: input.validUntil ?? null,
    recordedBy: input.recordedBy,
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now
  });
}

export const trainingRequirementCreateSchema = z.object({
  employeeId: z.string().min(1),
  employeeRole: z.enum(roles),
  requirementType: trainingRequirementTypeSchema,
  title: z.string().min(3),
  dueDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const trainingCompletionCreateSchema = z.object({
  requirementId: z.string().min(1),
  completedAt: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  note: z.string().max(2000).nullable().optional()
});
