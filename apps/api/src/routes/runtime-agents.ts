import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerRuntimeAgentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/runtime-agents", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "runtime_agents.view");
    return app.clinicService.getRuntimeAgentStatus();
  });

  app.post("/runtime-agents/run", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "runtime_agents.run");
    return app.clinicService.runRuntimeAgent(actor, request.body ?? {});
  });
}
