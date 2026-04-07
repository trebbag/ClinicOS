import { z } from "zod";
import { randomId } from "../common";
import { roles, type Role } from "../enums";

export const incidentSeveritySchema = z.enum(["low", "moderate", "high", "critical"]);

export const incidentStatusSchema = z.enum([
  "open",
  "under_review",
  "capa_open",
  "closed"
]);

export const incidentRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: incidentSeveritySchema,
  category: z.string(),
  detectedAt: z.string(),
  detectedByRole: z.enum(roles),
  ownerRole: z.enum(roles),
  status: incidentStatusSchema,
  summary: z.string(),
  immediateResponse: z.string().nullable().default(null),
  resolutionNote: z.string().nullable().default(null),
  workflowRunId: z.string().nullable().default(null),
  reviewActionItemId: z.string().nullable().default(null),
  linkedCapaId: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  closedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const incidentCreateSchema = z.object({
  title: z.string().min(3),
  severity: incidentSeveritySchema,
  category: z.string().min(2),
  summary: z.string().min(5).max(4000),
  detectedAt: z.string().optional(),
  immediateResponse: z.string().max(2000).optional(),
  ownerRole: z.enum(roles).default("quality_lead"),
  dueDate: z.string().optional()
});

export const incidentUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  severity: incidentSeveritySchema.optional(),
  category: z.string().min(2).optional(),
  summary: z.string().min(5).max(4000).optional(),
  immediateResponse: z.string().max(2000).nullable().optional(),
  resolutionNote: z.string().max(2000).nullable().optional(),
  ownerRole: z.enum(roles).optional(),
  dueDate: z.string().nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one incident field must be updated."
);

export const incidentReviewDecisionCommandSchema = z.object({
  decision: z.enum(["log_review", "open_capa", "close_incident"]),
  notes: z.string().max(2000).optional(),
  ownerRole: z.enum(roles).optional(),
  dueDate: z.string().optional(),
  capaTitle: z.string().min(3).max(200).optional(),
  capaSummary: z.string().min(5).max(4000).optional(),
  correctiveAction: z.string().max(4000).optional(),
  preventiveAction: z.string().max(4000).optional(),
  verificationPlan: z.string().max(2000).optional()
}).superRefine((value, ctx) => {
  if (value.decision !== "open_capa") {
    return;
  }

  for (const [field, message] of [
    ["ownerRole", "CAPA owner role is required when opening a CAPA."],
    ["dueDate", "CAPA due date is required when opening a CAPA."],
    ["correctiveAction", "Corrective action is required when opening a CAPA."],
    ["preventiveAction", "Preventive action is required when opening a CAPA."]
  ] as const) {
    if (!value[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [field]
      });
    }
  }
});

export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;
export type IncidentRecord = z.infer<typeof incidentRecordSchema>;
export type Incident = IncidentRecord;

export function createIncidentRecord(input: {
  title: string;
  severity: IncidentSeverity;
  category: string;
  summary: string;
  detectedByRole: Role;
  ownerRole?: Role;
  detectedAt?: string;
  immediateResponse?: string | null;
  resolutionNote?: string | null;
  workflowRunId?: string | null;
  reviewActionItemId?: string | null;
  linkedCapaId?: string | null;
  dueDate?: string | null;
  closedAt?: string | null;
  status?: IncidentStatus;
}): IncidentRecord {
  const now = new Date().toISOString();
  return incidentRecordSchema.parse({
    id: randomId("incident"),
    title: input.title,
    severity: input.severity,
    category: input.category,
    detectedAt: input.detectedAt ?? now,
    detectedByRole: input.detectedByRole,
    ownerRole: input.ownerRole ?? "quality_lead",
    status: input.status ?? "open",
    summary: input.summary,
    immediateResponse: input.immediateResponse ?? null,
    resolutionNote: input.resolutionNote ?? null,
    workflowRunId: input.workflowRunId ?? null,
    reviewActionItemId: input.reviewActionItemId ?? null,
    linkedCapaId: input.linkedCapaId ?? null,
    dueDate: input.dueDate ?? null,
    closedAt: input.closedAt ?? null,
    createdAt: now,
    updatedAt: now
  });
}
