import type { FastifyInstance } from "fastify";
import { env } from "../env";
import { actorFromRequest, requireAnyRole } from "../lib/auth";

export async function registerOpsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ops/config-status", async (request) => {
    const actor = actorFromRequest(request);
    requireAnyRole(actor, ["medical_director", "quality_lead", "office_manager", "hr_lead", "cfo"]);
    return app.clinicService.getRuntimeConfigStatus({
      nodeEnv: env.nodeEnv,
      publicAppOrigin: env.publicAppOrigin || null,
      databaseReady: await app.databaseReadyCheck()
    });
  });
}
