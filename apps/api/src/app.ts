import cors from "@fastify/cors";
import type { ClinicRepository } from "@clinic-os/db";
import type { MicrosoftPilotOps } from "@clinic-os/msgraph";
import { PrismaClinicRepository, prisma } from "@clinic-os/db";
import type { AuthMode, WorkerBatchSummary } from "@clinic-os/domain";
import { buildMicrosoftPilotOps, buildMicrosoftPreflightService } from "@clinic-os/msgraph";
import Fastify from "fastify";
import { registerApprovalRoutes } from "./routes/approvals";
import { registerAuditRoutes } from "./routes/audit";
import { registerAuthRoutes } from "./routes/auth";
import { registerActionItemRoutes } from "./routes/action-items";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerCapaRoutes } from "./routes/capas";
import { registerCommitteeMeetingRoutes } from "./routes/committee-meetings";
import { registerCommitteeRoutes } from "./routes/committees";
import { registerControlledSubstanceRoutes } from "./routes/controlled-substances";
import { registerDelegationRuleRoutes } from "./routes/delegation-rules";
import { registerDeviceRoutes } from "./routes/devices";
import { registerDocumentRoutes } from "./routes/documents";
import { registerHealthRoutes } from "./routes/health";
import { registerIntegrationRoutes } from "./routes/integrations";
import { registerMetricRoutes } from "./routes/metrics";
import { registerOfficeOpsRoutes } from "./routes/office-ops";
import { registerOpsRoutes } from "./routes/ops";
import { registerIncidentRoutes } from "./routes/incidents";
import { registerPublicAssetRoutes } from "./routes/public-assets";
import { registerPracticeAgreementRoutes } from "./routes/practice-agreements";
import { registerRevenueRoutes } from "./routes/revenue";
import { registerRuntimeAgentRoutes } from "./routes/runtime-agents";
import { registerScorecardReviewRoutes } from "./routes/scorecard-reviews";
import { registerServiceLineRoutes } from "./routes/service-lines";
import { registerStandardsRoutes } from "./routes/standards";
import { registerTelehealthStewardshipRoutes } from "./routes/telehealth-stewardship";
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
import { WorkerJobRunner } from "../../worker/src/jobs";
import { createWorkerRuntimeRecorder } from "../../worker/src/runtime";

export function buildApp(options?: {
  authMode?: AuthMode;
  repository?: ClinicRepository;
  service?: ClinicApiService;
  deviceAuthService?: DeviceProfileAuthService;
  identityResolver?: ReturnType<typeof buildIdentityResolver>;
  databaseReadyCheck?: () => Promise<boolean>;
  enableBackgroundWorkerAssist?: boolean;
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
  const microsoftPilotOps: MicrosoftPilotOps = buildMicrosoftPilotOps({
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
    importStatusListId: env.microsoft.importStatusListId,
    incidentsListId: env.microsoft.incidentsListId,
    capaListId: env.microsoft.capaListId
  });
  const service =
    options?.service ??
    new ClinicApiService(
      repository,
      buildApprovedDocumentPublisher(),
      {
        authMode,
        integrationMode: env.microsoft.integrationMode,
        openaiApiKey: env.openaiApiKey,
        runtimeAgentsConfigValue: env.runtimeAgentsConfigValue,
        runtimeAgentsEnabled: env.runtimeAgentsEnabled,
        pilotOps: microsoftPilotOps,
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

  const runWorkerBatch = async (): Promise<WorkerBatchSummary> => {
    const runner = new WorkerJobRunner(repository, microsoftPilotOps);
    return runner.runOnce({ limit: Number(process.env.WORKER_BATCH_SIZE ?? 10) });
  };
  const enableBackgroundWorkerAssist =
    options?.enableBackgroundWorkerAssist
    ?? (env.nodeEnv === "production" && process.env.API_BACKGROUND_WORKER_ASSIST_ENABLED !== "false");

  app.decorate("clinicService", service);
  app.decorate("deviceAuthService", deviceAuthService);
  app.decorate("identityResolver", identityResolver);
  app.decorate("databaseReadyCheck", databaseReadyCheck);
  app.decorate("runWorkerBatch", runWorkerBatch);
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
  registerRuntimeAgentRoutes(app);
  registerRevenueRoutes(app);
  registerCommitteeRoutes(app);
  registerCommitteeMeetingRoutes(app);
  registerServiceLineRoutes(app);
  registerPracticeAgreementRoutes(app);
  registerTelehealthStewardshipRoutes(app);
  registerControlledSubstanceRoutes(app);
  registerDelegationRuleRoutes(app);
  registerStandardsRoutes(app);
  registerPublicAssetRoutes(app);
  registerOfficeOpsRoutes(app);
  registerAuditRoutes(app);
  registerMetricRoutes(app);
  registerScorecardReviewRoutes(app);
  registerTrainingRoutes(app);
  registerWorkerJobRoutes(app);

  if (enableBackgroundWorkerAssist) {
    const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5_000);
    const heartbeatIntervalMs = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 300_000);
    const batchSize = Number(process.env.WORKER_BATCH_SIZE ?? 10);
    const runtimeRecorder = createWorkerRuntimeRecorder({
      repository,
      source: "api_assist",
      pollIntervalMs,
      heartbeatIntervalMs,
      batchSize,
      integrationMode: env.microsoft.integrationMode,
      log: (entry) => {
        app.log.warn({
          event: entry.event,
          message: entry.message,
          detail: entry.detail
        }, "Clinic OS API worker assist runtime warning");
      }
    });
    let timer: NodeJS.Timeout | null = null;
    let running = false;

    const tick = async () => {
      if (running) {
        return;
      }
      running = true;
      const batchStartedAt = new Date().toISOString();
      try {
        const summary = await runWorkerBatch();
        const checkedAt = new Date().toISOString();
        if (summary.processed > 0 || summary.failed > 0) {
          app.log.info({
            event: "worker.assist.batch.complete",
            summary,
            checkedAt
          }, "Clinic OS API worker assist processed a batch");
        }
        await runtimeRecorder.recordBatchCompleted(summary, checkedAt, batchStartedAt);
      } catch (error) {
        const checkedAt = new Date().toISOString();
        app.log.error({
          event: "worker.assist.batch.failed",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          checkedAt
        }, "Clinic OS API worker assist failed");
        await runtimeRecorder.recordBatchFailed(error, checkedAt, batchStartedAt);
      } finally {
        running = false;
      }
    };

    app.addHook("onReady", async () => {
      app.log.info({
        event: "worker.assist.started",
        pollIntervalMs,
        heartbeatIntervalMs,
        batchSize
      }, "Clinic OS API worker assist started");
      await runtimeRecorder.recordStarted();
      void tick();
      timer = setInterval(() => {
        void tick();
      }, pollIntervalMs);
    });

    app.addHook("onClose", async () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
  }

  return app;
}
