import { z } from "zod";
import { randomId } from "../common";

export const checklistItemStatusSchema = z.enum([
  "pending",
  "complete",
  "blocked",
  "waived"
]);

export const checklistTemplateItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  areaLabel: z.string(),
  required: z.boolean().default(true)
});

export const checklistTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  workflowDefinitionId: z.string(),
  isActive: z.boolean(),
  items: z.array(checklistTemplateItemSchema).min(1),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const checklistRunSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  workflowRunId: z.string(),
  roomId: z.string().nullable().default(null),
  targetDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const checklistItemRecordSchema = z.object({
  id: z.string(),
  checklistRunId: z.string(),
  templateItemId: z.string().nullable().default(null),
  label: z.string(),
  areaLabel: z.string(),
  required: z.boolean(),
  status: checklistItemStatusSchema,
  note: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
  completedBy: z.string().nullable().default(null),
  reviewActionItemId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ChecklistTemplateItem = z.infer<typeof checklistTemplateItemSchema>;
export type ChecklistTemplate = z.infer<typeof checklistTemplateSchema>;
export type ChecklistRun = z.infer<typeof checklistRunSchema>;
export type ChecklistItemRecord = z.infer<typeof checklistItemRecordSchema>;
export type ChecklistItemStatus = z.infer<typeof checklistItemStatusSchema>;

export function createChecklistTemplate(input: {
  name: string;
  workflowDefinitionId: string;
  isActive?: boolean;
  items: Array<{
    id?: string;
    label: string;
    areaLabel: string;
    required?: boolean;
  }>;
  createdBy: string;
}): ChecklistTemplate {
  const now = new Date().toISOString();
  return checklistTemplateSchema.parse({
    id: randomId("checklist_template"),
    name: input.name,
    workflowDefinitionId: input.workflowDefinitionId,
    isActive: input.isActive ?? true,
    items: input.items.map((item) => ({
      id: item.id ?? randomId("checklist_template_item"),
      label: item.label,
      areaLabel: item.areaLabel,
      required: item.required ?? true
    })),
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  });
}

export function createChecklistRun(input: {
  templateId: string;
  workflowRunId: string;
  roomId?: string | null;
  targetDate: string;
}): ChecklistRun {
  const now = new Date().toISOString();
  return checklistRunSchema.parse({
    id: randomId("checklist_run"),
    templateId: input.templateId,
    workflowRunId: input.workflowRunId,
    roomId: input.roomId ?? null,
    targetDate: input.targetDate,
    createdAt: now,
    updatedAt: now
  });
}

export function createChecklistItemRecord(input: {
  checklistRunId: string;
  templateItemId?: string | null;
  label: string;
  areaLabel: string;
  required?: boolean;
  reviewActionItemId?: string | null;
}): ChecklistItemRecord {
  const now = new Date().toISOString();
  return checklistItemRecordSchema.parse({
    id: randomId("checklist_item"),
    checklistRunId: input.checklistRunId,
    templateItemId: input.templateItemId ?? null,
    label: input.label,
    areaLabel: input.areaLabel,
    required: input.required ?? true,
    status: "pending",
    note: null,
    completedAt: null,
    completedBy: null,
    reviewActionItemId: input.reviewActionItemId ?? null,
    createdAt: now,
    updatedAt: now
  });
}
