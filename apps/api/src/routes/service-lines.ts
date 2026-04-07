import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerServiceLineRoutes(app: FastifyInstance): Promise<void> {
  app.get("/service-lines", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "service_lines.view");
    const query = request.query as {
      governanceStatus?: string;
      ownerRole?: string;
    };
    return app.clinicService.listServiceLines(query);
  });

  app.post("/service-lines", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "service_lines.manage");
    return app.clinicService.createServiceLine(actor, request.body);
  });

  app.post("/service-lines/bootstrap-defaults", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "service_lines.manage");
    return app.clinicService.bootstrapServiceLines(actor);
  });

  app.patch("/service-lines/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "service_lines.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateServiceLine(actor, params.id, request.body);
  });

  app.post("/service-lines/:id/generate-pack", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "service_lines.manage");
    const params = request.params as { id: string };
    return app.clinicService.generateServiceLinePack(actor, params.id, request.body);
  });

  app.post("/service-lines/:id/submit-pack", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "service_lines.manage");
    const params = request.params as { id: string };
    return app.clinicService.submitServiceLinePack(actor, params.id);
  });

  app.post("/service-lines/:id/publish-pack", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "service_lines.manage");
    const params = request.params as { id: string };
    return app.clinicService.publishServiceLinePack(actor, params.id);
  });
}
