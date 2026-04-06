import type { DeidentifiedOperationalRow, RoleScorecard } from "@clinic-os/domain";
import { roleScorecardSchema } from "@clinic-os/domain";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function calculateRoleScorecard(row: DeidentifiedOperationalRow): RoleScorecard {
  const reliability = clampScore((row.task_completion_rate + row.training_completion_rate) / 2);
  const throughput = clampScore(
    row.employee_role === "front_desk" || row.employee_role === "nurse_practitioner"
      ? row.schedule_fill_rate
      : row.issue_close_rate
  );
  const safetyCompliance = clampScore(row.audit_pass_rate);
  const teamBehavior = clampScore(Math.max(0, 1 - row.complaint_count * 0.2));
  const overallScore = Math.round((reliability + throughput + safetyCompliance + teamBehavior) / 4);

  const notes: string[] = [];
  if (row.note_lag_days > 3) notes.push("Documentation lag elevated");
  if (row.refill_turnaround_hours > 24) notes.push("Refill turnaround elevated");
  if (row.training_completion_rate < 1) notes.push("Training incomplete");

  return roleScorecardSchema.parse({
    employeeId: row.employee_id,
    employeeRole: row.employee_role,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    overallScore,
    buckets: [
      { name: "reliability", score: reliability, notes },
      { name: "throughput", score: throughput, notes },
      { name: "safety_compliance", score: safetyCompliance, notes },
      { name: "team_behavior", score: teamBehavior, notes }
    ],
    recommendations: overallScore >= 90
      ? ["Maintain performance", "Consider stretch responsibilities"]
      : ["Review role expectations", "Inspect process bottlenecks"]
  });
}
