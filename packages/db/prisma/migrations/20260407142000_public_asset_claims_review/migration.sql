ALTER TABLE "PublicAsset"
ADD COLUMN "serviceLine" TEXT,
ADD COLUMN "audience" TEXT,
ADD COLUMN "channelLabel" TEXT,
ADD COLUMN "summary" TEXT NOT NULL DEFAULT '',
ADD COLUMN "claimsJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "claimsReviewStatus" TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN "claimsReviewNotes" TEXT,
ADD COLUMN "claimsReviewedAt" TIMESTAMP(3),
ADD COLUMN "claimsReviewedByRole" TEXT,
ADD COLUMN "documentId" TEXT,
ADD COLUMN "workflowRunId" TEXT,
ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishedPath" TEXT;

CREATE UNIQUE INDEX "PublicAsset_documentId_key" ON "PublicAsset"("documentId");
CREATE UNIQUE INDEX "PublicAsset_workflowRunId_key" ON "PublicAsset"("workflowRunId");
CREATE INDEX "PublicAsset_status_ownerRole_idx" ON "PublicAsset"("status", "ownerRole");
CREATE INDEX "PublicAsset_serviceLine_idx" ON "PublicAsset"("serviceLine");
