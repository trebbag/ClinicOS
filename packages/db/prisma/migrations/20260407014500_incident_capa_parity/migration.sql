ALTER TABLE "Incident"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN "ownerRole" TEXT NOT NULL DEFAULT 'quality_lead',
ADD COLUMN "immediateResponse" TEXT,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "workflowRunId" TEXT,
ADD COLUMN "reviewActionItemId" TEXT,
ADD COLUMN "linkedCapaId" TEXT,
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Incident_status_ownerRole_idx" ON "Incident"("status", "ownerRole");
CREATE INDEX "Incident_workflowRunId_idx" ON "Incident"("workflowRunId");
CREATE INDEX "Incident_linkedCapaId_idx" ON "Incident"("linkedCapaId");

ALTER TABLE "CAPA"
ADD COLUMN "title" TEXT NOT NULL DEFAULT 'CAPA',
ADD COLUMN "summary" TEXT NOT NULL DEFAULT '',
ADD COLUMN "incidentId" TEXT,
ADD COLUMN "verificationPlan" TEXT,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "workflowRunId" TEXT,
ADD COLUMN "actionItemId" TEXT,
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "CAPA"
SET "title" = CONCAT('CAPA for ', "sourceType", ' ', "sourceId")
WHERE "title" = 'CAPA';

UPDATE "CAPA"
SET "summary" = COALESCE(NULLIF("correctiveAction", ''), 'CAPA opened from legacy record.')
WHERE "summary" = '';

CREATE INDEX "CAPA_status_ownerRole_idx" ON "CAPA"("status", "ownerRole");
CREATE INDEX "CAPA_incidentId_idx" ON "CAPA"("incidentId");
CREATE INDEX "CAPA_workflowRunId_idx" ON "CAPA"("workflowRunId");
