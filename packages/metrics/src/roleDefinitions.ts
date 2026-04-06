import type { ScorecardFormula } from "./types";

export const scorecardFormulasByRole: Record<string, ScorecardFormula[]> = {
  front_desk: [
    { bucket: "reliability", key: "task_completion_rate", description: "Task follow-through" },
    { bucket: "throughput", key: "schedule_fill_rate", description: "Schedule fill support" },
    { bucket: "safety_compliance", key: "audit_pass_rate", description: "Registration / workflow accuracy" },
    { bucket: "team_behavior", key: "complaint_count", description: "Patient-facing friction" }
  ],
  medical_assistant: [
    { bucket: "reliability", key: "task_completion_rate", description: "Checklist completion" },
    { bucket: "throughput", key: "issue_close_rate", description: "Issue closure" },
    { bucket: "safety_compliance", key: "audit_pass_rate", description: "Protocol adherence" },
    { bucket: "team_behavior", key: "complaint_count", description: "Escalation quality" }
  ],
  nurse_practitioner: [
    { bucket: "reliability", key: "task_completion_rate", description: "Follow-through" },
    { bucket: "throughput", key: "schedule_fill_rate", description: "Utilization" },
    { bucket: "safety_compliance", key: "audit_pass_rate", description: "Governance adherence" },
    { bucket: "team_behavior", key: "complaint_count", description: "Patient experience" }
  ],
  office_manager: [
    { bucket: "reliability", key: "task_completion_rate", description: "Task closure" },
    { bucket: "throughput", key: "issue_close_rate", description: "Operational follow-through" },
    { bucket: "safety_compliance", key: "audit_pass_rate", description: "Audit completion" },
    { bucket: "team_behavior", key: "complaint_count", description: "Team friction" }
  ]
};
