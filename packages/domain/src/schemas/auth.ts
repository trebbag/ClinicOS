import { z } from "zod";
import { actorContextSchema } from "./actor";
import { roles } from "../enums";

export const authModeSchema = z.enum([
  "dev_headers",
  "trusted_proxy",
  "device_profiles"
]);

export const resolvedIdentitySchema = actorContextSchema.extend({
  authMode: authModeSchema,
  authenticatedAt: z.string(),
  deviceId: z.string().nullable().default(null),
  profileId: z.string().nullable().default(null),
  grantedRoles: z.array(z.enum(roles)).default([])
});

export type AuthMode = z.infer<typeof authModeSchema>;
export type ResolvedIdentity = z.infer<typeof resolvedIdentitySchema>;
