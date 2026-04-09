import type { FastifyInstance } from "fastify";
import { env } from "../env";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerOpsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ops/config-status", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.view_config");
    return app.clinicService.getRuntimeConfigStatus({
      nodeEnv: env.nodeEnv,
      publicAppOrigin: env.publicAppOrigin || null,
      databaseReady: await app.databaseReadyCheck()
    });
  });

  app.get("/ops/role-capabilities", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "pilot_ops.view");
    return app.clinicService.getRoleCapabilities();
  });

  app.get("/ops/maintenance-summary", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.view_config");
    return app.clinicService.getOpsMaintenanceSummary();
  });

  app.get("/ops/deployment-promotions", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.view_config");
    const query = request.query as {
      environmentKey?: string;
      status?: string;
      targetAuthMode?: string;
    };
    return app.clinicService.listDeploymentPromotions(query);
  });

  app.post("/ops/deployment-promotions", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.run_cleanup");
    return app.clinicService.createDeploymentPromotion(actor, request.body);
  });

  app.patch("/ops/deployment-promotions/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.run_cleanup");
    const params = request.params as { id: string };
    return app.clinicService.updateDeploymentPromotion(actor, params.id, request.body);
  });

  app.get("/ops/worker-health", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.view_config");
    return app.clinicService.getWorkerRuntimeStatus();
  });

  app.get("/ops/alerts", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.view_config");
    return app.clinicService.getOpsAlertSummary({
      nodeEnv: env.nodeEnv,
      publicAppOrigin: env.publicAppOrigin || null,
      databaseReady: await app.databaseReadyCheck()
    });
  });

  app.post("/ops/alerts/dispatch", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.run_cleanup");
    return app.clinicService.dispatchCriticalOpsAlerts(actor);
  });

  app.post("/ops/cleanup", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.run_cleanup");
    return app.clinicService.runOpsCleanup(actor, request.body ?? {});
  });
}
