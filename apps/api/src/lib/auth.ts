import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import {
  actorContextSchema,
  resolvedIdentitySchema,
  type ActorContext,
  type AuthMode,
  type ResolvedIdentity,
  type Role
} from "@clinic-os/domain";
import { env } from "../env";
import {
  DEVICE_COOKIE_NAME,
  DeviceProfileAuthService,
  parseCookies,
  SESSION_COOKIE_NAME
} from "./deviceAuth";
import { forbidden, unauthorized } from "./http";

type SignedProxyResolverOptions = {
  sharedSecret: string;
  allowedSkewSeconds: number;
  now?: () => Date;
};

export interface IdentityResolver {
  readonly mode: AuthMode;
  resolve(
    request: FastifyRequest,
    options?: { optional?: boolean }
  ): Promise<ResolvedIdentity | null>;
}

function requestPath(request: FastifyRequest): string {
  return new URL(request.url, "http://localhost").pathname;
}

function parseActorHeaders(request: FastifyRequest) {
  return actorContextSchema.safeParse({
    actorId: request.headers["x-clinic-user-id"],
    role: request.headers["x-clinic-user-role"],
    name: request.headers["x-clinic-user-name"]
  });
}

function readActorHeaders(request: FastifyRequest): ActorContext {
  const parsed = parseActorHeaders(request);

  if (!parsed.success) {
    unauthorized("Missing or invalid actor headers.");
  }

  return parsed.data;
}

export function canonicalTrustedProxyString(input: {
  actorId: string;
  role: string;
  name?: string;
  timestamp: string;
  method: string;
  path: string;
}): string {
  return [
    input.actorId,
    input.role,
    input.name ?? "",
    input.timestamp,
    input.method.toUpperCase(),
    input.path
  ].join("\n");
}

export function signTrustedProxyRequest(input: {
  actorId: string;
  role: string;
  name?: string;
  timestamp: string;
  method: string;
  path: string;
  sharedSecret: string;
}): string {
  const payload = canonicalTrustedProxyString(input);
  return createHmac("sha256", input.sharedSecret).update(payload).digest("hex");
}

class DevHeaderResolver implements IdentityResolver {
  readonly mode = "dev_headers" as const;

  async resolve(
    request: FastifyRequest,
    options?: { optional?: boolean }
  ): Promise<ResolvedIdentity | null> {
    const parsed = parseActorHeaders(request);
    if (!parsed.success) {
      if (options?.optional) {
        return null;
      }
      unauthorized("Missing or invalid actor headers.");
    }

    return resolvedIdentitySchema.parse({
      ...parsed.data,
      authMode: this.mode,
      authenticatedAt: new Date().toISOString()
    });
  }
}

class SignedProxyResolver implements IdentityResolver {
  readonly mode = "trusted_proxy" as const;
  private readonly now: () => Date;

  constructor(private readonly options: SignedProxyResolverOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async resolve(
    request: FastifyRequest,
    options?: { optional?: boolean }
  ): Promise<ResolvedIdentity | null> {
    const actorParsed = parseActorHeaders(request);
    const timestamp = request.headers["x-clinic-auth-ts"];
    const signature = request.headers["x-clinic-auth-signature"];

    if (!actorParsed.success && typeof timestamp !== "string" && typeof signature !== "string" && options?.optional) {
      return null;
    }

    if (!actorParsed.success) {
      unauthorized("Missing or invalid actor headers.");
    }

    const actor = actorParsed.data;

    if (typeof timestamp !== "string" || typeof signature !== "string") {
      unauthorized("Missing trusted proxy signature headers.");
    }

    const requestTime = new Date(timestamp);
    if (Number.isNaN(requestTime.getTime())) {
      unauthorized("Invalid trusted proxy timestamp.");
    }

    const skewMs = Math.abs(this.now().getTime() - requestTime.getTime());
    if (skewMs > this.options.allowedSkewSeconds * 1000) {
      unauthorized("Trusted proxy signature expired.");
    }

    const expectedSignature = signTrustedProxyRequest({
      actorId: actor.actorId,
      role: actor.role,
      name: actor.name,
      timestamp,
      method: request.method,
      path: requestPath(request),
      sharedSecret: this.options.sharedSecret
    });

    const provided = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      unauthorized("Invalid trusted proxy signature.");
    }

    return resolvedIdentitySchema.parse({
      ...actor,
      authMode: this.mode,
      authenticatedAt: requestTime.toISOString()
    });
  }
}

class DeviceProfilesResolver implements IdentityResolver {
  readonly mode = "device_profiles" as const;

  constructor(private readonly deviceAuthService: DeviceProfileAuthService) {}

  async resolve(
    request: FastifyRequest,
    _options?: { optional?: boolean }
  ): Promise<ResolvedIdentity | null> {
    const cookies = parseCookies(request.headers.cookie);
    return this.deviceAuthService.resolveIdentityFromTokens({
      deviceToken: cookies[DEVICE_COOKIE_NAME] ?? null,
      sessionToken: cookies[SESSION_COOKIE_NAME] ?? null
    });
  }
}

const optionalAuthRoutes = new Set([
  "/auth/state",
  "/auth/enroll-device",
  "/auth/login",
  "/auth/switch-profile",
  "/auth/lock",
  "/auth/logout"
]);

export function isOptionalAuthRoute(pathname: string): boolean {
  return optionalAuthRoutes.has(pathname);
}

export function buildIdentityResolver(options?: {
  mode?: AuthMode;
  sharedSecret?: string;
  allowedSkewSeconds?: number;
  now?: () => Date;
  deviceAuthService?: DeviceProfileAuthService;
}): IdentityResolver {
  const mode = options?.mode ?? env.auth.mode;
  if (mode === "device_profiles") {
    if (!options?.deviceAuthService) {
      throw new Error("Missing DeviceProfileAuthService for device_profiles auth mode.");
    }

    return new DeviceProfilesResolver(options.deviceAuthService);
  }

  if (mode === "trusted_proxy") {
    const sharedSecret = options?.sharedSecret ?? env.auth.trustedProxySharedSecret;
    if (!sharedSecret) {
      throw new Error("Missing TRUSTED_PROXY_SHARED_SECRET for trusted proxy auth mode.");
    }

    return new SignedProxyResolver({
      sharedSecret,
      allowedSkewSeconds: options?.allowedSkewSeconds ?? env.auth.trustedProxyAllowedSkewSeconds,
      now: options?.now
    });
  }

  return new DevHeaderResolver();
}

export function applyResolvedIdentity(
  request: FastifyRequest,
  identity: ResolvedIdentity
): ActorContext {
  const actor = actorContextSchema.parse({
    actorId: identity.actorId,
    role: identity.role,
    name: identity.name
  });

  request.clinicActor = actor;
  request.resolvedIdentity = identity;
  return actor;
}

export function actorFromRequest(request: FastifyRequest): ActorContext {
  if (!request.clinicActor) {
    unauthorized("Request identity was not resolved.");
  }

  return request.clinicActor;
}

export function resolvedIdentityFromRequest(request: FastifyRequest): ResolvedIdentity {
  if (!request.resolvedIdentity) {
    unauthorized("Request identity was not resolved.");
  }

  return request.resolvedIdentity;
}

export function requireAnyRole(actor: ActorContext, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(actor.role)) {
    forbidden(`Role ${actor.role} is not allowed to perform this action.`);
  }
}
