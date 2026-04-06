ALTER TABLE "ActionItem"
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "escalationStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "escalatedToRole" TEXT,
ADD COLUMN "needsReviewAt" TIMESTAMP(3),
ADD COLUMN "escalatedAt" TIMESTAMP(3);

CREATE INDEX "ActionItem_ownerRole_status_idx" ON "ActionItem"("ownerRole", "status");
CREATE INDEX "ActionItem_escalationStatus_dueDate_idx" ON "ActionItem"("escalationStatus", "dueDate");

CREATE TABLE "ScorecardReviewRecord" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "packetDocumentId" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "medicalDirectorActionItemId" TEXT,
    "employeeId" TEXT NOT NULL,
    "employeeRole" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "safetyComplianceScore" DOUBLE PRECISION NOT NULL,
    "assignedReviewerRole" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "oversightStatus" TEXT NOT NULL,
    "requiresMedicalDirectorReview" BOOLEAN NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "resolutionNote" TEXT,
    "hrSignedOffAt" TIMESTAMP(3),
    "medicalDirectorSignedOffAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "sentBackAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardReviewRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScorecardReviewRecord_workflowRunId_status_idx" ON "ScorecardReviewRecord"("workflowRunId", "status");
CREATE INDEX "ScorecardReviewRecord_employeeId_employeeRole_periodStart_periodEnd_idx" ON "ScorecardReviewRecord"("employeeId", "employeeRole", "periodStart", "periodEnd");
CREATE INDEX "ScorecardReviewRecord_assignedReviewerRole_dueDate_idx" ON "ScorecardReviewRecord"("assignedReviewerRole", "dueDate");
