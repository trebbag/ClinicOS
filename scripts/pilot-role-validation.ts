import "dotenv/config";
import { randomInt } from "node:crypto";
import { spawn } from "node:child_process";
import { prisma, PrismaClinicRepository } from "@clinic-os/db";
import { actorHasCapability, type ActorContext, type Role, type UserProfile } from "@clinic-os/domain";
import { DeviceProfileAuthService } from "../apps/api/src/lib/deviceAuth.ts";

type ValidationProfileSpec = {
  key: "medical_director" | "office_manager" | "quality_lead" | "hr_lead";
  displayName: string;
  role: Role;
};

type ValidationProfileState = {
  spec: ValidationProfileSpec;
  profile: {
    id: string;
    displayName: string;
    role: Role;
    status: "active" | "inactive";
  };
  pin: string;
};

type DeviceState = {
  id: string;
  deviceLabel: string;
  status: string;
};

type BrowserSession = {
  enroll: (code: string, deviceLabel: string) => Promise<{ device: DeviceState | null }>;
  login: (profileId: string, pin: string) => Promise<unknown>;
  get: <T>(path: string, expectedStatus?: number) => Promise<T>;
  post: <T>(path: string, body?: unknown, expectedStatus?: number) => Promise<T>;
  patch: <T>(path: string, body?: unknown, expectedStatus?: number) => Promise<T>;
};

const baseUrl = (process.env.PILOT_ROLE_VALIDATION_BASE_URL ?? process.env.PUBLIC_APP_ORIGIN ?? process.argv[2] ?? "").replace(/\/$/, "");

if (!baseUrl) {
  throw new Error("Usage: npm run validate:pilot-roles -- https://clinic-os.example.com");
}

const repository = new PrismaClinicRepository(prisma);
const authService = new DeviceProfileAuthService(repository, {
  mode: "device_profiles",
  secureCookies: false,
  cookieSameSite: "Strict",
  deviceTrustDays: 90,
  sessionIdleHours: 12,
  sessionAbsoluteDays: 7,
  failedPinLimit: 5,
  failedPinLockMinutes: 15,
  enrollmentTtlMinutes: 30
});

const keepAuthFixtures = process.env.PILOT_ROLE_VALIDATION_KEEP_AUTH_FIXTURES === "true";
const validationDate = process.env.PILOT_ROLE_VALIDATION_TARGET_DATE ?? addDays(new Date().toISOString().slice(0, 10), 7);
const validationEmployeeId = `pilot-validation-${timestampSuffix()}`;

const validationSpecs: ValidationProfileSpec[] = [
  {
    key: "medical_director",
    displayName: "Pilot Validation Medical Director",
    role: "medical_director"
  },
  {
    key: "office_manager",
    displayName: "Pilot Validation Office Manager",
    role: "office_manager"
  },
  {
    key: "quality_lead",
    displayName: "Pilot Validation Quality Lead",
    role: "quality_lead"
  },
  {
    key: "hr_lead",
    displayName: "Pilot Validation HR Lead",
    role: "hr_lead"
  }
];

const createdProfileIds = new Set<string>();
const createdDeviceIds = new Set<string>();
const updatedProfiles = new Map<string, { displayName: string; role: Role; status: "active" | "inactive" }>();

function timestampSuffix(): string {
  return new Date().toISOString().replace(/[^\d]/g, "").slice(0, 14);
}

function addDays(input: string, days: number): string {
  const date = new Date(`${input}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function randomPin(): string {
  return String(randomInt(100000, 1_000_000));
}

function resolveOperatorActor(profile: UserProfile): ActorContext {
  return {
    actorId: profile.id,
    role: profile.role,
    name: profile.displayName
  };
}

function createBrowserSession(): BrowserSession {
  const cookieJar = new Map<string, string>();
  const origin = new URL(baseUrl).origin;

  function setCookie(header: string | null): void {
    if (!header) {
      return;
    }
    const [pair] = header.split(";");
    const separator = pair.indexOf("=");
    if (separator < 0) {
      return;
    }
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!value) {
      cookieJar.delete(name);
      return;
    }
    cookieJar.set(name, value);
  }

  function updateCookies(response: Response): void {
    if (typeof response.headers.getSetCookie === "function") {
      for (const header of response.headers.getSetCookie()) {
        setCookie(header);
      }
      return;
    }

    const combined = response.headers.get("set-cookie");
    if (!combined) {
      return;
    }

    for (const header of combined.split(/,(?=[^;]+=[^;]+)/g)) {
      setCookie(header);
    }
  }

  function cookieHeader(): string | undefined {
    if (cookieJar.size === 0) {
      return undefined;
    }
    return Array.from(cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async function request<T>(method: string, path: string, body?: unknown, expectedStatus = 200): Promise<T> {
    const headers = new Headers();
    const cookie = cookieHeader();
    if (cookie) {
      headers.set("cookie", cookie);
    }
    if (body !== undefined) {
      headers.set("content-type", "application/json");
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
      headers.set("origin", origin);
    }

    const response = await fetch(`${baseUrl}/clinic-api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual"
    });
    updateCookies(response);
    const text = await response.text();
    const json = text ? JSON.parse(text) as T : null as T;
    if (response.status !== expectedStatus) {
      throw new Error(`${method} ${path} expected ${expectedStatus} but got ${response.status}: ${text}`);
    }
    return json;
  }

  return {
    enroll: async (code: string, deviceLabel: string) => {
      const response = await request<{ device: DeviceState | null }>("POST", "/auth/enroll-device", {
        enrollmentCode: code,
        deviceLabel
      });
      return response;
    },
    login: async (profileId: string, pin: string) => {
      return request("POST", "/auth/login", {
        profileId,
        pin
      });
    },
    get: (path: string, expectedStatus = 200) => request("GET", path, undefined, expectedStatus),
    post: (path: string, body?: unknown, expectedStatus = 200) => request("POST", path, body, expectedStatus),
    patch: (path: string, body?: unknown, expectedStatus = 200) => request("PATCH", path, body, expectedStatus)
  };
}

async function runCommand(command: string, args: string[], extraEnv: Record<string, string>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv
      },
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

async function getOperatorActor(): Promise<ActorContext> {
  const profiles = await repository.listUserProfiles({ status: "active" });
  const operator = profiles.find((profile) => actorHasCapability({ role: profile.role }, "auth.mint_enrollment_codes"));
  if (!operator) {
    throw new Error("No active admin-capable profile exists. Bootstrap a pilot admin first.");
  }
  return resolveOperatorActor(operator);
}

async function ensureValidationProfiles(actor: ActorContext): Promise<Record<ValidationProfileSpec["key"], ValidationProfileState>> {
  const existingProfiles = await repository.listUserProfiles();
  const next = {} as Record<ValidationProfileSpec["key"], ValidationProfileState>;

  for (const spec of validationSpecs) {
    const existing = existingProfiles.find((profile) => profile.displayName === spec.displayName);
    const pin = randomPin();

    if (existing) {
      updatedProfiles.set(existing.id, {
        displayName: existing.displayName,
        role: existing.role,
        status: existing.status
      });
      const updated = await authService.updateUserProfile(actor, existing.id, {
        displayName: spec.displayName,
        role: spec.role,
        status: "active",
        pin
      });
      next[spec.key] = { spec, profile: updated, pin };
      continue;
    }

    const created = await authService.createUserProfile(actor, {
      displayName: spec.displayName,
      role: spec.role,
      pin,
      status: "active"
    });
    createdProfileIds.add(created.id);
    next[spec.key] = { spec, profile: created, pin };
  }

  return next;
}

async function createEnrollmentCode(actor: ActorContext, primaryProfileId: string, allowedProfileIds: string[]) {
  return authService.createEnrollmentCode(actor, {
    primaryProfileId,
    allowedProfileIds,
    expiresInMinutes: 30
  });
}

async function trackDeviceByLabel(deviceLabel: string): Promise<string | null> {
  const devices = await repository.listEnrolledDevices();
  const device = devices
    .filter((record) => record.deviceLabel === deviceLabel)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (!device) {
    return null;
  }
  createdDeviceIds.add(device.id);
  return device.id;
}

async function runRoleChecks(input: {
  profiles: Record<ValidationProfileSpec["key"], ValidationProfileState>;
  actor: ActorContext;
}) {
  const results: Record<string, unknown> = {};

  const officeManagerSession = createBrowserSession();
  const officeManagerDeviceLabel = `Pilot Validation Office Manager ${timestampSuffix()}`;
  const officeManagerCode = await createEnrollmentCode(
    input.actor,
    input.profiles.office_manager.profile.id,
    [input.profiles.office_manager.profile.id]
  );
  const officeManagerState = await officeManagerSession.enroll(officeManagerCode.code, officeManagerDeviceLabel);
  if (officeManagerState.device?.id) {
    createdDeviceIds.add(officeManagerState.device.id);
  } else {
    await trackDeviceByLabel(officeManagerDeviceLabel);
  }
  await officeManagerSession.login(input.profiles.office_manager.profile.id, input.profiles.office_manager.pin);
  const officeManagerWhoami = await officeManagerSession.get<{ actor: { role: string } }>("/auth/whoami");
  const officeDashboard = await officeManagerSession.post<{
    workflowRun: { id: string } | null;
    checklistRun: { id: string } | null;
    checklistItems: Array<{ id: string; label: string; status: string }>;
  }>("/office-ops/daily-packet", {
    targetDate: validationDate
  });
  if (!officeDashboard.checklistRun || officeDashboard.checklistItems.length === 0) {
    throw new Error("Office-manager validation did not produce a checklist run.");
  }
  await officeManagerSession.patch(
    `/office-ops/checklist-runs/${officeDashboard.checklistRun.id}/items/${officeDashboard.checklistItems[0].id}`,
    {
      status: "complete",
      note: "Pilot validation completion"
    }
  );
  results.officeManager = {
    actorRole: officeManagerWhoami.actor.role,
    checklistRunId: officeDashboard.checklistRun.id,
    workflowRunId: officeDashboard.workflowRun?.id ?? null
  };

  const qualitySession = createBrowserSession();
  const qualityDeviceLabel = `Pilot Validation Quality Lead ${timestampSuffix()}`;
  const qualityCode = await createEnrollmentCode(
    input.actor,
    input.profiles.quality_lead.profile.id,
    [input.profiles.quality_lead.profile.id]
  );
  const qualityState = await qualitySession.enroll(qualityCode.code, qualityDeviceLabel);
  if (qualityState.device?.id) {
    createdDeviceIds.add(qualityState.device.id);
  } else {
    await trackDeviceByLabel(qualityDeviceLabel);
  }
  await qualitySession.login(input.profiles.quality_lead.profile.id, input.profiles.quality_lead.pin);
  const qualityWhoami = await qualitySession.get<{ actor: { role: string } }>("/auth/whoami");
  const qualityWorkerSummary = await qualitySession.get<{ queued: number; processing: number; failed: number; deadLetter: number; succeeded: number }>("/worker-jobs/summary");
  const qualityValidation = await qualitySession.post<{ overallStatus: string; readyForLive: boolean }>("/integrations/microsoft/validate");
  await qualitySession.patch(
    `/office-ops/checklist-runs/${officeDashboard.checklistRun.id}/items/${officeDashboard.checklistItems[1]?.id ?? officeDashboard.checklistItems[0].id}`,
    {
      status: "waived",
      note: "Pilot validation quality waiver"
    }
  );
  await qualitySession.post("/office-ops/reconcile-planner", undefined, 403);
  results.qualityLead = {
    actorRole: qualityWhoami.actor.role,
    workerSummary: qualityWorkerSummary,
    microsoftValidation: qualityValidation
  };

  const hrSession = createBrowserSession();
  const hrDeviceLabel = `Pilot Validation HR Lead ${timestampSuffix()}`;
  const hrCode = await createEnrollmentCode(
    input.actor,
    input.profiles.hr_lead.profile.id,
    [input.profiles.hr_lead.profile.id]
  );
  const hrState = await hrSession.enroll(hrCode.code, hrDeviceLabel);
  if (hrState.device?.id) {
    createdDeviceIds.add(hrState.device.id);
  } else {
    await trackDeviceByLabel(hrDeviceLabel);
  }
  await hrSession.login(input.profiles.hr_lead.profile.id, input.profiles.hr_lead.pin);
  const hrWhoami = await hrSession.get<{ actor: { role: string } }>("/auth/whoami");
  const requirement = await hrSession.post<{ id: string }>("/training-requirements", {
    employeeId: validationEmployeeId,
    employeeRole: "office_manager",
    requirementType: "training",
    title: `Pilot validation requirement ${timestampSuffix()}`,
    dueDate: `${validationDate}T18:00:00.000Z`,
    notes: "Non-PHI pilot validation requirement."
  });
  await hrSession.post("/training-completions", {
    requirementId: requirement.id,
    completedAt: `${validationDate}T15:00:00.000Z`,
    validUntil: `${addDays(validationDate, 365)}T15:00:00.000Z`,
    note: "Pilot validation completion."
  });
  const trainingDashboard = await hrSession.get<{ gapSummary: { counts: { complete: number } }; requirements: Array<{ id: string }> }>(
    `/training/dashboard?employeeId=${encodeURIComponent(validationEmployeeId)}&employeeRole=office_manager`
  );
  await hrSession.post("/integrations/microsoft/validate", undefined, 403);
  await hrSession.get("/worker-jobs/summary", 403);
  results.hrLead = {
    actorRole: hrWhoami.actor.role,
    requirementId: requirement.id,
    trainingCompleteCount: trainingDashboard.gapSummary.counts.complete
  };

  return results;
}

async function cleanupFixtures(actor: ActorContext, profiles: Record<ValidationProfileSpec["key"], ValidationProfileState>): Promise<void> {
  for (const deviceId of createdDeviceIds) {
    try {
      await authService.revokeDevice(actor, deviceId);
    } catch {
      // Best-effort cleanup for synthetic validation devices.
    }
  }

  const profilesToDeactivate = [
    ...createdProfileIds,
    ...Array.from(updatedProfiles.keys())
  ];

  for (const profileId of profilesToDeactivate) {
    const state = Object.values(profiles).find((profile) => profile.profile.id === profileId);
    if (!state) {
      continue;
    }

    const previous = updatedProfiles.get(profileId);
    await authService.updateUserProfile(actor, profileId, {
      displayName: previous?.displayName ?? state.profile.displayName,
      role: previous?.role ?? state.profile.role,
      status: previous?.status ?? "inactive",
      pin: randomPin()
    });
  }
}

async function main(): Promise<void> {
  const actor = await getOperatorActor();
  const profiles = await ensureValidationProfiles(actor);

  const smokeDeviceLabel = `Pilot Validation Smoke ${timestampSuffix()}`;
  const smokeCode = await createEnrollmentCode(actor, profiles.medical_director.profile.id, [
    profiles.medical_director.profile.id,
    profiles.office_manager.profile.id
  ]);
  let smokeError: string | null = null;

  try {
    try {
      await runCommand("node", ["./scripts/pilot-live-smoke.mjs", baseUrl], {
        PILOT_SMOKE_BASE_URL: baseUrl,
        PILOT_SMOKE_ENROLLMENT_CODE: smokeCode.code,
        PILOT_SMOKE_PROFILE_ID: profiles.medical_director.profile.id,
        PILOT_SMOKE_PROFILE_ROLE: "medical_director",
        PILOT_SMOKE_PIN: profiles.medical_director.pin,
        PILOT_SMOKE_OFFICE_MANAGER_PIN: profiles.office_manager.pin,
        PILOT_SMOKE_MEDICAL_DIRECTOR_PIN: profiles.medical_director.pin,
        PILOT_SMOKE_DEVICE_LABEL: smokeDeviceLabel
      });
    } catch (error) {
      smokeError = error instanceof Error ? error.message : String(error);
    }
    await trackDeviceByLabel(smokeDeviceLabel);

    const roleValidation = await runRoleChecks({ profiles, actor });

    console.log(JSON.stringify({
      baseUrl,
      validationDate,
      keepAuthFixtures,
      smokeArtifactsPolicy: "Kept labeled workflow artifacts; synthetic auth fixtures are cleaned up by default.",
      smoke: {
        succeeded: smokeError === null,
        error: smokeError
      },
      roleValidation
    }, null, 2));
  } finally {
    if (!keepAuthFixtures) {
      await cleanupFixtures(actor, profiles);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
