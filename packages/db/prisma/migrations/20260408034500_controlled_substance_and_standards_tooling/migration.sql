CREATE TABLE "ControlledSubstanceStewardship" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "supervisingPhysicianRole" TEXT NOT NULL,
  "serviceLineIdsJson" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "linkedPracticeAgreementId" TEXT,
  "prescribingScopeSummary" TEXT NOT NULL,
  "pdmpReviewSummary" TEXT NOT NULL,
  "screeningProtocolSummary" TEXT NOT NULL,
  "refillEscalationSummary" TEXT NOT NULL,
  "inventoryControlSummary" TEXT NOT NULL,
  "patientEducationSummary" TEXT NOT NULL,
  "adverseEventEscalationSummary" TEXT NOT NULL,
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

  CONSTRAINT "ControlledSubstanceStewardship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StandardMapping" (
  "id" TEXT NOT NULL,
  "standardCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "sourceAuthority" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requirementSummary" TEXT NOT NULL,
  "evidenceExpectation" TEXT NOT NULL,
  "evidenceDocumentIdsJson" JSONB NOT NULL,
  "latestBinderId" TEXT,
  "reviewCadenceDays" INTEGER NOT NULL,
  "lastReviewedAt" TIMESTAMP(3),
  "nextReviewDueAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StandardMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceBinder" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sourceAuthority" TEXT NOT NULL,
  "surveyWindowLabel" TEXT,
  "standardIdsJson" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "evidenceReadinessSummary" TEXT NOT NULL,
  "openGapSummary" TEXT NOT NULL,
  "reviewCadenceDays" INTEGER NOT NULL,
  "notes" TEXT,
  "documentId" TEXT,
  "workflowRunId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "publishedPath" TEXT,

  CONSTRAINT "EvidenceBinder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ControlledSubstanceStewardship_documentId_key"
  ON "ControlledSubstanceStewardship"("documentId");

CREATE UNIQUE INDEX "ControlledSubstanceStewardship_workflowRunId_key"
  ON "ControlledSubstanceStewardship"("workflowRunId");

CREATE INDEX "ControlledSubstanceStewardship_status_ownerRole_idx"
  ON "ControlledSubstanceStewardship"("status", "ownerRole");

CREATE INDEX "ControlledSubstanceStewardship_supervisingPhysicianRole_status_idx"
  ON "ControlledSubstanceStewardship"("supervisingPhysicianRole", "status");

CREATE INDEX "ControlledSubstanceStewardship_linkedPracticeAgreementId_idx"
  ON "ControlledSubstanceStewardship"("linkedPracticeAgreementId");

CREATE UNIQUE INDEX "StandardMapping_standardCode_sourceAuthority_key"
  ON "StandardMapping"("standardCode", "sourceAuthority");

CREATE INDEX "StandardMapping_domain_status_idx"
  ON "StandardMapping"("domain", "status");

CREATE INDEX "StandardMapping_ownerRole_status_idx"
  ON "StandardMapping"("ownerRole", "status");

CREATE UNIQUE INDEX "EvidenceBinder_documentId_key"
  ON "EvidenceBinder"("documentId");

CREATE UNIQUE INDEX "EvidenceBinder_workflowRunId_key"
  ON "EvidenceBinder"("workflowRunId");

CREATE INDEX "EvidenceBinder_status_ownerRole_idx"
  ON "EvidenceBinder"("status", "ownerRole");

CREATE INDEX "EvidenceBinder_sourceAuthority_status_idx"
  ON "EvidenceBinder"("sourceAuthority", "status");
