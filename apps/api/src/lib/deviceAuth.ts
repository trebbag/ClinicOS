import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ClinicRepository } from "@clinic-os/db";
import {
  authStateSchema,
  createAuditEvent,
  createDeviceAllowedProfile,
  createDeviceEnrollmentCode,
  createDeviceSession,
  createEnrolledDevice,
  createUserProfile,
  deviceEnrollSchema,
  deviceEnrollmentCodeCreateSchema,
  deviceProfileLoginSchema,
  enrolledDeviceUpdateSchema,
  type ActorContext,
  type AuthMode,
  type AuthProfileSummary,
  type AuthState,
  type DeviceAllowedProfile,
  type DeviceEnrollmentCode,
  type DeviceSession,
  type EnrolledDevice,
  type ResolvedIdentity,
  type Role,
  type UserProfile,
  userProfileCreateSchema,
  userProfileUpdateSchema
} from "@clinic-os/domain";
import { badRequest, forbidden, notFound, unauthorized } from "./http";

export const DEVICE_COOKIE_NAME = "clinic_device";
export const SESSION_COOKIE_NAME = "clinic_session";

const adminRoles: Role[] = [
  "medical_director",
  "quality_lead",
  "office_manager",
  "cfo",
  "hr_lead"
];

type DeviceAuthOptions = {
  mode: AuthMode;
  secureCookies: boolean;
  cookieSameSite: "Strict" | "Lax";
  deviceTrustDays: number;
  sessionIdleHours: number;
  sessionAbsoluteDays: number;
  failedPinLimit: number;
  failedPinLockMinutes: number;
  enrollmentTtlMinutes: number;
};

export type PublicUserProfile = {
  id: string;
  displayName: string;
  role: Role;
  status: UserProfile["status"];
  createdAt: string;
  updatedAt: string;
};

export type PublicEnrolledDevice = {
  id: string;
  deviceLabel: string;
  status: EnrolledDevice["status"];
  primaryProfileId: string;
  trustExpiresAt: string;
  lastSeenAt: string | null;
  createdByProfileId: string;
  createdAt: string;
  updatedAt: string;
  allowedProfiles: AuthProfileSummary[];
  activeSessionProfileIds: string[];
};

function addMinutes(input: string, minutes: number): string {
  return new Date(new Date(input).getTime() + minutes * 60_000).toISOString();
}

function addHours(input: string, hours: number): string {
  return addMinutes(input, hours * 60);
}

function addDays(input: string, days: number): string {
  const date = new Date(input);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function hashToken(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizePinHash(hash: string): { salt: string; digest: Buffer } {
  const [salt, encoded] = hash.split(":");
  if (!salt || !encoded) {
    badRequest("Stored PIN hash is invalid.");
  }
  return {
    salt,
    digest: Buffer.from(encoded, "hex")
  };
}

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
  const { salt, digest } = normalizePinHash(storedHash);
  const candidate = scryptSync(pin, salt, digest.length);
  return timingSafeEqual(candidate, digest);
}

function actorForProfile(profile: UserProfile): ActorContext {
  return {
    actorId: profile.id,
    role: profile.role,
    name: profile.displayName
  };
}

function sanitizeProfile(profile: UserProfile): PublicUserProfile {
  return {
    id: profile.id,
    displayName: profile.displayName,
    role: profile.role,
    status: profile.status,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function cookieExpiresAt(input: string): string {
  return new Date(input).toUTCString();
}

export function serializeCookie(name: string, value: string, options: {
  expiresAt?: string;
  maxAgeSeconds?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax";
  path?: string;
}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? "/"}`);
  if (typeof options.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  if (options.expiresAt) {
    parts.push(`Expires=${cookieExpiresAt(options.expiresAt)}`);
  }
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  parts.push(`SameSite=${options.sameSite ?? "Strict"}`);
  return parts.join("; ");
}

export function parseCookies(header?: string): Record<string, string> {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const index = segment.indexOf("=");
        if (index < 0) {
          return [segment, ""];
        }
        return [
          segment.slice(0, index),
          decodeURIComponent(segment.slice(index + 1))
        ];
      })
  );
}

export function appendSetCookie(reply: {
  getHeader(name: string): unknown;
  header(name: string, value: unknown): unknown;
}, value: string): void {
  const existing = reply.getHeader("Set-Cookie");
  if (!existing) {
    reply.header("Set-Cookie", [value]);
    return;
  }
  const items = Array.isArray(existing) ? existing : [String(existing)];
  reply.header("Set-Cookie", [...items, value]);
}

export class DeviceProfileAuthService {
  constructor(
    private readonly repository: ClinicRepository,
    private readonly options: DeviceAuthOptions
  ) {}

  private requireAdmin(actor: ActorContext): void {
    if (!adminRoles.includes(actor.role)) {
      forbidden(`Role ${actor.role} is not allowed to manage device auth.`);
    }
  }

  private async recordAudit(actor: ActorContext, eventType: string, entityType: string, entityId: string, payload: Record<string, unknown>) {
    return this.repository.createAuditEvent(createAuditEvent({
      eventType,
      entityType,
      entityId,
      actorId: actor.actorId,
      actorRole: actor.role,
      actorName: actor.name ?? actor.actorId,
      payload
    }));
  }

  private async buildAllowedProfiles(deviceId: string): Promise<AuthProfileSummary[]> {
    const [assignments, profiles] = await Promise.all([
      this.repository.listDeviceAllowedProfiles({ deviceId }),
      this.repository.listUserProfiles()
    ]);
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    return assignments
      .map((assignment) => {
        const profile = profilesById.get(assignment.profileId);
        if (!profile || profile.status !== "active") {
          return null;
        }
        return {
          id: profile.id,
          displayName: profile.displayName,
          role: profile.role,
          isPrimary: assignment.isPrimary,
          lockedUntil: assignment.lockedUntil
        } satisfies AuthProfileSummary;
      })
      .filter((item): item is AuthProfileSummary => item !== null)
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.displayName.localeCompare(right.displayName));
  }

  private async buildPublicDevice(device: EnrolledDevice): Promise<PublicEnrolledDevice> {
    const [allowedProfiles, sessions] = await Promise.all([
      this.buildAllowedProfiles(device.id),
      this.repository.listDeviceSessions({ deviceId: device.id, includeRevoked: false })
    ]);

    return {
      id: device.id,
      deviceLabel: device.deviceLabel,
      status: device.status,
      primaryProfileId: device.primaryProfileId,
      trustExpiresAt: device.trustExpiresAt,
      lastSeenAt: device.lastSeenAt,
      createdByProfileId: device.createdByProfileId,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      allowedProfiles,
      activeSessionProfileIds: Array.from(new Set(sessions.map((session) => session.profileId)))
    };
  }

  private async revokeSessions(filters: { deviceId?: string; profileId?: string }, reason: string, actor: ActorContext): Promise<void> {
    const sessions = await this.repository.listDeviceSessions({
      ...filters,
      includeRevoked: false
    });
    const now = new Date().toISOString();
    await Promise.all(sessions.map((session) =>
      this.repository.updateDeviceSession(session.id, {
        revokedAt: now,
        updatedAt: now
      })
    ));

    if (sessions.length > 0) {
      await this.recordAudit(actor, "auth.session_revoked", "device_session", sessions[0].id, {
        reason,
        revokedCount: sessions.length,
        deviceId: filters.deviceId ?? null,
        profileId: filters.profileId ?? null
      });
    }
  }

  private async touchDevice(device: EnrolledDevice, now: string): Promise<EnrolledDevice> {
    if (device.lastSeenAt === now) {
      return device;
    }
    return this.repository.updateEnrolledDevice(device.id, {
      lastSeenAt: now,
      updatedAt: now
    });
  }

  private async resolveDevice(deviceToken?: string | null, now?: string): Promise<EnrolledDevice | null> {
    const inspection = await this.inspectDevice(deviceToken, now);
    return inspection.issue ? null : inspection.device;
  }

  private async inspectDevice(deviceToken?: string | null, now?: string): Promise<{
    device: EnrolledDevice | null;
    issue: "not_enrolled" | "revoked" | "expired" | null;
  }> {
    if (!deviceToken) {
      return {
        device: null,
        issue: "not_enrolled"
      };
    }
    const device = await this.repository.getEnrolledDeviceBySecretHash(hashToken(deviceToken));
    if (!device) {
      return {
        device: null,
        issue: "not_enrolled"
      };
    }
    const effectiveNow = now ?? new Date().toISOString();
    if (device.status !== "active") {
      return {
        device,
        issue: "revoked"
      };
    }
    if (device.trustExpiresAt < effectiveNow) {
      return {
        device,
        issue: "expired"
      };
    }
    return {
      device: await this.touchDevice(device, effectiveNow),
      issue: null
    };
  }

  private async resolveSession(device: EnrolledDevice, sessionToken?: string | null, now?: string): Promise<{
    session: DeviceSession;
    profile: UserProfile;
  } | null> {
    if (!sessionToken) {
      return null;
    }
    const effectiveNow = now ?? new Date().toISOString();
    const session = await this.repository.getDeviceSessionBySecretHash(hashToken(sessionToken));
    if (!session || session.deviceId !== device.id || session.revokedAt) {
      return null;
    }
    if (session.idleExpiresAt < effectiveNow || session.absoluteExpiresAt < effectiveNow) {
      await this.repository.updateDeviceSession(session.id, {
        revokedAt: effectiveNow,
        updatedAt: effectiveNow
      });
      return null;
    }
    const profile = await this.repository.getUserProfile(session.profileId);
    if (!profile || profile.status !== "active") {
      await this.repository.updateDeviceSession(session.id, {
        revokedAt: effectiveNow,
        updatedAt: effectiveNow
      });
      return null;
    }
    const nextIdleExpiry = addHours(effectiveNow, this.options.sessionIdleHours);
    const rolledIdleExpiry = nextIdleExpiry < session.absoluteExpiresAt
      ? nextIdleExpiry
      : session.absoluteExpiresAt;
    await this.repository.updateDeviceSession(session.id, {
      idleExpiresAt: rolledIdleExpiry,
      lastSeenAt: effectiveNow,
      updatedAt: effectiveNow
    });
    return {
      session: {
        ...session,
        idleExpiresAt: rolledIdleExpiry,
        lastSeenAt: effectiveNow,
        updatedAt: effectiveNow
      },
      profile
    };
  }

  async resolveIdentityFromTokens(input: {
    deviceToken?: string | null;
    sessionToken?: string | null;
    now?: string;
  }): Promise<ResolvedIdentity | null> {
    if (this.options.mode !== "device_profiles") {
      return null;
    }
    const effectiveNow = input.now ?? new Date().toISOString();
    const device = await this.resolveDevice(input.deviceToken, effectiveNow);
    if (!device) {
      return null;
    }
    const resolvedSession = await this.resolveSession(device, input.sessionToken, effectiveNow);
    if (!resolvedSession) {
      return null;
    }
    return {
      actorId: resolvedSession.profile.id,
      role: resolvedSession.profile.role,
      name: resolvedSession.profile.displayName,
      authMode: "device_profiles",
      authenticatedAt: resolvedSession.session.createdAt,
      deviceId: device.id,
      profileId: resolvedSession.profile.id
    };
  }

  async getAuthState(input: {
    deviceToken?: string | null;
    sessionToken?: string | null;
  }): Promise<AuthState> {
    if (this.options.mode !== "device_profiles") {
      return authStateSchema.parse({
        authMode: this.options.mode,
        device: null,
        currentProfile: null,
        allowedProfiles: [],
        needsEnrollment: false,
        needsLogin: false,
        sessionExpiresAt: null,
        deviceIssue: null
      });
    }
    const now = new Date().toISOString();
    const inspection = await this.inspectDevice(input.deviceToken, now);
    const device = inspection.device;
    if (!device || inspection.issue) {
      return authStateSchema.parse({
        authMode: this.options.mode,
        device: device ? {
          id: device.id,
          deviceLabel: device.deviceLabel,
          status: device.status,
          trustExpiresAt: device.trustExpiresAt,
          lastSeenAt: device.lastSeenAt
        } : null,
        currentProfile: null,
        allowedProfiles: [],
        needsEnrollment: true,
        needsLogin: false,
        sessionExpiresAt: null,
        deviceIssue: inspection.issue
      });
    }
    const allowedProfiles = await this.buildAllowedProfiles(device.id);
    const resolvedSession = await this.resolveSession(device, input.sessionToken, now);
    return authStateSchema.parse({
      authMode: this.options.mode,
      device: {
        id: device.id,
        deviceLabel: device.deviceLabel,
        status: device.status,
        trustExpiresAt: device.trustExpiresAt,
        lastSeenAt: device.lastSeenAt
      },
      currentProfile: resolvedSession ? {
        id: resolvedSession.profile.id,
        displayName: resolvedSession.profile.displayName,
        role: resolvedSession.profile.role,
        isPrimary: device.primaryProfileId === resolvedSession.profile.id,
        lockedUntil: null
      } : null,
      allowedProfiles,
      needsEnrollment: false,
      needsLogin: !resolvedSession,
      sessionExpiresAt: resolvedSession?.session.idleExpiresAt ?? null,
      deviceIssue: null
    });
  }

  async createUserProfile(actor: ActorContext, input: unknown): Promise<PublicUserProfile> {
    this.requireAdmin(actor);
    const command = userProfileCreateSchema.parse(input);
    const created = await this.repository.createUserProfile(createUserProfile({
      displayName: command.displayName,
      role: command.role,
      pinHash: hashPin(command.pin),
      status: command.status
    }));
    await this.recordAudit(actor, "auth.profile_created", "user_profile", created.id, {
      role: created.role,
      status: created.status
    });
    return sanitizeProfile(created);
  }

  async updateUserProfile(actor: ActorContext, profileId: string, input: unknown): Promise<PublicUserProfile> {
    this.requireAdmin(actor);
    const command = userProfileUpdateSchema.parse(input);
    const profile = await this.repository.getUserProfile(profileId);
    if (!profile) {
      notFound(`User profile not found: ${profileId}`);
    }
    const updated = await this.repository.updateUserProfile(profileId, {
      displayName: command.displayName ?? profile.displayName,
      role: command.role ?? profile.role,
      status: command.status ?? profile.status,
      pinHash: command.pin ? hashPin(command.pin) : profile.pinHash,
      updatedAt: new Date().toISOString()
    });
    if (updated.status !== "active") {
      await this.revokeSessions({ profileId: updated.id }, "profile_deactivated", actor);
    }
    await this.recordAudit(actor, "auth.profile_updated", "user_profile", updated.id, {
      role: updated.role,
      status: updated.status,
      pinChanged: Boolean(command.pin)
    });
    return sanitizeProfile(updated);
  }

  async listUserProfiles(actor: ActorContext): Promise<PublicUserProfile[]> {
    this.requireAdmin(actor);
    const profiles = await this.repository.listUserProfiles();
    return profiles.map(sanitizeProfile);
  }

  async createEnrollmentCode(actor: ActorContext, input: unknown): Promise<{
    id: string;
    code: string;
    expiresAt: string;
    primaryProfileId: string;
    allowedProfileIds: string[];
  }> {
    this.requireAdmin(actor);
    const command = deviceEnrollmentCodeCreateSchema.parse(input);
    const profileIds = Array.from(new Set([command.primaryProfileId, ...command.allowedProfileIds]));
    if (!profileIds.includes(command.primaryProfileId)) {
      badRequest("Primary profile must be included in allowed profiles.");
    }
    if (profileIds.length > 3) {
      badRequest("Each device may have at most three allowed profiles.");
    }
    const profiles = await Promise.all(profileIds.map((profileId) => this.repository.getUserProfile(profileId)));
    if (profiles.some((profile) => !profile || profile.status !== "active")) {
      badRequest("Enrollment codes may only target active user profiles.");
    }

    const rawCode = randomBytes(5).toString("hex").toUpperCase();
    const expiresAt = addMinutes(new Date().toISOString(), command.expiresInMinutes ?? this.options.enrollmentTtlMinutes);
    const record = await this.repository.createDeviceEnrollmentCode(createDeviceEnrollmentCode({
      codeHash: hashToken(rawCode),
      createdByProfileId: actor.actorId,
      primaryProfileId: command.primaryProfileId,
      allowedProfileIds: profileIds,
      expiresAt
    }));
    await this.recordAudit(actor, "auth.enrollment_code_created", "device_enrollment_code", record.id, {
      primaryProfileId: record.primaryProfileId,
      allowedProfileIds: record.allowedProfileIds,
      expiresAt: record.expiresAt
    });
    return {
      id: record.id,
      code: rawCode,
      expiresAt: record.expiresAt,
      primaryProfileId: record.primaryProfileId,
      allowedProfileIds: record.allowedProfileIds
    };
  }

  async enrollDevice(input: unknown): Promise<{
    deviceToken: string;
    state: AuthState;
  }> {
    if (this.options.mode !== "device_profiles") {
      badRequest("Device enrollment is only available in device_profiles mode.");
    }
    const command = deviceEnrollSchema.parse(input);
    const code = await this.repository.getDeviceEnrollmentCodeByCodeHash(hashToken(command.enrollmentCode));
    if (!code) {
      unauthorized("Enrollment code is invalid.");
    }
    const now = new Date().toISOString();
    if (code.consumedAt || code.expiresAt < now) {
      unauthorized("Enrollment code has expired or was already used.");
    }
    const primaryProfile = await this.repository.getUserProfile(code.primaryProfileId);
    if (!primaryProfile || primaryProfile.status !== "active") {
      badRequest("Primary enrollment profile is not active.");
    }

    const deviceToken = randomBytes(32).toString("base64url");
    const device = await this.repository.createEnrolledDevice(createEnrolledDevice({
      deviceLabel: command.deviceLabel,
      deviceSecretHash: hashToken(deviceToken),
      primaryProfileId: code.primaryProfileId,
      trustExpiresAt: addDays(now, this.options.deviceTrustDays),
      createdByProfileId: code.createdByProfileId
    }));
    await this.repository.replaceDeviceAllowedProfiles(device.id, code.allowedProfileIds.map((profileId) =>
      createDeviceAllowedProfile({
        deviceId: device.id,
        profileId,
        isPrimary: profileId === code.primaryProfileId
      })
    ));
    await this.repository.updateDeviceEnrollmentCode(code.id, {
      consumedAt: now,
      consumedByDeviceId: device.id
    });
    await this.recordAudit(actorForProfile(primaryProfile), "auth.device_enrolled", "enrolled_device", device.id, {
      profileId: primaryProfile.id,
      deviceId: device.id
    });
    return {
      deviceToken,
      state: await this.getAuthState({ deviceToken })
    };
  }

  async loginWithDevice(input: {
    deviceToken?: string | null;
    sessionToken?: string | null;
    body: unknown;
    reason: "login" | "switch_profile";
  }): Promise<{
    sessionToken: string;
    state: AuthState;
  }> {
    if (this.options.mode !== "device_profiles") {
      badRequest("Profile login is only available in device_profiles mode.");
    }
    const command = deviceProfileLoginSchema.parse(input.body);
    const now = new Date().toISOString();
    const device = await this.resolveDevice(input.deviceToken, now);
    if (!device) {
      unauthorized("Trusted device was not found. Enroll this device first.");
    }
    const profile = await this.repository.getUserProfile(command.profileId);
    if (!profile || profile.status !== "active") {
      unauthorized("Profile is unavailable.");
    }
    const assignments = await this.repository.listDeviceAllowedProfiles({ deviceId: device.id });
    const assignment = assignments.find((record) => record.profileId === command.profileId);
    if (!assignment) {
      forbidden("This device is not allowed to use that profile.");
    }
    if (assignment.lockedUntil && assignment.lockedUntil > now) {
      unauthorized("This profile is temporarily locked on this device.");
    }
    if (!verifyPin(command.pin, profile.pinHash)) {
      const nextAttempts = assignment.failedPinAttempts + 1;
      const lockedUntil = nextAttempts >= this.options.failedPinLimit
        ? addMinutes(now, this.options.failedPinLockMinutes)
        : null;
      await this.repository.updateDeviceAllowedProfile(assignment.id, {
        failedPinAttempts: lockedUntil ? 0 : nextAttempts,
        lockedUntil,
        updatedAt: now
      });
      await this.recordAudit(actorForProfile(profile), "auth.pin_failed", "device_profile_assignment", assignment.id, {
        deviceId: device.id,
        profileId: profile.id,
        lockedUntil
      });
      unauthorized("PIN was incorrect.");
    }

    await this.repository.updateDeviceAllowedProfile(assignment.id, {
      failedPinAttempts: 0,
      lockedUntil: null,
      updatedAt: now
    });
    const existingSessions = await this.repository.listDeviceSessions({ deviceId: device.id, includeRevoked: false });
    if (existingSessions.length > 0) {
      await Promise.all(existingSessions.map((session) =>
        this.repository.updateDeviceSession(session.id, {
          revokedAt: now,
          updatedAt: now
        })
      ));
    }

    const sessionToken = randomBytes(32).toString("base64url");
    const session = await this.repository.createDeviceSession(createDeviceSession({
      deviceId: device.id,
      profileId: profile.id,
      sessionSecretHash: hashToken(sessionToken),
      idleExpiresAt: addHours(now, this.options.sessionIdleHours),
      absoluteExpiresAt: addDays(now, this.options.sessionAbsoluteDays)
    }));
    await this.recordAudit(actorForProfile(profile), input.reason === "switch_profile" ? "auth.profile_switched" : "auth.logged_in", "device_session", session.id, {
      deviceId: device.id,
      profileId: profile.id,
      previousProfileIds: existingSessions.map((existing) => existing.profileId)
    });
    return {
      sessionToken,
      state: await this.getAuthState({
        deviceToken: input.deviceToken,
        sessionToken
      })
    };
  }

  async lock(input: {
    deviceToken?: string | null;
    sessionToken?: string | null;
  }): Promise<AuthState> {
    const now = new Date().toISOString();
    const device = await this.resolveDevice(input.deviceToken, now);
    if (!device) {
      return this.getAuthState({});
    }
    const resolvedSession = await this.resolveSession(device, input.sessionToken, now);
    if (resolvedSession) {
      await this.repository.updateDeviceSession(resolvedSession.session.id, {
        revokedAt: now,
        updatedAt: now
      });
      await this.recordAudit(actorForProfile(resolvedSession.profile), "auth.locked", "device_session", resolvedSession.session.id, {
        deviceId: device.id,
        profileId: resolvedSession.profile.id
      });
    }
    return this.getAuthState({ deviceToken: input.deviceToken });
  }

  async logout(input: {
    deviceToken?: string | null;
    sessionToken?: string | null;
  }): Promise<AuthState> {
    const now = new Date().toISOString();
    const device = await this.resolveDevice(input.deviceToken, now);
    if (!device) {
      return this.getAuthState({});
    }
    const resolvedSession = await this.resolveSession(device, input.sessionToken, now);
    if (resolvedSession) {
      await this.repository.updateDeviceSession(resolvedSession.session.id, {
        revokedAt: now,
        updatedAt: now
      });
      await this.recordAudit(actorForProfile(resolvedSession.profile), "auth.logged_out", "device_session", resolvedSession.session.id, {
        deviceId: device.id,
        profileId: resolvedSession.profile.id
      });
    }
    return this.getAuthState({ deviceToken: input.deviceToken });
  }

  async listDevices(actor: ActorContext): Promise<PublicEnrolledDevice[]> {
    this.requireAdmin(actor);
    const devices = await this.repository.listEnrolledDevices();
    return Promise.all(devices.map((device) => this.buildPublicDevice(device)));
  }

  async updateDevice(actor: ActorContext, deviceId: string, input: unknown): Promise<PublicEnrolledDevice> {
    this.requireAdmin(actor);
    const command = enrolledDeviceUpdateSchema.parse(input);
    const device = await this.repository.getEnrolledDevice(deviceId);
    if (!device) {
      notFound(`Enrolled device not found: ${deviceId}`);
    }
    const existingAssignments = await this.repository.listDeviceAllowedProfiles({ deviceId });
    const nextAllowedProfileIds = Array.from(new Set(command.allowedProfileIds ?? existingAssignments.map((assignment) => assignment.profileId)));
    const nextPrimaryProfileId = command.primaryProfileId ?? device.primaryProfileId;
    if (!nextAllowedProfileIds.includes(nextPrimaryProfileId)) {
      badRequest("Primary profile must be part of the allowed profile set.");
    }
    if (nextAllowedProfileIds.length > 3) {
      badRequest("Each device may have at most three allowed profiles.");
    }
    const profiles = await Promise.all(nextAllowedProfileIds.map((profileId) => this.repository.getUserProfile(profileId)));
    if (profiles.some((profile) => !profile || profile.status !== "active")) {
      badRequest("Devices may only be assigned active profiles.");
    }

    const updated = await this.repository.updateEnrolledDevice(deviceId, {
      deviceLabel: command.deviceLabel ?? device.deviceLabel,
      status: command.status ?? device.status,
      primaryProfileId: nextPrimaryProfileId,
      updatedAt: new Date().toISOString()
    });
    const existingByProfile = new Map(existingAssignments.map((assignment) => [assignment.profileId, assignment]));
    await this.repository.replaceDeviceAllowedProfiles(deviceId, nextAllowedProfileIds.map((profileId) => {
      const existing = existingByProfile.get(profileId);
      if (existing) {
        return {
          ...existing,
          isPrimary: profileId === nextPrimaryProfileId,
          updatedAt: new Date().toISOString()
        };
      }
      return createDeviceAllowedProfile({
        deviceId,
        profileId,
        isPrimary: profileId === nextPrimaryProfileId
      });
    }));
    if (updated.status !== "active") {
      await this.revokeSessions({ deviceId }, "device_deactivated", actor);
    }
    await this.recordAudit(actor, "auth.device_updated", "enrolled_device", updated.id, {
      status: updated.status,
      primaryProfileId: updated.primaryProfileId,
      allowedProfileIds: nextAllowedProfileIds
    });
    return this.buildPublicDevice(updated);
  }

  async revokeDevice(actor: ActorContext, deviceId: string): Promise<PublicEnrolledDevice> {
    this.requireAdmin(actor);
    const device = await this.repository.getEnrolledDevice(deviceId);
    if (!device) {
      notFound(`Enrolled device not found: ${deviceId}`);
    }
    const updated = await this.repository.updateEnrolledDevice(deviceId, {
      status: "revoked",
      updatedAt: new Date().toISOString()
    });
    await this.revokeSessions({ deviceId }, "device_revoked", actor);
    await this.recordAudit(actor, "auth.device_revoked", "enrolled_device", deviceId, {
      deviceId
    });
    return this.buildPublicDevice(updated);
  }

  async bootstrapFirstAdmin(input: {
    displayName: string;
    role: Role;
    pin: string;
  }): Promise<{
    profile: PublicUserProfile;
    enrollmentCode: {
      id: string;
      code: string;
      expiresAt: string;
      primaryProfileId: string;
      allowedProfileIds: string[];
    };
  }> {
    const existingProfiles = await this.repository.listUserProfiles();
    if (existingProfiles.length > 0) {
      badRequest("Bootstrap is only allowed before any user profiles exist.");
    }
    const profile = await this.repository.createUserProfile(createUserProfile({
      displayName: input.displayName,
      role: input.role,
      pinHash: hashPin(input.pin),
      status: "active"
    }));
    const bootstrapActor = actorForProfile(profile);
    await this.recordAudit(bootstrapActor, "auth.profile_bootstrapped", "user_profile", profile.id, {
      role: profile.role
    });
    const enrollmentCode = await this.createEnrollmentCode(bootstrapActor, {
      primaryProfileId: profile.id,
      allowedProfileIds: [profile.id],
      expiresInMinutes: this.options.enrollmentTtlMinutes
    });
    return {
      profile: sanitizeProfile(profile),
      enrollmentCode
    };
  }
}
