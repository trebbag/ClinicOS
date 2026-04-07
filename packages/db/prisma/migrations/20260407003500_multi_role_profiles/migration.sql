ALTER TABLE "UserProfile"
ADD COLUMN "grantedRoles" JSONB NOT NULL DEFAULT '[]';

UPDATE "UserProfile"
SET "grantedRoles" = jsonb_build_array("role")
WHERE "grantedRoles" = '[]'::jsonb;

ALTER TABLE "DeviceSession"
ADD COLUMN "activeRole" TEXT;

UPDATE "DeviceSession"
SET "activeRole" = "UserProfile"."role"
FROM "UserProfile"
WHERE "DeviceSession"."profileId" = "UserProfile"."id"
  AND "DeviceSession"."activeRole" IS NULL;

ALTER TABLE "DeviceSession"
ALTER COLUMN "activeRole" SET NOT NULL;
