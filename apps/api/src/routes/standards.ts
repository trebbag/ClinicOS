import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerStandardsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/standards", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.view");
    const query = request.query as {
      domain?: string;
      ownerRole?: string;
      status?: string;
      sourceAuthority?: string;
    };
    return app.clinicService.listStandardMappings(query);
  });

  app.post("/standards", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.manage");
    return app.clinicService.createStandardMapping(actor, request.body);
  });

  app.post("/standards/bootstrap-defaults", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.manage");
    return app.clinicService.bootstrapStandards(actor);
  });

  app.patch("/standards/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateStandardMapping(actor, params.id, request.body);
  });

  app.get("/evidence-binders", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.view");
    const query = request.query as {
      status?: string;
      ownerRole?: string;
      sourceAuthority?: string;
    };
    return app.clinicService.listEvidenceBinders(query);
  });

  app.post("/evidence-binders", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.manage");
    return app.clinicService.createEvidenceBinder(actor, request.body);
  });

  app.post("/evidence-binders/bootstrap-defaults", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.manage");
    return app.clinicService.bootstrapEvidenceBinders(actor);
  });

  app.patch("/evidence-binders/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateEvidenceBinder(actor, params.id, request.body);
  });

  app.post("/evidence-binders/:id/submit", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.manage");
    const params = request.params as { id: string };
    return app.clinicService.submitEvidenceBinder(actor, params.id);
  });

  app.post("/evidence-binders/:id/publish", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "standards.manage");
    const params = request.params as { id: string };
    return app.clinicService.publishEvidenceBinder(actor, params.id);
  });
}
