import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerPublicAssetRoutes(app: FastifyInstance): Promise<void> {
  app.get("/public-assets", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "public_assets.view");
    const query = request.query as {
      status?: string;
      ownerRole?: string;
      assetType?: string;
      serviceLine?: string;
    };
    return app.clinicService.listPublicAssets(query);
  });

  app.post("/public-assets", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "public_assets.manage");
    return app.clinicService.createPublicAsset(actor, request.body);
  });

  app.patch("/public-assets/:id", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "public_assets.manage");
    const params = request.params as { id: string };
    return app.clinicService.updatePublicAsset(actor, params.id, request.body);
  });

  app.post("/public-assets/:id/review-claims", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "public_assets.manage");
    const params = request.params as { id: string };
    return app.clinicService.reviewPublicAssetClaims(actor, params.id, request.body);
  });

  app.post("/public-assets/:id/submit", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "public_assets.manage");
    const params = request.params as { id: string };
    return app.clinicService.submitPublicAsset(actor, params.id);
  });

  app.post("/public-assets/:id/publish", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "public_assets.manage");
    const params = request.params as { id: string };
    return app.clinicService.publishPublicAsset(actor, params.id);
  });
}
