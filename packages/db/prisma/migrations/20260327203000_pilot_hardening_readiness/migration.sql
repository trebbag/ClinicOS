-- CreateTable
CREATE TABLE "MicrosoftIntegrationValidationRecord" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "configComplete" BOOLEAN NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "readyForLive" BOOLEAN NOT NULL,
    "missingConfigKeys" JSONB NOT NULL,
    "surfacesJson" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "checkedById" TEXT NOT NULL,
    "checkedByRole" TEXT NOT NULL,

    CONSTRAINT "MicrosoftIntegrationValidationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MicrosoftIntegrationValidationRecord_provider_checkedAt_idx"
ON "MicrosoftIntegrationValidationRecord"("provider", "checkedAt");
