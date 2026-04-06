CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "pinHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserProfile_role_status_idx"
  ON "UserProfile"("role", "status");

CREATE TABLE "EnrolledDevice" (
  "id" TEXT NOT NULL,
  "deviceLabel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "deviceSecretHash" TEXT NOT NULL,
  "primaryProfileId" TEXT NOT NULL,
  "trustExpiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3),
  "createdByProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnrolledDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnrolledDevice_deviceSecretHash_key"
  ON "EnrolledDevice"("deviceSecretHash");
CREATE INDEX "EnrolledDevice_status_trustExpiresAt_idx"
  ON "EnrolledDevice"("status", "trustExpiresAt");
CREATE INDEX "EnrolledDevice_primaryProfileId_idx"
  ON "EnrolledDevice"("primaryProfileId");

CREATE TABLE "DeviceAllowedProfile" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL,
  "failedPinAttempts" INTEGER NOT NULL,
  "lockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceAllowedProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceAllowedProfile_deviceId_profileId_key"
  ON "DeviceAllowedProfile"("deviceId", "profileId");
CREATE INDEX "DeviceAllowedProfile_deviceId_isPrimary_idx"
  ON "DeviceAllowedProfile"("deviceId", "isPrimary");
CREATE INDEX "DeviceAllowedProfile_profileId_idx"
  ON "DeviceAllowedProfile"("profileId");

CREATE TABLE "DeviceEnrollmentCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "createdByProfileId" TEXT NOT NULL,
  "primaryProfileId" TEXT NOT NULL,
  "allowedProfileIds" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "consumedByDeviceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceEnrollmentCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceEnrollmentCode_codeHash_key"
  ON "DeviceEnrollmentCode"("codeHash");
CREATE INDEX "DeviceEnrollmentCode_expiresAt_consumedAt_idx"
  ON "DeviceEnrollmentCode"("expiresAt", "consumedAt");

CREATE TABLE "DeviceSession" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sessionSecretHash" TEXT NOT NULL,
  "idleExpiresAt" TIMESTAMP(3) NOT NULL,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceSession_sessionSecretHash_key"
  ON "DeviceSession"("sessionSecretHash");
CREATE INDEX "DeviceSession_deviceId_revokedAt_idx"
  ON "DeviceSession"("deviceId", "revokedAt");
CREATE INDEX "DeviceSession_profileId_revokedAt_idx"
  ON "DeviceSession"("profileId", "revokedAt");
CREATE INDEX "DeviceSession_idleExpiresAt_absoluteExpiresAt_idx"
  ON "DeviceSession"("idleExpiresAt", "absoluteExpiresAt");
