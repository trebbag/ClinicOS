import cors from "@fastify/cors";
import type { ClinicRepository } from "@clinic-os/db";
import { PrismaClinicRepository, prisma } from "@clinic-os/db";
import type { AuthMode } from "@clinic-os/domain";
import { buildMicrosoftPreflightService } from "@clinic-os/msgraph";
import Fastify from "fastify";
import { registerApprovalRoutes } from "./routes/approvals";
import { registerAuditRoutes } from "./routes/audit";
import { registerAuthRoutes } from "./routes/auth";
import { registerActionItemRoutes } from "./routes/action-items";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerCapaRoutes } from "./routes/capas";
import { registerCommitteeMeetingRoutes } from "./routes/committee-meetings";
import { registerCommitteeRoutes } from "./routes/committees";
import { registerDeviceRoutes } from "./routes/devices";
import { registerDocumentRoutes } from "./routes/documents";
import { registerHealthRoutes } from "./routes/health";
import { registerIntegrationRoutes } from "./routes/integrations";
import { registerMetricRoutes } from "./routes/metrics";
import { registerOfficeOpsRoutes } from "./routes/office-ops";
import { registerOpsRoutes } from "./routes/ops";
import { registerIncidentRoutes } from "./routes/incidents";
import { registerPublicAssetRoutes } from "./routes/public-assets";
import { registerScorecardReviewRoutes } from "./routes/scorecard-reviews";
import { registerTrainingRoutes } from "./routes/training";
import { registerUserProfileRoutes } from "./routes/user-profiles";
import { registerWorkflowRoutes } from "./routes/workflows";
import { registerWorkerJobRoutes } from "./routes/worker-jobs";
import { applyResolvedIdentity, buildIdentityResolver, isOptionalAuthRoute } from "./lib/auth";
import { DeviceProfileAuthService } from "./lib/deviceAuth";
import { forbidden, unauthorized } from "./lib/http";
import { ClinicApiService } from "./lib/services";
import { buildApprovedDocumentPublisher } from "./lib/publishing";
import { env } from "./env";

export function buildApp(options?: {
  authMode?: AuthMode;
  repository?: ClinicRepository;
  service?: ClinicApiService;
  deviceAuthService?: DeviceProfileAuthService;
  identityResolver?: ReturnType<typeof buildIdentityResolver>;
  databaseReadyCheck?: () => Promise<boolean>;
}) {
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: env.nodeEnv === "production" ? env.publicAppOrigin : true,
    credentials: true
  });

  const repository = options?.repository ?? new PrismaClinicRepository(prisma);
  const authMode = options?.authMode ?? env.auth.mode;
  const service =
    options?.service ??
    new ClinicApiService(
      repository,
      buildApprovedDocumentPublisher(),
      {
        authMode,
        integrationMode: env.microsoft.integrationMode,
        microsoftPreflight: buildMicrosoftPreflightService({
          mode: env.microsoft.integrationMode,
          tenantId: env.microsoft.tenantId,
          clientId: env.microsoft.clientId,
          clientSecret: env.microsoft.clientSecret,
          sharepointSiteId: env.microsoft.sharepointSiteId,
          sharepointPolicyFolder: env.microsoft.sharepointPolicyFolder,
          listsSiteId: env.microsoft.listsSiteId,
          plannerPlanId: env.microsoft.plannerPlanId,
          plannerBucketId: env.microsoft.plannerBucketId,
          approvalsWebhookUrl: env.microsoft.approvalsWebhookUrl,
          officeOpsWebhookUrl: env.microsoft.officeOpsWebhookUrl,
          issueListId: env.microsoft.issueListId,
          actionItemListId: env.microsoft.actionItemListId,
          importStatusListId: env.microsoft.importStatusListId
        }),
        incidentListSyncEnabled: Boolean(env.microsoft.listsSiteId && env.microsoft.incidentsListId),
        capaListSyncEnabled: Boolean(env.microsoft.listsSiteId && env.microsoft.capaListId)
      }
    );
  const deviceAuthService =
    options?.deviceAuthService ??
    new DeviceProfileAuthService(repository, {
      mode: authMode,
      secureCookies: env.nodeEnv === "production",
      cookieSameSite: "Strict",
      deviceTrustDays: 90,
      sessionIdleHours: 12,
      sessionAbsoluteDays: 7,
      failedPinLimit: 5,
      failedPinLockMinutes: 15,
      enrollmentTtlMinutes: 15
    });
  const identityResolver = options?.identityResolver ?? buildIdentityResolver({
    mode: authMode,
    deviceAuthService
  });
  const databaseReadyCheck =
    options?.databaseReadyCheck ??
    (async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    });

  app.decorate("clinicService", service);
  app.decorate("deviceAuthService", deviceAuthService);
  app.decorate("identityResolver", identityResolver);
  app.decorate("databaseReadyCheck", databaseReadyCheck);
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const statusCode = typeof error.statusCode === "number"
      ? error.statusCode
      : 500;

    reply.status(statusCode).send({
      error: error.name,
      message: error.message
    });
  });

  app.addHook("onRequest", async (request) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (request.method === "OPTIONS" || pathname === "/health" || pathname === "/healthz" || pathname === "/readyz") {
      return;
    }

    if (authMode === "device_profiles" && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
      const origin = request.headers.origin;
      const expectedOrigin = new URL(env.publicAppOrigin).origin;
      if (typeof origin !== "string" || origin !== expectedOrigin) {
        forbidden("Mutating requests must originate from the trusted Clinic OS site.");
      }
    }

    const optional = isOptionalAuthRoute(pathname);
    const identity = await app.identityResolver.resolve(request, { optional });
    if (identity) {
      applyResolvedIdentity(request, identity);
      return;
    }
    if (!optional) {
      unauthorized("Authentication is required for this request.");
    }
  });

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerUserProfileRoutes(app);
  registerDeviceRoutes(app);
  registerDashboardRoutes(app);
  registerOpsRoutes(app);
  registerIntegrationRoutes(app);
  registerWorkflowRoutes(app);
  registerDocumentRoutes(app);
  registerApprovalRoutes(app);
  registerActionItemRoutes(app);
  registerIncidentRoutes(app);
  registerCapaRoutes(app);
  registerCommitteeRoutes(app);
  registerCommitteeMeetingRoutes(app);
  registerPublicAssetRoutes(app);
  registerOfficeOpsRoutes(app);
  registerAuditRoutes(app);
  registerMetricRoutes(app);
  registerScorecardReviewRoutes(app);
  registerTrainingRoutes(app);
  registerWorkerJobRoutes(app);

  return app;
}
