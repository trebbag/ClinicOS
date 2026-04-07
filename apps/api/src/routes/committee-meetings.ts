import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerCommitteeMeetingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/committee-meetings", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.view");
    const query = request.query as {
      committeeId?: string;
      status?: string;
    };
    return app.clinicService.listCommitteeMeetings(query);
  });

  app.post("/committee-meetings", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.manage");
    return app.clinicService.createCommitteeMeeting(actor, request.body);
  });

  app.post("/committee-meetings/:id/generate-packet", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.manage");
    const params = request.params as { id: string };
    return app.clinicService.generateCommitteePacket(actor, params.id);
  });

  app.post("/committee-meetings/:id/submit", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.manage");
    const params = request.params as { id: string };
    return app.clinicService.submitCommitteeMeeting(actor, params.id);
  });

  app.post("/committee-meetings/:id/record-decisions", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.manage");
    const params = request.params as { id: string };
    return app.clinicService.recordCommitteeDecisions(actor, params.id, request.body);
  });

  app.post("/committee-meetings/:id/complete", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "committees.manage");
    const params = request.params as { id: string };
    return app.clinicService.completeCommitteeMeeting(actor, params.id, request.body);
  });
}
