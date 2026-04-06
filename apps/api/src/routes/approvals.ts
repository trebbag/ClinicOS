import type { FastifyInstance } from "fastify";
import { approvalMatrix } from "@clinic-os/approvals";
import { actorFromRequest } from "../lib/auth";

export async function registerApprovalRoutes(app: FastifyInstance): Promise<void> {
  app.get("/approvals/matrix", async () => approvalMatrix);

  app.get("/approvals", async (request) => {
    const query = request.query as { reviewerRole?: string; status?: string; targetId?: string };
    return app.clinicService.listApprovals(query);
  });

  app.post("/approvals/:approvalTaskId/decide", async (request) => {
    const params = request.params as { approvalTaskId: string };
    return app.clinicService.decideApproval(
      actorFromRequest(request),
      params.approvalTaskId,
      request.body
    );
  });
}
