import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerIncidentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/incidents", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "quality.view");
    const query = request.query as {
      status?: string;
      severity?: string;
      ownerRole?: string;
      linkedCapaId?: string;
    };
    return app.clinicService.listIncidents(query);
  });

  app.post("/incidents", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "quality.manage");
    return app.clinicService.createIncident(actor, request.body);
  });

  app.patch("/incidents/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "quality.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateIncident(actor, params.id, request.body);
  });

  app.post("/incidents/:id/review", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "quality.manage");
    const params = request.params as { id: string };
    return app.clinicService.reviewIncident(actor, params.id, request.body);
  });
}
