import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerTelehealthStewardshipRoutes(app: FastifyInstance): Promise<void> {
  app.get("/telehealth-stewardship", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "telehealth.view");
    const query = request.query as {
      status?: string;
      ownerRole?: string;
      supervisingPhysicianRole?: string;
    };
    return app.clinicService.listTelehealthStewardship(query);
  });

  app.post("/telehealth-stewardship", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "telehealth.manage");
    return app.clinicService.createTelehealthStewardship(actor, request.body);
  });

  app.post("/telehealth-stewardship/bootstrap-defaults", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "telehealth.manage");
    return app.clinicService.bootstrapTelehealthStewardship(actor);
  });

  app.patch("/telehealth-stewardship/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "telehealth.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateTelehealthStewardship(actor, params.id, request.body);
  });

  app.post("/telehealth-stewardship/:id/submit", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "telehealth.manage");
    const params = request.params as { id: string };
    return app.clinicService.submitTelehealthStewardship(actor, params.id);
  });

  app.post("/telehealth-stewardship/:id/publish", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "telehealth.manage");
    const params = request.params as { id: string };
    return app.clinicService.publishTelehealthStewardship(actor, params.id);
  });
}
