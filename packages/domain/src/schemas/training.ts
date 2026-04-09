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
  planId: z.string().nullable().default(null),
  sourceCycleKey: z.string().nullable().default(null),
  followUpActionItemId: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  lastReminderSentAt: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const trainingPlanStatusSchema = z.enum([
  "active",
  "inactive",
  "archived"
]);

export const trainingPlanRecordSchema = z.object({
  id: z.string(),
  employeeRole: z.string(),
  employeeId: z.string().nullable().default(null),
  requirementType: trainingRequirementTypeSchema,
  title: z.string(),
  cadenceDays: z.number().int().positive(),
  leadTimeDays: z.number().int().nonnegative(),
  validityDays: z.number().int().positive().nullable().default(null),
  ownerRole: z.string(),
  status: trainingPlanStatusSchema,
  notes: z.string().nullable().default(null),
  lastMaterializedAt: z.string().nullable().default(null),
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
  plans: z.array(trainingPlanRecordSchema),
  requirements: z.array(trainingRequirementSchema),
  completions: z.array(trainingCompletionRecordSchema),
  gapSummary: trainingGapSummarySchema,
  planSummary: z.object({
    activePlans: z.number().int().nonnegative(),
    generatedRequirements: z.number().int().nonnegative(),
    upcomingRequirements: z.number().int().nonnegative(),
    overdueRequirements: z.number().int().nonnegative(),
    openFollowUps: z.number().int().nonnegative()
  })
});

export type TrainingRequirementType = z.infer<typeof trainingRequirementTypeSchema>;
export type TrainingGapStatus = z.infer<typeof trainingGapStatusSchema>;
export type TrainingRequirement = z.infer<typeof trainingRequirementSchema>;
export type TrainingPlanStatus = z.infer<typeof trainingPlanStatusSchema>;
export type TrainingPlanRecord = z.infer<typeof trainingPlanRecordSchema>;
export type TrainingCompletionRecord = z.infer<typeof trainingCompletionRecordSchema>;
export type TrainingGapItem = z.infer<typeof trainingGapItemSchema>;
export type TrainingGapSummary = z.infer<typeof trainingGapSummarySchema>;
export type TrainingDashboard = z.infer<typeof trainingDashboardSchema>;

export function createTrainingRequirement(input: {
  employeeId: string;
  employeeRole: string;
  requirementType: TrainingRequirementType;
  title: string;
  planId?: string | null;
  sourceCycleKey?: string | null;
  followUpActionItemId?: string | null;
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
    planId: input.planId ?? null,
    sourceCycleKey: input.sourceCycleKey ?? null,
    followUpActionItemId: input.followUpActionItemId ?? null,
    dueDate: input.dueDate ?? null,
    notes: input.notes ?? null,
    lastReminderSentAt: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  });
}

export function createTrainingPlanRecord(input: {
  employeeRole: string;
  employeeId?: string | null;
  requirementType: TrainingRequirementType;
  title: string;
  cadenceDays: number;
  leadTimeDays?: number;
  validityDays?: number | null;
  ownerRole: string;
  status?: TrainingPlanStatus;
  notes?: string | null;
  createdBy: string;
}): TrainingPlanRecord {
  const now = new Date().toISOString();
  return trainingPlanRecordSchema.parse({
    id: randomId("training_plan"),
    employeeRole: input.employeeRole,
    employeeId: input.employeeId ?? null,
    requirementType: input.requirementType,
    title: input.title,
    cadenceDays: input.cadenceDays,
    leadTimeDays: input.leadTimeDays ?? 14,
    validityDays: input.validityDays ?? null,
    ownerRole: input.ownerRole,
    status: input.status ?? "active",
    notes: input.notes ?? null,
    lastMaterializedAt: null,
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
  planId: z.string().optional(),
  sourceCycleKey: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const trainingPlanCreateSchema = z.object({
  employeeRole: z.enum(roles),
  employeeId: z.string().min(1).nullable().optional(),
  requirementType: trainingRequirementTypeSchema,
  title: z.string().min(3),
  cadenceDays: z.number().int().min(30).max(730),
  leadTimeDays: z.number().int().min(0).max(180).default(14),
  validityDays: z.number().int().min(1).max(730).nullable().optional(),
  ownerRole: z.enum(roles),
  notes: z.string().max(2000).nullable().optional()
});

export const trainingPlanUpdateSchema = z.object({
  status: trainingPlanStatusSchema.optional(),
  cadenceDays: z.number().int().min(30).max(730).optional(),
  leadTimeDays: z.number().int().min(0).max(180).optional(),
  validityDays: z.number().int().min(1).max(730).nullable().optional(),
  ownerRole: z.enum(roles).optional(),
  notes: z.string().max(2000).nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one training-plan field must be updated."
);

export const trainingCompletionCreateSchema = z.object({
  requirementId: z.string().min(1),
  completedAt: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  note: z.string().max(2000).nullable().optional()
});
