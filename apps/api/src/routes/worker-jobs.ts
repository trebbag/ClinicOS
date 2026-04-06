import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireAnyRole } from "../lib/auth";

export async function registerWorkerJobRoutes(app: FastifyInstance): Promise<void> {
  app.get("/worker-jobs/summary", async (request) => {
    const actor = actorFromRequest(request);
    requireAnyRole(actor, ["medical_director", "quality_lead", "office_manager", "cfo"]);
    return app.clinicService.getWorkerJobSummary();
  });

  app.get("/worker-jobs", async (request) => {
    const actor = actorFromRequest(request);
    requireAnyRole(actor, ["medical_director", "quality_lead", "office_manager", "cfo"]);
    const query = request.query as {
      status?: string;
      type?: string;
      sourceEntityId?: string;
      sourceEntityType?: string;
    };
    return app.clinicService.listWorkerJobs(query);
  });

  app.post("/worker-jobs/:jobId/retry", async (request) => {
    const actor = actorFromRequest(request);
    requireAnyRole(actor, ["medical_director", "quality_lead", "office_manager", "cfo"]);
    const params = request.params as { jobId: string };
    return app.clinicService.retryWorkerJob(actor, params.jobId);
  });
}
