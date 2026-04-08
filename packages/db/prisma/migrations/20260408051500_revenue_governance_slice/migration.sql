CREATE TABLE "PayerIssue" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "payerName" TEXT NOT NULL,
  "issueType" TEXT NOT NULL,
  "serviceLineId" TEXT,
  "ownerRole" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "financialImpactSummary" TEXT,
  "dueDate" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "actionItemId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),

  CONSTRAINT "PayerIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingGovernance" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "serviceLineId" TEXT,
  "ownerRole" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "pricingSummary" TEXT NOT NULL,
  "marginGuardrailsSummary" TEXT NOT NULL,
  "discountGuardrailsSummary" TEXT NOT NULL,
  "payerAlignmentSummary" TEXT NOT NULL,
  "claimsConstraintSummary" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3),
  "reviewDueAt" TIMESTAMP(3),
  "notes" TEXT,
  "documentId" TEXT,
  "workflowRunId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "publishedPath" TEXT,

  CONSTRAINT "PricingGovernance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueReview" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "serviceLineId" TEXT,
  "reviewWindowLabel" TEXT NOT NULL,
  "targetReviewDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "summaryNote" TEXT,
  "linkedCommitteeId" TEXT,
  "snapshotJson" JSONB NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RevenueReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayerIssue_status_ownerRole_idx"
  ON "PayerIssue"("status", "ownerRole");

CREATE INDEX "PayerIssue_serviceLineId_status_idx"
  ON "PayerIssue"("serviceLineId", "status");

CREATE INDEX "PayerIssue_dueDate_idx"
  ON "PayerIssue"("dueDate");

CREATE UNIQUE INDEX "PricingGovernance_documentId_key"
  ON "PricingGovernance"("documentId");

CREATE UNIQUE INDEX "PricingGovernance_workflowRunId_key"
  ON "PricingGovernance"("workflowRunId");

CREATE INDEX "PricingGovernance_status_ownerRole_idx"
  ON "PricingGovernance"("status", "ownerRole");

CREATE INDEX "PricingGovernance_serviceLineId_status_idx"
  ON "PricingGovernance"("serviceLineId", "status");

CREATE INDEX "PricingGovernance_reviewDueAt_idx"
  ON "PricingGovernance"("reviewDueAt");

CREATE INDEX "RevenueReview_status_ownerRole_idx"
  ON "RevenueReview"("status", "ownerRole");

CREATE INDEX "RevenueReview_serviceLineId_status_idx"
  ON "RevenueReview"("serviceLineId", "status");

CREATE INDEX "RevenueReview_targetReviewDate_idx"
  ON "RevenueReview"("targetReviewDate");
