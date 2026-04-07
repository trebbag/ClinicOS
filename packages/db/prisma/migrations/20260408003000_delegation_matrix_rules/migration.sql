CREATE TABLE "DelegationRule" (
  "id" TEXT NOT NULL,
  "serviceLineId" TEXT NOT NULL,
  "taskCode" TEXT NOT NULL,
  "taskLabel" TEXT NOT NULL,
  "performerRole" TEXT NOT NULL,
  "supervisingRole" TEXT,
  "status" TEXT NOT NULL,
  "supervisionLevel" TEXT NOT NULL,
  "requiresCompetencyEvidence" BOOLEAN NOT NULL,
  "requiresDocumentedOrder" BOOLEAN NOT NULL,
  "requiresCosign" BOOLEAN NOT NULL,
  "patientFacing" BOOLEAN NOT NULL,
  "evidenceRequired" TEXT NOT NULL,
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DelegationRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DelegationRule_serviceLineId_taskCode_performerRole_key"
  ON "DelegationRule"("serviceLineId", "taskCode", "performerRole");

CREATE INDEX "DelegationRule_serviceLineId_status_idx"
  ON "DelegationRule"("serviceLineId", "status");

CREATE INDEX "DelegationRule_performerRole_status_idx"
  ON "DelegationRule"("performerRole", "status");
