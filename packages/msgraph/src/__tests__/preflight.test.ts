import { describe, expect, it, vi } from "vitest";
import { buildMicrosoftPreflightService } from "../preflight";

describe("Microsoft preflight", () => {
  it("reports missing config before attempting Graph validation", async () => {
    const service = buildMicrosoftPreflightService({
      mode: "stub"
    });

    const result = await service.validate();
    expect(result.configComplete).toBe(false);
    expect(result.overallStatus).toBe("missing_config");
    expect(result.missingConfigKeys).toContain("MICROSOFT_TENANT_ID");
    expect(result.surfaces.every((surface) => surface.status === "missing_config")).toBe(true);
  });

  it("reports ready when all configured surfaces are reachable", async () => {
    const request = vi.fn().mockResolvedValue({});
    const service = buildMicrosoftPreflightService({
      mode: "live",
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      sharepointSiteId: "site",
      sharepointPolicyFolder: "ClinicOS/approved-documents",
      listsSiteId: "lists-site",
      plannerPlanId: "plan",
      plannerBucketId: "bucket",
      approvalsWebhookUrl: "https://contoso.example/approvals",
      officeOpsWebhookUrl: "https://contoso.example/office-ops",
      issueListId: "issue-list",
      actionItemListId: "action-list",
      importStatusListId: "import-list"
    }, { request });

    const result = await service.validate();
    expect(result.configComplete).toBe(true);
    expect(result.readyForLive).toBe(true);
    expect(result.overallStatus).toBe("ready");
    expect(request).toHaveBeenCalled();
    expect(result.surfaces.find((surface) => surface.key === "teams")).toEqual(
      expect.objectContaining({
        status: "ready",
        verificationMode: "config_only"
      })
    );
  });

  it("marks surfaces unreachable when Graph calls fail", async () => {
    const request = vi.fn().mockRejectedValue(new Error("Graph request failed (404): not found"));
    const service = buildMicrosoftPreflightService({
      mode: "live",
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      sharepointSiteId: "site",
      sharepointPolicyFolder: "ClinicOS/approved-documents",
      listsSiteId: "lists-site",
      plannerPlanId: "plan",
      plannerBucketId: "bucket",
      approvalsWebhookUrl: "https://contoso.example/approvals",
      officeOpsWebhookUrl: "https://contoso.example/office-ops",
      issueListId: "issue-list",
      actionItemListId: "action-list",
      importStatusListId: "import-list"
    }, { request });

    const result = await service.validate();
    expect(result.overallStatus).toBe("degraded");
    expect(result.surfaces.some((surface) => surface.status === "unreachable")).toBe(true);
  });

  it("treats invalid Teams webhook URLs as missing config", async () => {
    const request = vi.fn().mockResolvedValue({});
    const service = buildMicrosoftPreflightService({
      mode: "live",
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      sharepointSiteId: "site",
      sharepointPolicyFolder: "ClinicOS/approved-documents",
      listsSiteId: "lists-site",
      plannerPlanId: "plan",
      plannerBucketId: "bucket",
      approvalsWebhookUrl: "not-a-url",
      officeOpsWebhookUrl: "https://contoso.example/office-ops",
      issueListId: "issue-list",
      actionItemListId: "action-list",
      importStatusListId: "import-list"
    }, { request });

    const result = await service.validate();
    expect(result.missingConfigKeys).toContain("MICROSOFT_TEAMS_APPROVALS_WEBHOOK_URL");
    expect(result.surfaces.find((surface) => surface.key === "teams")?.status).toBe("missing_config");
  });
});
