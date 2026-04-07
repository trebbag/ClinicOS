CREATE TABLE "PracticeAgreement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "agreementType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "supervisingPhysicianName" TEXT NOT NULL,
  "supervisingPhysicianRole" TEXT NOT NULL,
  "supervisedRole" TEXT NOT NULL,
  "serviceLineIdsJson" JSONB NOT NULL,
  "scopeSummary" TEXT NOT NULL,
  "delegatedActivitiesSummary" TEXT NOT NULL,
  "cosignExpectation" TEXT NOT NULL,
  "escalationProtocol" TEXT NOT NULL,
  "reviewCadenceDays" INTEGER NOT NULL,
  "effectiveDate" TIMESTAMP(3),
  "reviewDueAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  "documentId" TEXT,
  "workflowRunId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "publishedPath" TEXT,

  CONSTRAINT "PracticeAgreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeAgreement_documentId_key"
  ON "PracticeAgreement"("documentId");

CREATE UNIQUE INDEX "PracticeAgreement_workflowRunId_key"
  ON "PracticeAgreement"("workflowRunId");

CREATE INDEX "PracticeAgreement_status_ownerRole_idx"
  ON "PracticeAgreement"("status", "ownerRole");

CREATE INDEX "PracticeAgreement_supervisedRole_status_idx"
  ON "PracticeAgreement"("supervisedRole", "status");

CREATE INDEX "PracticeAgreement_supervisingPhysicianRole_status_idx"
  ON "PracticeAgreement"("supervisingPhysicianRole", "status");
