ALTER TABLE "ActionItem"
  ADD COLUMN "plannerTaskId" TEXT,
  ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'not_synced',
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncError" TEXT,
  ADD COLUMN "completedExternallyAt" TIMESTAMP(3);

ALTER TABLE "ScorecardReviewRecord"
  ADD COLUMN "trainingFollowUpActionItemId" TEXT;

CREATE INDEX "ActionItem_plannerTaskId_idx" ON "ActionItem"("plannerTaskId");

CREATE TABLE "ChecklistTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "workflowDefinitionId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL,
  "itemsJson" JSONB NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistTemplate_workflowDefinitionId_isActive_idx"
  ON "ChecklistTemplate"("workflowDefinitionId", "isActive");

CREATE TABLE "ChecklistRun" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "targetDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistRun_workflowRunId_targetDate_idx"
  ON "ChecklistRun"("workflowRunId", "targetDate");
CREATE INDEX "ChecklistRun_templateId_idx"
  ON "ChecklistRun"("templateId");

CREATE TABLE "ChecklistItemRecord" (
  "id" TEXT NOT NULL,
  "checklistRunId" TEXT NOT NULL,
  "templateItemId" TEXT,
  "label" TEXT NOT NULL,
  "areaLabel" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "reviewActionItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistItemRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistItemRecord_checklistRunId_status_idx"
  ON "ChecklistItemRecord"("checklistRunId", "status");

CREATE TABLE "TrainingRequirement" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeRole" TEXT NOT NULL,
  "requirementType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "notes" TEXT,
  "lastReminderSentAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingRequirement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingRequirement_employeeId_employeeRole_requirementType_idx"
  ON "TrainingRequirement"("employeeId", "employeeRole", "requirementType");

CREATE TABLE "TrainingCompletionRecord" (
  "id" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeRole" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "recordedBy" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingCompletionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingCompletionRecord_requirementId_completedAt_idx"
  ON "TrainingCompletionRecord"("requirementId", "completedAt");
CREATE INDEX "TrainingCompletionRecord_employeeId_employeeRole_completedAt_idx"
  ON "TrainingCompletionRecord"("employeeId", "employeeRole", "completedAt");
