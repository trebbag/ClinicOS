-- CreateTable
CREATE TABLE "WorkerJobRecord" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "maxAttempts" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "payload" JSONB NOT NULL,
    "resultJson" JSONB,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerJobRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerJobRecord_status_scheduledAt_idx" ON "WorkerJobRecord"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "WorkerJobRecord_sourceEntityType_sourceEntityId_idx" ON "WorkerJobRecord"("sourceEntityType", "sourceEntityId");
