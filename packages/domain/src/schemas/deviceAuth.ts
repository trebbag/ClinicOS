import { z } from "zod";
import { randomId } from "../common";
import { roles } from "../enums";

export const userProfileStatusSchema = z.enum([
  "active",
  "inactive"
]);

export const enrolledDeviceStatusSchema = z.enum([
  "active",
  "revoked"
]);

export const authProfileSummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.enum(roles),
  isPrimary: z.boolean().default(false),
  lockedUntil: z.string().nullable().default(null)
});

export const userProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.enum(roles),
  status: userProfileStatusSchema,
  pinHash: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const enrolledDeviceSchema = z.object({
  id: z.string(),
  deviceLabel: z.string(),
  status: enrolledDeviceStatusSchema,
  deviceSecretHash: z.string(),
  primaryProfileId: z.string(),
  trustExpiresAt: z.string(),
  lastSeenAt: z.string().nullable().default(null),
  createdByProfileId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const deviceAllowedProfileSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  profileId: z.string(),
  isPrimary: z.boolean().default(false),
  failedPinAttempts: z.number().int().nonnegative(),
  lockedUntil: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const deviceEnrollmentCodeSchema = z.object({
  id: z.string(),
  codeHash: z.string(),
  createdByProfileId: z.string(),
  primaryProfileId: z.string(),
  allowedProfileIds: z.array(z.string()).min(1).max(3),
  expiresAt: z.string(),
  consumedAt: z.string().nullable().default(null),
  consumedByDeviceId: z.string().nullable().default(null),
  createdAt: z.string()
});

export const deviceSessionSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  profileId: z.string(),
  sessionSecretHash: z.string(),
  idleExpiresAt: z.string(),
  absoluteExpiresAt: z.string(),
  lastSeenAt: z.string(),
  revokedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const authStateSchema = z.object({
  authMode: z.enum(["dev_headers", "trusted_proxy", "device_profiles"]),
  device: z.object({
    id: z.string(),
    deviceLabel: z.string(),
    status: enrolledDeviceStatusSchema,
    trustExpiresAt: z.string(),
    lastSeenAt: z.string().nullable().default(null)
  }).nullable().default(null),
  currentProfile: authProfileSummarySchema.nullable().default(null),
  allowedProfiles: z.array(authProfileSummarySchema).default([]),
  needsEnrollment: z.boolean().default(false),
  needsLogin: z.boolean().default(false),
  sessionExpiresAt: z.string().nullable().default(null),
  deviceIssue: z.enum(["not_enrolled", "revoked", "expired"]).nullable().default(null)
});

export const userProfileCreateSchema = z.object({
  displayName: z.string().min(1),
  role: z.enum(roles),
  pin: z.string().regex(/^\d{6}$/),
  status: userProfileStatusSchema.default("active")
});

export const userProfileUpdateSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(roles).optional(),
  pin: z.string().regex(/^\d{6}$/).optional(),
  status: userProfileStatusSchema.optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one profile field must be updated."
});

export const deviceEnrollmentCodeCreateSchema = z.object({
  primaryProfileId: z.string().min(1),
  allowedProfileIds: z.array(z.string().min(1)).min(1).max(3),
  expiresInMinutes: z.number().int().min(1).max(60).default(15)
});

export const deviceEnrollSchema = z.object({
  enrollmentCode: z.string().min(6),
  deviceLabel: z.string().min(1).max(120)
});

export const deviceProfileLoginSchema = z.object({
  profileId: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/)
});

export const enrolledDeviceUpdateSchema = z.object({
  deviceLabel: z.string().min(1).max(120).optional(),
  status: enrolledDeviceStatusSchema.optional(),
  primaryProfileId: z.string().min(1).optional(),
  allowedProfileIds: z.array(z.string().min(1)).min(1).max(3).optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one device field must be updated."
});

export type UserProfileStatus = z.infer<typeof userProfileStatusSchema>;
export type EnrolledDeviceStatus = z.infer<typeof enrolledDeviceStatusSchema>;
export type AuthProfileSummary = z.infer<typeof authProfileSummarySchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type EnrolledDevice = z.infer<typeof enrolledDeviceSchema>;
export type DeviceAllowedProfile = z.infer<typeof deviceAllowedProfileSchema>;
export type DeviceEnrollmentCode = z.infer<typeof deviceEnrollmentCodeSchema>;
export type DeviceSession = z.infer<typeof deviceSessionSchema>;
export type AuthState = z.infer<typeof authStateSchema>;
export type UserProfileCreateCommand = z.infer<typeof userProfileCreateSchema>;
export type UserProfileUpdateCommand = z.infer<typeof userProfileUpdateSchema>;
export type DeviceEnrollmentCodeCreateCommand = z.infer<typeof deviceEnrollmentCodeCreateSchema>;
export type DeviceEnrollCommand = z.infer<typeof deviceEnrollSchema>;
export type DeviceProfileLoginCommand = z.infer<typeof deviceProfileLoginSchema>;
export type EnrolledDeviceUpdateCommand = z.infer<typeof enrolledDeviceUpdateSchema>;

export function createUserProfile(input: {
  displayName: string;
  role: UserProfile["role"];
  pinHash: string;
  status?: UserProfileStatus;
}): UserProfile {
  const now = new Date().toISOString();
  return userProfileSchema.parse({
    id: randomId("profile"),
    displayName: input.displayName,
    role: input.role,
    status: input.status ?? "active",
    pinHash: input.pinHash,
    createdAt: now,
    updatedAt: now
  });
}

export function createEnrolledDevice(input: {
  deviceLabel: string;
  deviceSecretHash: string;
  primaryProfileId: string;
  trustExpiresAt: string;
  createdByProfileId: string;
}): EnrolledDevice {
  const now = new Date().toISOString();
  return enrolledDeviceSchema.parse({
    id: randomId("device"),
    deviceLabel: input.deviceLabel,
    status: "active",
    deviceSecretHash: input.deviceSecretHash,
    primaryProfileId: input.primaryProfileId,
    trustExpiresAt: input.trustExpiresAt,
    lastSeenAt: null,
    createdByProfileId: input.createdByProfileId,
    createdAt: now,
    updatedAt: now
  });
}

export function createDeviceAllowedProfile(input: {
  deviceId: string;
  profileId: string;
  isPrimary?: boolean;
}): DeviceAllowedProfile {
  const now = new Date().toISOString();
  return deviceAllowedProfileSchema.parse({
    id: randomId("device_profile"),
    deviceId: input.deviceId,
    profileId: input.profileId,
    isPrimary: input.isPrimary ?? false,
    failedPinAttempts: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now
  });
}

export function createDeviceEnrollmentCode(input: {
  codeHash: string;
  createdByProfileId: string;
  primaryProfileId: string;
  allowedProfileIds: string[];
  expiresAt: string;
}): DeviceEnrollmentCode {
  return deviceEnrollmentCodeSchema.parse({
    id: randomId("enrollment"),
    codeHash: input.codeHash,
    createdByProfileId: input.createdByProfileId,
    primaryProfileId: input.primaryProfileId,
    allowedProfileIds: input.allowedProfileIds,
    expiresAt: input.expiresAt,
    consumedAt: null,
    consumedByDeviceId: null,
    createdAt: new Date().toISOString()
  });
}

export function createDeviceSession(input: {
  deviceId: string;
  profileId: string;
  sessionSecretHash: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}): DeviceSession {
  const now = new Date().toISOString();
  return deviceSessionSchema.parse({
    id: randomId("session"),
    deviceId: input.deviceId,
    profileId: input.profileId,
    sessionSecretHash: input.sessionSecretHash,
    idleExpiresAt: input.idleExpiresAt,
    absoluteExpiresAt: input.absoluteExpiresAt,
    lastSeenAt: now,
    revokedAt: null,
    createdAt: now,
    updatedAt: now
  });
}
