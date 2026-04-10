import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerCommitteeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/committees/qapi-summary", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.view");
    return app.clinicService.getCommitteeQapiDashboardSummary();
  });

  app.get("/qapi/trends", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.view");
    const query = request.query as {
      months?: string;
    };
    return app.clinicService.getQapiTrendSummary({
      months: query.months ? Number(query.months) : undefined
    });
  });

  app.get("/committees", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.view");
    const query = request.query as {
      category?: string;
      serviceLine?: string;
      qapiFocus?: string;
      isActive?: string;
    };

    return app.clinicService.listCommittees({
      category: query.category,
      serviceLine: query.serviceLine,
      qapiFocus: query.qapiFocus === undefined ? undefined : query.qapiFocus === "true",
      isActive: query.isActive === undefined ? undefined : query.isActive === "true"
    });
  });

  app.post("/committees", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.manage");
    return app.clinicService.createCommittee(actor, request.body);
  });

  app.post("/committees/bootstrap-defaults", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.manage");
    return app.clinicService.bootstrapRecommendedCommittees(actor);
  });

  app.patch("/committees/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateCommittee(actor, params.id, request.body);
  });
}
