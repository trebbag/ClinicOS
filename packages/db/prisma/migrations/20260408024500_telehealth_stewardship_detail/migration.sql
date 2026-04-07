CREATE TABLE "TelehealthStewardship" (
  "id" TEXT NOT NULL,
  "serviceLineId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "supervisingPhysicianRole" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "linkedPracticeAgreementId" TEXT,
  "delegatedTaskCodesJson" JSONB NOT NULL,
  "modalityScopeSummary" TEXT NOT NULL,
  "stateCoverageSummary" TEXT NOT NULL,
  "patientIdentitySummary" TEXT NOT NULL,
  "consentWorkflowSummary" TEXT NOT NULL,
  "documentationStandardSummary" TEXT NOT NULL,
  "emergencyRedirectSummary" TEXT NOT NULL,
  "qaReviewSummary" TEXT NOT NULL,
  "reviewCadenceDays" INTEGER NOT NULL,
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

  CONSTRAINT "TelehealthStewardship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelehealthStewardship_documentId_key"
  ON "TelehealthStewardship"("documentId");

CREATE UNIQUE INDEX "TelehealthStewardship_workflowRunId_key"
  ON "TelehealthStewardship"("workflowRunId");

CREATE INDEX "TelehealthStewardship_serviceLineId_status_idx"
  ON "TelehealthStewardship"("serviceLineId", "status");

CREATE INDEX "TelehealthStewardship_ownerRole_status_idx"
  ON "TelehealthStewardship"("ownerRole", "status");

CREATE INDEX "TelehealthStewardship_linkedPracticeAgreementId_idx"
  ON "TelehealthStewardship"("linkedPracticeAgreementId");
