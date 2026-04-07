import { z } from "zod";
import { randomId } from "../common";
import { roles, serviceLines, type Role, type ServiceLine } from "../enums";

export const practiceAgreementTypeSchema = z.enum([
  "practice_agreement",
  "physician_oversight_plan",
  "standing_order_supervision"
]);

export const practiceAgreementStatusSchema = z.enum([
  "draft",
  "approval_pending",
  "approved",
  "publish_pending",
  "published",
  "sent_back",
  "archived",
  "expired"
]);

export const practiceAgreementRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  agreementType: practiceAgreementTypeSchema,
  status: practiceAgreementStatusSchema,
  ownerRole: z.enum(roles),
  supervisingPhysicianName: z.string(),
  supervisingPhysicianRole: z.enum(roles),
  supervisedRole: z.enum(roles),
  serviceLineIds: z.array(z.enum(serviceLines)).min(1),
  scopeSummary: z.string(),
  delegatedActivitiesSummary: z.string(),
  cosignExpectation: z.string(),
  escalationProtocol: z.string(),
  reviewCadenceDays: z.number().int().positive().max(365),
  effectiveDate: z.string().nullable().default(null),
  reviewDueAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  documentId: z.string().nullable().default(null),
  workflowRunId: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable().default(null),
  publishedPath: z.string().nullable().default(null)
});

const sharedFields = {
  title: z.string().min(3),
  agreementType: practiceAgreementTypeSchema,
  ownerRole: z.enum(roles),
  supervisingPhysicianName: z.string().min(3).max(200),
  supervisingPhysicianRole: z.enum(roles),
  supervisedRole: z.enum(roles),
  serviceLineIds: z.array(z.enum(serviceLines)).min(1),
  scopeSummary: z.string().min(10),
  delegatedActivitiesSummary: z.string().min(10),
  cosignExpectation: z.string().min(10),
  escalationProtocol: z.string().min(10),
  reviewCadenceDays: z.number().int().positive().max(365).optional(),
  effectiveDate: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  notes: z.string().max(2000).optional()
} as const;

export const practiceAgreementCreateSchema = z.object(sharedFields).superRefine((value, ctx) => {
  if (value.effectiveDate && value.expiresAt && value.expiresAt <= value.effectiveDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expiration must be later than the effective date.",
      path: ["expiresAt"]
    });
  }
});

export const practiceAgreementUpdateSchema = z.object({
  title: sharedFields.title.optional(),
  agreementType: sharedFields.agreementType.optional(),
  ownerRole: sharedFields.ownerRole.optional(),
  supervisingPhysicianName: sharedFields.supervisingPhysicianName.optional(),
  supervisingPhysicianRole: sharedFields.supervisingPhysicianRole.optional(),
  supervisedRole: sharedFields.supervisedRole.optional(),
  serviceLineIds: sharedFields.serviceLineIds.optional(),
  scopeSummary: sharedFields.scopeSummary.optional(),
  delegatedActivitiesSummary: sharedFields.delegatedActivitiesSummary.optional(),
  cosignExpectation: sharedFields.cosignExpectation.optional(),
  escalationProtocol: sharedFields.escalationProtocol.optional(),
  reviewCadenceDays: sharedFields.reviewCadenceDays,
  effectiveDate: sharedFields.effectiveDate,
  expiresAt: sharedFields.expiresAt,
  notes: sharedFields.notes.nullable().optional(),
  status: practiceAgreementStatusSchema.optional()
}).superRefine((value, ctx) => {
  if (!Object.values(value).some((entry) => entry !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one practice-agreement field must be updated."
    });
  }
  if (value.effectiveDate && value.expiresAt && value.expiresAt <= value.effectiveDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expiration must be later than the effective date.",
      path: ["expiresAt"]
    });
  }
});

export type PracticeAgreementType = z.infer<typeof practiceAgreementTypeSchema>;
export type PracticeAgreementStatus = z.infer<typeof practiceAgreementStatusSchema>;
export type PracticeAgreementRecord = z.infer<typeof practiceAgreementRecordSchema>;
export type PracticeAgreementCreateCommand = z.infer<typeof practiceAgreementCreateSchema>;
export type PracticeAgreementUpdateCommand = z.infer<typeof practiceAgreementUpdateSchema>;

export function createPracticeAgreementRecord(input: {
  title: string;
  agreementType: PracticeAgreementType;
  ownerRole: Role;
  supervisingPhysicianName: string;
  supervisingPhysicianRole: Role;
  supervisedRole: Role;
  serviceLineIds: ServiceLine[];
  scopeSummary: string;
  delegatedActivitiesSummary: string;
  cosignExpectation: string;
  escalationProtocol: string;
  reviewCadenceDays?: number;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  documentId?: string | null;
  workflowRunId?: string | null;
  createdBy: string;
}): PracticeAgreementRecord {
  const now = new Date().toISOString();
  return practiceAgreementRecordSchema.parse({
    id: randomId("practice_agreement"),
    title: input.title,
    agreementType: input.agreementType,
    status: "draft",
    ownerRole: input.ownerRole,
    supervisingPhysicianName: input.supervisingPhysicianName,
    supervisingPhysicianRole: input.supervisingPhysicianRole,
    supervisedRole: input.supervisedRole,
    serviceLineIds: input.serviceLineIds,
    scopeSummary: input.scopeSummary,
    delegatedActivitiesSummary: input.delegatedActivitiesSummary,
    cosignExpectation: input.cosignExpectation,
    escalationProtocol: input.escalationProtocol,
    reviewCadenceDays: input.reviewCadenceDays ?? 90,
    effectiveDate: input.effectiveDate ?? null,
    reviewDueAt: null,
    expiresAt: input.expiresAt ?? null,
    notes: input.notes ?? null,
    documentId: input.documentId ?? null,
    workflowRunId: input.workflowRunId ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishedPath: null
  });
}
