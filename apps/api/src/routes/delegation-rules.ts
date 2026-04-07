import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerDelegationRuleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/delegation-rules", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "delegation.view");
    const query = request.query as {
      serviceLineId?: string;
      performerRole?: string;
      status?: string;
      taskCode?: string;
    };
    return app.clinicService.listDelegationRules(query);
  });

  app.post("/delegation-rules", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "delegation.manage");
    return app.clinicService.createDelegationRule(actor, request.body);
  });

  app.post("/delegation-rules/bootstrap-defaults", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "delegation.manage");
    return app.clinicService.bootstrapDelegationRules(actor);
  });

  app.patch("/delegation-rules/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "delegation.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateDelegationRule(actor, params.id, request.body);
  });

  app.post("/delegation-rules/evaluate", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "delegation.view");
    return app.clinicService.evaluateDelegation(request.body);
  });
}
