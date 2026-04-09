CREATE TABLE "EvidenceGap" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedGapKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "resolutionSummary" TEXT,
  "standardId" TEXT,
  "binderId" TEXT,
  "committeeMeetingId" TEXT,
  "serviceLineId" TEXT,
  "actionItemId" TEXT,
  "dueDate" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "EvidenceGap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvidenceGap_status_severity_idx"
  ON "EvidenceGap"("status", "severity");

CREATE INDEX "EvidenceGap_ownerRole_status_idx"
  ON "EvidenceGap"("ownerRole", "status");

CREATE INDEX "EvidenceGap_standardId_status_idx"
  ON "EvidenceGap"("standardId", "status");

CREATE INDEX "EvidenceGap_binderId_status_idx"
  ON "EvidenceGap"("binderId", "status");

CREATE INDEX "EvidenceGap_normalizedGapKey_idx"
  ON "EvidenceGap"("normalizedGapKey");

CREATE INDEX "EvidenceGap_dueDate_idx"
  ON "EvidenceGap"("dueDate");
