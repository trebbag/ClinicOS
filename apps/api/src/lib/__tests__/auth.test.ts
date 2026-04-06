import { describe, expect, it } from "vitest";
import { MemoryClinicRepository } from "../repositories";
import { DeviceProfileAuthService } from "../deviceAuth";
import { buildIdentityResolver, canonicalTrustedProxyString, signTrustedProxyRequest } from "../auth";

describe("trusted proxy auth helpers", () => {
  it("builds a stable canonical signature payload", () => {
    expect(canonicalTrustedProxyString({
      actorId: "medical_director-user",
      role: "medical_director",
      name: "Dr. Review",
      timestamp: "2026-03-27T15:30:00.000Z",
      method: "get",
      path: "/auth/whoami"
    })).toBe(
      [
        "medical_director-user",
        "medical_director",
        "Dr. Review",
        "2026-03-27T15:30:00.000Z",
        "GET",
        "/auth/whoami"
      ].join("\n")
    );
  });

  it("signs trusted proxy payloads deterministically", () => {
    const signature = signTrustedProxyRequest({
      actorId: "medical_director-user",
      role: "medical_director",
      name: "Dr. Review",
      timestamp: "2026-03-27T15:30:00.000Z",
      method: "GET",
      path: "/auth/whoami",
      sharedSecret: "shared-secret"
    });

    expect(signature).toHaveLength(64);
    expect(signature).toBe(signTrustedProxyRequest({
      actorId: "medical_director-user",
      role: "medical_director",
      name: "Dr. Review",
      timestamp: "2026-03-27T15:30:00.000Z",
      method: "GET",
      path: "/auth/whoami",
      sharedSecret: "shared-secret"
    }));
  });

  it("builds the correct resolver for each auth mode", () => {
    expect(buildIdentityResolver({ mode: "dev_headers" }).mode).toBe("dev_headers");
    expect(buildIdentityResolver({
      mode: "trusted_proxy",
      sharedSecret: "shared-secret",
      allowedSkewSeconds: 60
    }).mode).toBe("trusted_proxy");
    expect(buildIdentityResolver({
      mode: "device_profiles",
      deviceAuthService: new DeviceProfileAuthService(new MemoryClinicRepository(), {
        mode: "device_profiles",
        secureCookies: false,
        cookieSameSite: "Strict",
        deviceTrustDays: 90,
        sessionIdleHours: 12,
        sessionAbsoluteDays: 7,
        failedPinLimit: 5,
        failedPinLockMinutes: 15,
        enrollmentTtlMinutes: 15
      })
    }).mode).toBe("device_profiles");
  });
});
