import { z } from "zod";

export const incidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(["low", "moderate", "high", "critical"]),
  detectedAt: z.string(),
  detectedByRole: z.string(),
  status: z.enum(["open", "under_review", "closed"]),
  summary: z.string()
});

export type Incident = z.infer<typeof incidentSchema>;
