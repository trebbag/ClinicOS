import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerControlledSubstanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/controlled-substances", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "controlled_substances.view");
    const query = request.query as {
      status?: string;
      ownerRole?: string;
      supervisingPhysicianRole?: string;
      serviceLineId?: string;
    };
    return app.clinicService.listControlledSubstanceStewardship(query);
  });

  app.post("/controlled-substances", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "controlled_substances.manage");
    return app.clinicService.createControlledSubstanceStewardship(actor, request.body);
  });

  app.post("/controlled-substances/bootstrap-defaults", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "controlled_substances.manage");
    return app.clinicService.bootstrapControlledSubstanceStewardship(actor);
  });

  app.patch("/controlled-substances/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "controlled_substances.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateControlledSubstanceStewardship(actor, params.id, request.body);
  });

  app.post("/controlled-substances/:id/submit", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "controlled_substances.manage");
    const params = request.params as { id: string };
    return app.clinicService.submitControlledSubstanceStewardship(actor, params.id);
  });

  app.post("/controlled-substances/:id/publish", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "controlled_substances.manage");
    const params = request.params as { id: string };
    return app.clinicService.publishControlledSubstanceStewardship(actor, params.id);
  });
}
