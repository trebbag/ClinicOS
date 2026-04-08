import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerRevenueRoutes(app: FastifyInstance): Promise<void> {
  app.get("/revenue/summary", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.view");
    const query = request.query as {
      serviceLineId?: string;
    };
    return app.clinicService.getRevenueDashboardSummary(query);
  });

  app.get("/payer-issues", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.view");
    const query = request.query as {
      status?: string;
      ownerRole?: string;
      serviceLineId?: string;
      issueType?: string;
      payerName?: string;
    };
    return app.clinicService.listPayerIssues(query);
  });

  app.post("/payer-issues", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.manage");
    return app.clinicService.createPayerIssue(actor, request.body);
  });

  app.patch("/payer-issues/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.manage");
    const params = request.params as { id: string };
    return app.clinicService.updatePayerIssue(actor, params.id, request.body);
  });

  app.get("/pricing-governance", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.view");
    const query = request.query as {
      status?: string;
      ownerRole?: string;
      serviceLineId?: string;
    };
    return app.clinicService.listPricingGovernance(query);
  });

  app.post("/pricing-governance", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.manage");
    return app.clinicService.createPricingGovernance(actor, request.body);
  });

  app.patch("/pricing-governance/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.manage");
    const params = request.params as { id: string };
    return app.clinicService.updatePricingGovernance(actor, params.id, request.body);
  });

  app.post("/pricing-governance/:id/submit", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.manage");
    const params = request.params as { id: string };
    return app.clinicService.submitPricingGovernance(actor, params.id);
  });

  app.post("/pricing-governance/:id/publish", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.manage");
    const params = request.params as { id: string };
    return app.clinicService.publishPricingGovernance(actor, params.id);
  });

  app.get("/revenue-reviews", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.view");
    const query = request.query as {
      status?: string;
      ownerRole?: string;
      serviceLineId?: string;
      linkedCommitteeId?: string;
    };
    return app.clinicService.listRevenueReviews(query);
  });

  app.post("/revenue-reviews", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.manage");
    return app.clinicService.createRevenueReview(actor, request.body);
  });

  app.patch("/revenue-reviews/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "revenue.manage");
    const params = request.params as { id: string };
    return app.clinicService.updateRevenueReview(actor, params.id, request.body);
  });
}
