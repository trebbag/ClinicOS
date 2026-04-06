import type { FastifyInstance } from "fastify";
import { actorFromRequest } from "../lib/auth";

export async function registerScorecardReviewRoutes(app: FastifyInstance): Promise<void> {
  app.get("/scorecard-reviews", async (request) => {
    const query = request.query as { status?: string; periodStart?: string; periodEnd?: string };
    return app.clinicService.listScorecardReviews(query);
  });

  app.post("/scorecard-reviews/:id/decision", async (request) => {
    const params = request.params as { id: string };
    return app.clinicService.decideScorecardReview(actorFromRequest(request), params.id, request.body);
  });
}
