import { z } from "zod";
import { roles } from "../enums";

export const actorContextSchema = z.object({
  actorId: z.string().min(1),
  role: z.enum(roles),
  name: z.string().min(1).optional()
});

export type ActorContext = z.infer<typeof actorContextSchema>;
