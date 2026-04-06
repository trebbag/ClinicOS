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

  app.post("/ops/cleanup", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "ops.run_cleanup");
    return app.clinicService.runOpsCleanup(actor, request.body ?? {});
  });
}
