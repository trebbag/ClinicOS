import { z } from "zod";

export const scorecardBucketSchema = z.object({
  name: z.enum(["reliability", "throughput", "safety_compliance", "team_behavior"]),
  score: z.number(),
  notes: z.array(z.string())
});

export const roleScorecardSchema = z.object({
  employeeId: z.string(),
  employeeRole: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  overallScore: z.number(),
  buckets: z.array(scorecardBucketSchema),
  recommendations: z.array(z.string())
});

export type RoleScorecard = z.infer<typeof roleScorecardSchema>;
