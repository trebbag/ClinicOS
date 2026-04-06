import { z } from "zod";

export const capaSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceType: z.enum(["incident", "audit", "committee_review", "leadership_request"]),
  ownerRole: z.string(),
  dueDate: z.string(),
  status: z.enum(["open", "in_progress", "overdue", "closed"]),
  correctiveAction: z.string(),
  preventiveAction: z.string()
});

export type CAPA = z.infer<typeof capaSchema>;
