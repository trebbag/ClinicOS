CREATE TABLE "Committee" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "chairRole" TEXT NOT NULL,
  "recorderRole" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "serviceLine" TEXT,
  "qapiFocus" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Committee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommitteeMeeting" (
  "id" TEXT NOT NULL,
  "committeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "packetDocumentId" TEXT,
  "workflowRunId" TEXT,
  "notes" TEXT,
  "agendaItemsJson" JSONB NOT NULL DEFAULT '[]',
  "decisionsJson" JSONB NOT NULL DEFAULT '[]',
  "qapiSnapshotJson" JSONB,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "CommitteeMeeting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommitteeMeeting_packetDocumentId_key" ON "CommitteeMeeting"("packetDocumentId");
CREATE UNIQUE INDEX "CommitteeMeeting_workflowRunId_key" ON "CommitteeMeeting"("workflowRunId");
CREATE INDEX "Committee_category_isActive_idx" ON "Committee"("category", "isActive");
CREATE INDEX "Committee_serviceLine_idx" ON "Committee"("serviceLine");
CREATE INDEX "CommitteeMeeting_committeeId_status_idx" ON "CommitteeMeeting"("committeeId", "status");
CREATE INDEX "CommitteeMeeting_scheduledFor_idx" ON "CommitteeMeeting"("scheduledFor");
