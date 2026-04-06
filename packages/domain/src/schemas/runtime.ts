import { z } from "zod";
import { authModeSchema } from "./auth";
import { microsoftIntegrationStatusSchema, publicationModeSchema } from "./integration";
import { workerJobSummarySchema } from "./worker";

export const basicHealthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  checkedAt: z.string()
});

export const apiRuntimeConfigStatusSchema = z.object({
  service: z.literal("clinic-os-api"),
  nodeEnv: z.string(),
  checkedAt: z.string(),
  authMode: authModeSchema,
  publicAppOrigin: z.string().nullable().default(null),
  integrationMode: z.enum(["stub", "live"]),
  publicationMode: publicationModeSchema,
  databaseReady: z.boolean(),
  worker: workerJobSummarySchema,
  microsoft: microsoftIntegrationStatusSchema,
  pilotUsable: z.boolean(),
  startupReady: z.boolean(),
  blockingIssues: z.array(z.string()).default([])
});

export type BasicHealth = z.infer<typeof basicHealthSchema>;
export type ApiRuntimeConfigStatus = z.infer<typeof apiRuntimeConfigStatusSchema>;
