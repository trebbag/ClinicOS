import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerCapaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/capas", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "quality.view");
    const query = request.query as {
      status?: string;
      sourceType?: string;
      ownerRole?: string;
      incidentId?: string;
    };
    return app.clinicService.listCapas(query);
  });

  app.post("/capas", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "quality.manage");
    return app.clinicService.createCapa(actor, request.body);
  });

  app.patch("/capas/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "quality.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateCapa(actor, params.id, request.body);
  });

  app.post("/capas/:id/resolve", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "quality.manage");
    const params = request.params as { id: string };
    return app.clinicService.resolveCapa(actor, params.id, request.body);
  });
}
