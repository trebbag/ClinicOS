import { z } from "zod";
import { serviceLines } from "../enums";

export const serviceLineRecordSchema = z.object({
  id: z.enum(serviceLines),
  ownerRole: z.string().nullable(),
  hasCharter: z.boolean(),
  hasCompetencyMatrix: z.boolean(),
  hasAuditTool: z.boolean(),
  hasClaimsInventory: z.boolean(),
  reviewCadenceDays: z.number()
});

export type ServiceLineRecord = z.infer<typeof serviceLineRecordSchema>;
