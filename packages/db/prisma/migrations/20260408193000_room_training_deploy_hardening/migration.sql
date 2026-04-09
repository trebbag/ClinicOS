CREATE TABLE "RoomRecord" (
  "id" TEXT NOT NULL,
  "roomLabel" TEXT NOT NULL,
  "roomType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "checklistAreaLabel" TEXT NOT NULL,
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoomRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomRecord_status_roomType_idx"
  ON "RoomRecord"("status", "roomType");

ALTER TABLE "ChecklistRun"
  ADD COLUMN "roomId" TEXT;

CREATE INDEX "ChecklistRun_roomId_targetDate_idx"
  ON "ChecklistRun"("roomId", "targetDate");

ALTER TABLE "TrainingRequirement"
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "sourceCycleKey" TEXT,
  ADD COLUMN "followUpActionItemId" TEXT;

CREATE INDEX "TrainingRequirement_planId_employeeId_idx"
  ON "TrainingRequirement"("planId", "employeeId");

CREATE INDEX "TrainingRequirement_followUpActionItemId_idx"
  ON "TrainingRequirement"("followUpActionItemId");

CREATE TABLE "TrainingPlan" (
  "id" TEXT NOT NULL,
  "employeeRole" TEXT NOT NULL,
  "employeeId" TEXT,
  "requirementType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "cadenceDays" INTEGER NOT NULL,
  "leadTimeDays" INTEGER NOT NULL,
  "validityDays" INTEGER,
  "ownerRole" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "lastMaterializedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingPlan_employeeRole_status_idx"
  ON "TrainingPlan"("employeeRole", "status");

CREATE INDEX "TrainingPlan_employeeId_status_idx"
  ON "TrainingPlan"("employeeId", "status");

CREATE INDEX "TrainingPlan_ownerRole_status_idx"
  ON "TrainingPlan"("ownerRole", "status");

CREATE TABLE "DeploymentPromotion" (
  "id" TEXT NOT NULL,
  "environmentKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "targetAuthMode" TEXT NOT NULL,
  "runtimeAgentsDisabled" BOOLEAN NOT NULL,
  "latestSmokeAt" TIMESTAMP(3),
  "rollbackVerifiedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeploymentPromotion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeploymentPromotion_environmentKey_status_idx"
  ON "DeploymentPromotion"("environmentKey", "status");
