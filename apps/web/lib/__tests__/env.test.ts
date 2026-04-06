import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBrowserApiUrl, getInternalApiBaseUrl } from "../env";

describe("web env helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds same-origin browser API URLs", () => {
    expect(buildBrowserApiUrl("/auth/state")).toBe("/clinic-api/auth/state");
  });

  it("prefers INTERNAL_API_BASE_URL for the server-side proxy target", () => {
    vi.stubEnv("INTERNAL_API_BASE_URL", "http://clinic-os-api.internal:4000");
    expect(getInternalApiBaseUrl()).toBe("http://clinic-os-api.internal:4000");
  });
});
