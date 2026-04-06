import { z } from "zod";

export const publicAssetSchema = z.object({
  id: z.string(),
  assetType: z.enum(["website_page", "ad_copy", "service_page", "handout", "intake_packet"]),
  title: z.string(),
  status: z.enum(["draft", "under_review", "approved", "published", "archived"]),
  ownerRole: z.string(),
  body: z.string(),
  claimsReviewed: z.boolean()
});

export type PublicAsset = z.infer<typeof publicAssetSchema>;
