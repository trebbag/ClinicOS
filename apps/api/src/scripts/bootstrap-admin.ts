import { prisma, PrismaClinicRepository } from "@clinic-os/db";
import type { Role } from "@clinic-os/domain";
import { DeviceProfileAuthService } from "../lib/deviceAuth";

const allowedRoles: Role[] = [
  "medical_director",
  "quality_lead",
  "office_manager",
  "hr_lead",
  "cfo"
];

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const displayName = readFlag("displayName");
  const role = readFlag("role") as Role | undefined;
  const pin = readFlag("pin");

  if (!displayName || !role || !pin) {
    throw new Error("Usage: npm --workspace @clinic-os/api run auth:bootstrap-admin -- --displayName \"Pilot Admin\" --role medical_director --pin 123456");
  }
  if (!allowedRoles.includes(role)) {
    throw new Error(`Role must be one of: ${allowedRoles.join(", ")}`);
  }
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("PIN must be exactly 6 digits.");
  }

  const repository = new PrismaClinicRepository(prisma);
  const auth = new DeviceProfileAuthService(repository, {
    mode: "device_profiles",
    secureCookies: false,
    cookieSameSite: "Strict",
    deviceTrustDays: 90,
    sessionIdleHours: 12,
    sessionAbsoluteDays: 7,
    failedPinLimit: 5,
    failedPinLockMinutes: 15,
    enrollmentTtlMinutes: 15
  });

  const result = await auth.bootstrapFirstAdmin({
    displayName,
    role,
    pin
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
