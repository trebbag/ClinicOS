import { z } from "zod";
import { actionItemRecordSchema } from "./actionItem";
import { checklistItemRecordSchema, checklistRunSchema } from "./checklist";
import { documentRecordSchema } from "./document";
import { roomReadinessSummarySchema } from "./room";
import { trainingGapSummarySchema } from "./training";
import { workerJobRecordSchema } from "./worker";
import { workflowRunSchema } from "./workflow";

export const officeOpsDailyStatusSchema = z.object({
  targetDate: z.string(),
  closeoutDueAt: z.string(),
  closeoutCutoffStatus: z.enum(["before_cutoff", "due_soon", "overdue"]),
  closeoutSubmitted: z.boolean(),
  workflowRun: workflowRunSchema.nullable(),
  dailyPacket: documentRecordSchema.nullable(),
  closeoutDocument: documentRecordSchema.nullable(),
  checklistRun: checklistRunSchema.nullable(),
  checklistRuns: z.array(checklistRunSchema),
  checklistItems: z.array(checklistItemRecordSchema),
  rooms: z.array(roomReadinessSummarySchema),
  roomSummary: z.object({
    activeRooms: z.number().int().nonnegative(),
    readyRooms: z.number().int().nonnegative(),
    attentionNeededRooms: z.number().int().nonnegative(),
    blockedRooms: z.number().int().nonnegative(),
    inactiveRooms: z.number().int().nonnegative()
  }),
  issues: z.array(actionItemRecordSchema),
  routineItems: z.array(actionItemRecordSchema),
  escalations: z.array(actionItemRecordSchema),
  relatedJobs: z.array(workerJobRecordSchema),
  checklist: z.object({
    totalItems: z.number().int().nonnegative(),
    completedItems: z.number().int().nonnegative(),
    blockedItems: z.number().int().nonnegative(),
    waivedItems: z.number().int().nonnegative(),
    pendingItems: z.number().int().nonnegative(),
    requiredRemaining: z.number().int().nonnegative()
  }),
  plannerSync: z.object({
    pendingCreate: z.number().int().nonnegative(),
    synced: z.number().int().nonnegative(),
    syncErrors: z.number().int().nonnegative(),
    externallyCompleted: z.number().int().nonnegative()
  }),
  counts: z.object({
    openIssues: z.number().int().nonnegative(),
    overdueItems: z.number().int().nonnegative(),
    escalatedItems: z.number().int().nonnegative()
  })
});

export const scorecardHistoryPointSchema = z.object({
  employeeId: z.string(),
  employeeRole: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  overallScore: z.number(),
  previousOverallScore: z.number().nullable(),
  overallDelta: z.number().nullable(),
  rollingAverageOverallScore: z.number().nullable(),
  openTrainingGapCount: z.number().int().nonnegative(),
  buckets: z.array(
    z.object({
      name: z.string(),
      score: z.number(),
      previousScore: z.number().nullable(),
      delta: z.number().nullable()
    })
  ),
  trainingGapSummary: trainingGapSummarySchema
});

export type OfficeOpsDailyStatus = z.infer<typeof officeOpsDailyStatusSchema>;
export type ScorecardHistoryPoint = z.infer<typeof scorecardHistoryPointSchema>;
