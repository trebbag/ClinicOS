import { z } from "zod";
import { roles, type Role } from "../enums";
import { randomId } from "../common";

export const scorecardReviewStatusSchema = z.enum([
  "pending_hr_review",
  "pending_medical_director_review",
  "signed_off",
  "sent_back"
]);

export const scorecardOversightStatusSchema = z.enum([
  "not_required",
  "pending",
  "signed_off"
]);

export const scorecardReviewRecordSchema = z.object({
  id: z.string(),
  workflowRunId: z.string(),
  packetDocumentId: z.string(),
  actionItemId: z.string(),
  medicalDirectorActionItemId: z.string().nullable().default(null),
  trainingFollowUpActionItemId: z.string().nullable().default(null),
  employeeId: z.string(),
  employeeRole: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  overallScore: z.number(),
  safetyComplianceScore: z.number(),
  assignedReviewerRole: z.enum(roles),
  status: scorecardReviewStatusSchema,
  oversightStatus: scorecardOversightStatusSchema,
  requiresMedicalDirectorReview: z.boolean(),
  dueDate: z.string(),
  resolutionNote: z.string().nullable().default(null),
  hrSignedOffAt: z.string().nullable().default(null),
  medicalDirectorSignedOffAt: z.string().nullable().default(null),
  escalatedAt: z.string().nullable().default(null),
  sentBackAt: z.string().nullable().default(null),
  reminderSentAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ScorecardReviewStatus = z.infer<typeof scorecardReviewStatusSchema>;
export type ScorecardOversightStatus = z.infer<typeof scorecardOversightStatusSchema>;
export type ScorecardReviewRecord = z.infer<typeof scorecardReviewRecordSchema>;

export function createScorecardReviewRecord(input: {
  workflowRunId: string;
  packetDocumentId: string;
  actionItemId: string;
  medicalDirectorActionItemId?: string | null;
  trainingFollowUpActionItemId?: string | null;
  employeeId: string;
  employeeRole: string;
  periodStart: string;
  periodEnd: string;
  overallScore: number;
  safetyComplianceScore: number;
  dueDate: string;
  assignedReviewerRole?: Role;
  requiresMedicalDirectorReview?: boolean;
  oversightStatus?: ScorecardOversightStatus;
  status?: ScorecardReviewStatus;
}): ScorecardReviewRecord {
  const now = new Date().toISOString();
  return scorecardReviewRecordSchema.parse({
    id: randomId("scorecard_review"),
    workflowRunId: input.workflowRunId,
    packetDocumentId: input.packetDocumentId,
    actionItemId: input.actionItemId,
    medicalDirectorActionItemId: input.medicalDirectorActionItemId ?? null,
    trainingFollowUpActionItemId: input.trainingFollowUpActionItemId ?? null,
    employeeId: input.employeeId,
    employeeRole: input.employeeRole,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    overallScore: input.overallScore,
    safetyComplianceScore: input.safetyComplianceScore,
    assignedReviewerRole: input.assignedReviewerRole ?? "hr_lead",
    status: input.status ?? "pending_hr_review",
    oversightStatus: input.oversightStatus ?? (input.requiresMedicalDirectorReview ? "pending" : "not_required"),
    requiresMedicalDirectorReview: input.requiresMedicalDirectorReview ?? false,
    dueDate: input.dueDate,
    resolutionNote: null,
    hrSignedOffAt: null,
    medicalDirectorSignedOffAt: null,
    escalatedAt: null,
    sentBackAt: null,
    reminderSentAt: null,
    createdAt: now,
    updatedAt: now
  });
}
