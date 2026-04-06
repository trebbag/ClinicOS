import type { FastifyInstance, FastifyReply } from "fastify";
import { actorFromRequest, resolvedIdentityFromRequest } from "../lib/auth";
import {
  appendSetCookie,
  DEVICE_COOKIE_NAME,
  parseCookies,
  serializeCookie,
  SESSION_COOKIE_NAME
} from "../lib/deviceAuth";

const deviceCookieMaxAgeSeconds = 90 * 24 * 60 * 60;
const sessionCookieMaxAgeSeconds = 7 * 24 * 60 * 60;

function writeDeviceCookie(reply: FastifyReply, token: string): void {
  appendSetCookie(
    reply,
    serializeCookie(DEVICE_COOKIE_NAME, token, {
      httpOnly: true,
      maxAgeSeconds: deviceCookieMaxAgeSeconds,
      path: "/",
      sameSite: "Strict",
      secure: process.env.NODE_ENV === "production"
    })
  );
}

function writeSessionCookie(reply: FastifyReply, token: string): void {
  appendSetCookie(
    reply,
    serializeCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      maxAgeSeconds: sessionCookieMaxAgeSeconds,
      path: "/",
      sameSite: "Strict",
      secure: process.env.NODE_ENV === "production"
    })
  );
}

function clearSessionCookie(reply: FastifyReply): void {
  appendSetCookie(
    reply,
    serializeCookie(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      maxAgeSeconds: 0,
      path: "/",
      sameSite: "Strict",
      secure: process.env.NODE_ENV === "production"
    })
  );
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/state", async (request) => {
    const cookies = parseCookies(request.headers.cookie);
    const state = await app.deviceAuthService.getAuthState({
      deviceToken: cookies[DEVICE_COOKIE_NAME] ?? null,
      sessionToken: cookies[SESSION_COOKIE_NAME] ?? null
    });

    return {
      ...state,
      actor: request.clinicActor ?? null
    };
  });

  app.get("/auth/whoami", async (request) => {
    const actor = actorFromRequest(request);
    const identity = resolvedIdentityFromRequest(request);

    return {
      actor,
      authMode: identity.authMode,
      authenticatedAt: identity.authenticatedAt,
      deviceId: identity.deviceId,
      profileId: identity.profileId
    };
  });

  app.post("/auth/enrollment-codes", async (request) => {
    return app.deviceAuthService.createEnrollmentCode(actorFromRequest(request), request.body);
  });

  app.post("/auth/enroll-device", async (request, reply) => {
    const { deviceToken, state } = await app.deviceAuthService.enrollDevice(request.body);
    writeDeviceCookie(reply, deviceToken);
    clearSessionCookie(reply);
    return state;
  });

  app.post("/auth/login", async (request, reply) => {
    const cookies = parseCookies(request.headers.cookie);
    const { sessionToken, state } = await app.deviceAuthService.loginWithDevice({
      deviceToken: cookies[DEVICE_COOKIE_NAME] ?? null,
      sessionToken: cookies[SESSION_COOKIE_NAME] ?? null,
      body: request.body,
      reason: "login"
    });
    writeSessionCookie(reply, sessionToken);
    return state;
  });

  app.post("/auth/switch-profile", async (request, reply) => {
    const cookies = parseCookies(request.headers.cookie);
    const { sessionToken, state } = await app.deviceAuthService.loginWithDevice({
      deviceToken: cookies[DEVICE_COOKIE_NAME] ?? null,
      sessionToken: cookies[SESSION_COOKIE_NAME] ?? null,
      body: request.body,
      reason: "switch_profile"
    });
    writeSessionCookie(reply, sessionToken);
    return state;
  });

  app.post("/auth/lock", async (request, reply) => {
    const cookies = parseCookies(request.headers.cookie);
    const state = await app.deviceAuthService.lock({
      deviceToken: cookies[DEVICE_COOKIE_NAME] ?? null,
      sessionToken: cookies[SESSION_COOKIE_NAME] ?? null
    });
    clearSessionCookie(reply);
    return state;
  });

  app.post("/auth/logout", async (request, reply) => {
    const cookies = parseCookies(request.headers.cookie);
    const state = await app.deviceAuthService.logout({
      deviceToken: cookies[DEVICE_COOKIE_NAME] ?? null,
      sessionToken: cookies[SESSION_COOKIE_NAME] ?? null
    });
    clearSessionCookie(reply);
    return state;
  });
}
