import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerPracticeAgreementRoutes(app: FastifyInstance): Promise<void> {
  app.get("/practice-agreements", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "practice_agreements.view");
    const query = request.query as {
      status?: string;
      ownerRole?: string;
      supervisingPhysicianRole?: string;
      supervisedRole?: string;
      agreementType?: string;
      serviceLineId?: string;
    };
    return app.clinicService.listPracticeAgreements(query);
  });

  app.post("/practice-agreements", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "practice_agreements.manage");
    return app.clinicService.createPracticeAgreement(actor, request.body);
  });

  app.post("/practice-agreements/bootstrap-defaults", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "practice_agreements.manage");
    return app.clinicService.bootstrapPracticeAgreements(actor);
  });

  app.patch("/practice-agreements/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "practice_agreements.manage");
    const params = request.params as { id: string };
    return app.clinicService.updatePracticeAgreement(actor, params.id, request.body);
  });

  app.post("/practice-agreements/:id/submit", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "practice_agreements.manage");
    const params = request.params as { id: string };
    return app.clinicService.submitPracticeAgreement(actor, params.id);
  });

  app.post("/practice-agreements/:id/publish", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "practice_agreements.manage");
    const params = request.params as { id: string };
    return app.clinicService.publishPracticeAgreement(actor, params.id);
  });
}
