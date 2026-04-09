CREATE TABLE "DeploymentPromotionChecklistItem" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "checklistKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "detail" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeploymentPromotionChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeploymentPromotionChecklistItem_promotionId_sortOrder_idx"
ON "DeploymentPromotionChecklistItem"("promotionId", "sortOrder");

CREATE INDEX "DeploymentPromotionChecklistItem_promotionId_checklistKey_idx"
ON "DeploymentPromotionChecklistItem"("promotionId", "checklistKey");
