import { z } from "zod";
import { approvalClasses } from "../enums";

export const approvalTaskSchema = z.object({
  id: z.string(),
  targetType: z.enum(["document"]),
  targetId: z.string(),
  reviewerRole: z.string(),
  approvalClass: z.enum(approvalClasses),
  requestedBy: z.string(),
  requestedAt: z.string(),
  status: z.enum(["requested", "approved", "rejected", "sent_back"]),
  decidedAt: z.string().nullable(),
  decisionNotes: z.string().nullable()
});

export type ApprovalTask = z.infer<typeof approvalTaskSchema>;
