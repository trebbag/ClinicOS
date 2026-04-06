import type { FastifyInstance } from "fastify";
import { actorFromRequest } from "../lib/auth";

export async function registerWorkflowRoutes(app: FastifyInstance): Promise<void> {
  app.get("/workflows", async () => app.clinicService.listWorkflowDefinitions());

  app.get("/workflow-runs", async (request) => {
    const query = request.query as { workflowDefinitionId?: string };
    return app.clinicService.listWorkflowRuns(query);
  });

  app.post("/workflow-runs", async (request) => {
    const body = request.body as {
      workflowId: string;
      input: Record<string, unknown>;
    };

    return app.clinicService.createWorkflowRun(actorFromRequest(request), body);
  });

  app.post("/workflow-runs/:workflowRunId/transitions", async (request) => {
    const params = request.params as { workflowRunId: string };
    return app.clinicService.transitionWorkflowRun(
      actorFromRequest(request),
      params.workflowRunId,
      request.body
    );
  });
}
