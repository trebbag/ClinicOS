import { z } from "zod";
import { randomId } from "../common";
import { roles } from "../enums";
import { checklistItemRecordSchema, checklistRunSchema } from "./checklist";

export const roomTypeSchema = z.enum([
  "front_desk",
  "exam",
  "procedure",
  "lab",
  "virtual",
  "common"
]);

export const roomStatusSchema = z.enum([
  "active",
  "inactive",
  "maintenance"
]);

export const roomReadinessStatusSchema = z.enum([
  "ready",
  "attention_needed",
  "blocked",
  "inactive"
]);

export const roomRecordSchema = z.object({
  id: z.string(),
  roomLabel: z.string(),
  roomType: roomTypeSchema,
  status: roomStatusSchema,
  checklistAreaLabel: z.string(),
  notes: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const roomReadinessSummarySchema = z.object({
  room: roomRecordSchema,
  checklistRun: checklistRunSchema.nullable(),
  checklistItems: z.array(checklistItemRecordSchema),
  readinessStatus: roomReadinessStatusSchema,
  counts: z.object({
    totalItems: z.number().int().nonnegative(),
    completedItems: z.number().int().nonnegative(),
    blockedItems: z.number().int().nonnegative(),
    waivedItems: z.number().int().nonnegative(),
    pendingItems: z.number().int().nonnegative(),
    requiredRemaining: z.number().int().nonnegative()
  })
});

export const roomReadinessTrendBucketSchema = z.object({
  targetDate: z.string(),
  readyRooms: z.number().int().nonnegative(),
  attentionNeededRooms: z.number().int().nonnegative(),
  blockedRooms: z.number().int().nonnegative(),
  inactiveRooms: z.number().int().nonnegative()
});

export const roomAnalyticsItemSchema = z.object({
  roomId: z.string(),
  roomLabel: z.string(),
  roomType: roomTypeSchema,
  trackedDays: z.number().int().nonnegative(),
  readyDays: z.number().int().nonnegative(),
  attentionNeededDays: z.number().int().nonnegative(),
  blockedDays: z.number().int().nonnegative(),
  inactiveDays: z.number().int().nonnegative(),
  missedRequiredItems: z.number().int().nonnegative(),
  repeatAttentionDays: z.number().int().nonnegative(),
  averageCompletionLatencyMinutes: z.number().nonnegative().nullable()
});

export const checklistTrendSummarySchema = z.object({
  totalRuns: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  completedItems: z.number().int().nonnegative(),
  blockedItems: z.number().int().nonnegative(),
  waivedItems: z.number().int().nonnegative(),
  pendingItems: z.number().int().nonnegative(),
  missedRequiredItems: z.number().int().nonnegative(),
  averageCompletionLatencyMinutes: z.number().nonnegative().nullable()
});

export const plannerReconciliationSummarySchema = z.object({
  pendingCreate: z.number().int().nonnegative(),
  synced: z.number().int().nonnegative(),
  syncErrors: z.number().int().nonnegative(),
  externallyCompleted: z.number().int().nonnegative(),
  openActionItems: z.number().int().nonnegative(),
  overdueOpenActionItems: z.number().int().nonnegative(),
  agingBuckets: z.object({
    underSevenDays: z.number().int().nonnegative(),
    sevenToThirtyDays: z.number().int().nonnegative(),
    overThirtyDays: z.number().int().nonnegative()
  }),
  workflowTypeBreakdown: z.array(z.object({
    workflowType: z.string(),
    openActionItems: z.number().int().nonnegative(),
    overdueOpenActionItems: z.number().int().nonnegative(),
    pendingCreate: z.number().int().nonnegative(),
    syncErrors: z.number().int().nonnegative()
  }))
});

export const checklistTemplatePerformanceSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  workflowDefinitionId: z.string(),
  totalRuns: z.number().int().nonnegative(),
  blockedItems: z.number().int().nonnegative(),
  missedRequiredItems: z.number().int().nonnegative(),
  averageCompletionLatencyMinutes: z.number().nonnegative().nullable()
});

export const repeatAttentionRoomSchema = z.object({
  roomId: z.string(),
  roomLabel: z.string(),
  roomType: roomTypeSchema,
  attentionDays: z.number().int().nonnegative(),
  blockedDays: z.number().int().nonnegative(),
  missedRequiredItems: z.number().int().nonnegative()
});

export const roomAnalyticsSummarySchema = z.object({
  generatedAt: z.string(),
  dateRangeStart: z.string(),
  dateRangeEnd: z.string(),
  roomId: z.string().nullable().default(null),
  roomType: roomTypeSchema.nullable().default(null),
  readinessTrend: z.array(roomReadinessTrendBucketSchema),
  rooms: z.array(roomAnalyticsItemSchema),
  checklist: checklistTrendSummarySchema,
  plannerReconciliation: plannerReconciliationSummarySchema,
  templatePerformance: z.array(checklistTemplatePerformanceSchema),
  repeatAttentionRooms: z.array(repeatAttentionRoomSchema)
});

export const roomCreateSchema = z.object({
  id: z.string().min(2),
  roomLabel: z.string().min(2),
  roomType: roomTypeSchema,
  status: roomStatusSchema.default("active"),
  checklistAreaLabel: z.string().min(2),
  notes: z.string().max(2000).nullable().optional()
});

export const roomUpdateSchema = z.object({
  roomLabel: z.string().min(2).optional(),
  roomType: roomTypeSchema.optional(),
  status: roomStatusSchema.optional(),
  checklistAreaLabel: z.string().min(2).optional(),
  notes: z.string().max(2000).nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one room field must be updated."
);

export type RoomType = z.infer<typeof roomTypeSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type RoomReadinessStatus = z.infer<typeof roomReadinessStatusSchema>;
export type RoomRecord = z.infer<typeof roomRecordSchema>;
export type RoomReadinessSummary = z.infer<typeof roomReadinessSummarySchema>;
export type RoomReadinessTrendBucket = z.infer<typeof roomReadinessTrendBucketSchema>;
export type RoomAnalyticsItem = z.infer<typeof roomAnalyticsItemSchema>;
export type ChecklistTrendSummary = z.infer<typeof checklistTrendSummarySchema>;
export type PlannerReconciliationSummary = z.infer<typeof plannerReconciliationSummarySchema>;
export type ChecklistTemplatePerformance = z.infer<typeof checklistTemplatePerformanceSchema>;
export type RepeatAttentionRoom = z.infer<typeof repeatAttentionRoomSchema>;
export type RoomAnalyticsSummary = z.infer<typeof roomAnalyticsSummarySchema>;
export type RoomCreateCommand = z.infer<typeof roomCreateSchema>;
export type RoomUpdateCommand = z.infer<typeof roomUpdateSchema>;

export function createRoomRecord(input: {
  id: string;
  roomLabel: string;
  roomType: RoomType;
  status?: RoomStatus;
  checklistAreaLabel: string;
  notes?: string | null;
  createdBy: string;
}): RoomRecord {
  const now = new Date().toISOString();
  return roomRecordSchema.parse({
    id: input.id,
    roomLabel: input.roomLabel,
    roomType: input.roomType,
    status: input.status ?? "active",
    checklistAreaLabel: input.checklistAreaLabel,
    notes: input.notes ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  });
}

export function defaultRoomTemplates(createdBy: string): RoomRecord[] {
  return [
    createRoomRecord({
      id: "front_desk",
      roomLabel: "Front Desk",
      roomType: "front_desk",
      checklistAreaLabel: "Front desk",
      createdBy
    }),
    createRoomRecord({
      id: "exam_room_1",
      roomLabel: "Exam Room 1",
      roomType: "exam",
      checklistAreaLabel: "Exam room 1",
      createdBy
    }),
    createRoomRecord({
      id: "exam_room_2",
      roomLabel: "Exam Room 2",
      roomType: "exam",
      checklistAreaLabel: "Exam room 2",
      createdBy
    }),
    createRoomRecord({
      id: "lab_station",
      roomLabel: "Lab Station",
      roomType: "lab",
      checklistAreaLabel: "Lab station",
      createdBy
    })
  ];
}
