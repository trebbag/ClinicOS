import { z } from "zod";

export const committeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  cadence: z.enum(["weekly", "monthly", "quarterly"]),
  chairRole: z.string(),
  recorderRole: z.string(),
  scope: z.string()
});

export const actionItemSchema = z.object({
  id: z.string(),
  committeeId: z.string().nullable(),
  title: z.string(),
  ownerRole: z.string(),
  dueDate: z.string(),
  status: z.enum(["open", "in_progress", "closed", "deferred"])
});

export type Committee = z.infer<typeof committeeSchema>;
export type ActionItem = z.infer<typeof actionItemSchema>;
