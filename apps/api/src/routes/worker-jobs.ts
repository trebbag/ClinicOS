import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerWorkerJobRoutes(app: FastifyInstance): Promise<void> {
  app.get("/worker-jobs/summary", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "worker_jobs.view");
    return app.clinicService.getWorkerJobSummary();
  });

  app.get("/worker-jobs", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "worker_jobs.view");
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
    requireCapability(actor, "worker_jobs.retry");
    const params = request.params as { jobId: string };
    return app.clinicService.retryWorkerJob(actor, params.jobId);
  });

  app.post("/worker-jobs/run-once", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "worker_jobs.retry");
    return app.clinicService.runWorkerBatch(actor, () => app.runWorkerBatch());
  });
}
