CREATE TABLE "ServiceLineRecord" (
  "id" TEXT NOT NULL,
  "ownerRole" TEXT,
  "governanceStatus" TEXT NOT NULL,
  "hasCharter" BOOLEAN NOT NULL DEFAULT false,
  "hasCompetencyMatrix" BOOLEAN NOT NULL DEFAULT false,
  "hasAuditTool" BOOLEAN NOT NULL DEFAULT false,
  "hasClaimsInventory" BOOLEAN NOT NULL DEFAULT false,
  "reviewCadenceDays" INTEGER NOT NULL,
  "lastReviewedAt" TIMESTAMP(3),
  "nextReviewDueAt" TIMESTAMP(3),
  "latestPackId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceLineRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceLinePack" (
  "id" TEXT NOT NULL,
  "serviceLineId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "charterSummary" TEXT NOT NULL,
  "inclusionExclusionRules" TEXT NOT NULL,
  "roleMatrixSummary" TEXT NOT NULL,
  "competencyRequirements" TEXT NOT NULL,
  "auditToolSummary" TEXT NOT NULL,
  "emergencyEscalation" TEXT NOT NULL,
  "pricingModelSummary" TEXT NOT NULL,
  "claimsGovernanceSummary" TEXT NOT NULL,
  "notes" TEXT,
  "documentId" TEXT,
  "workflowRunId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "publishedPath" TEXT,

  CONSTRAINT "ServiceLinePack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceLinePack_documentId_key" ON "ServiceLinePack"("documentId");
CREATE UNIQUE INDEX "ServiceLinePack_workflowRunId_key" ON "ServiceLinePack"("workflowRunId");
CREATE INDEX "ServiceLineRecord_governanceStatus_nextReviewDueAt_idx" ON "ServiceLineRecord"("governanceStatus", "nextReviewDueAt");
CREATE INDEX "ServiceLinePack_serviceLineId_status_idx" ON "ServiceLinePack"("serviceLineId", "status");
