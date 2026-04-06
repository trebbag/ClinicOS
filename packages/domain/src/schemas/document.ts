import { z } from "zod";
import { approvalClasses, serviceLines, type ServiceLine } from "../enums";
import { randomId } from "../common";

export const documentStatusSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "publish_pending",
  "published",
  "archived",
  "rejected"
]);

export const documentRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerRole: z.string(),
  approvalClass: z.enum(approvalClasses),
  artifactType: z.string(),
  summary: z.string(),
  workflowRunId: z.string().nullable().default(null),
  serviceLines: z.array(z.enum(serviceLines)).default([]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: documentStatusSchema,
  body: z.string(),
  version: z.number().int().positive(),
  publishedAt: z.string().nullable().default(null),
  publishedPath: z.string().nullable().default(null),
  reviewDueAt: z.string().nullable().default(null)
});

export type DocumentRecord = z.infer<typeof documentRecordSchema>;

export function createDraftDocument(input: {
  title: string;
  ownerRole: string;
  approvalClass: string;
  artifactType: string;
  summary?: string;
  createdBy: string;
  workflowRunId?: string | null;
  serviceLines?: ServiceLine[];
  body: string;
}): DocumentRecord {
  const now = new Date().toISOString();
  return {
    id: randomId("doc"),
    title: input.title,
    ownerRole: input.ownerRole,
    approvalClass: z.enum(approvalClasses).parse(input.approvalClass),
    artifactType: input.artifactType,
    summary: input.summary ?? "",
    workflowRunId: input.workflowRunId ?? null,
    serviceLines: input.serviceLines ?? [],
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    body: input.body,
    version: 1,
    publishedAt: null,
    publishedPath: null,
    reviewDueAt: null
  };
}
