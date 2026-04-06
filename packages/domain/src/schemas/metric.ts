import { z } from "zod";

export const deidentifiedOperationalRowSchema = z.object({
  employee_id: z.string(),
  employee_role: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  task_completion_rate: z.coerce.number(),
  training_completion_rate: z.coerce.number(),
  audit_pass_rate: z.coerce.number(),
  issue_close_rate: z.coerce.number(),
  complaint_count: z.coerce.number(),
  note_lag_days: z.coerce.number(),
  refill_turnaround_hours: z.coerce.number(),
  schedule_fill_rate: z.coerce.number()
});

export type DeidentifiedOperationalRow = z.infer<typeof deidentifiedOperationalRowSchema>;

export const metricRunSchema = z.object({
  id: z.string(),
  metricKey: z.string(),
  entityId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  value: z.number(),
  createdAt: z.string()
});

export type MetricRun = z.infer<typeof metricRunSchema>;
