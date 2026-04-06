import { describe, expect, it } from "vitest";
import {
  actorContextSchema,
  createDraftDocument,
  deidentifiedOperationalRowSchema,
  workflowDefinitionSchema
} from "../index";

describe("domain schemas", () => {
  it("parses workflow definitions", () => {
    const result = workflowDefinitionSchema.parse({
      id: "policy_lifecycle",
      name: "Policy lifecycle",
      description: "Manage a policy from draft to publish",
      approvalClass: "policy_effective",
      inputSchemaName: "policyDraftInput",
      artifactTypes: ["policy", "sop_outline"],
      initialState: "new",
      allowedTransitions: {
        new: ["scoped"]
      },
      ownerRoles: ["medical_director"]
    });

    expect(result.name).toBe("Policy lifecycle");
  });

  it("parses deidentified rows", () => {
    const row = deidentifiedOperationalRowSchema.parse({
      employee_id: "EMP001",
      employee_role: "front_desk",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      task_completion_rate: "0.9",
      training_completion_rate: "1",
      audit_pass_rate: "0.95",
      issue_close_rate: "0.8",
      complaint_count: "0",
      note_lag_days: "0",
      refill_turnaround_hours: "0",
      schedule_fill_rate: "0.82"
    });

    expect(row.task_completion_rate).toBe(0.9);
  });

  it("parses actor context and document defaults", () => {
    const actor = actorContextSchema.parse({
      actorId: "quality-user",
      role: "quality_lead",
      name: "Quality Lead"
    });

    const document = createDraftDocument({
      title: "Policy draft",
      ownerRole: "quality_lead",
      approvalClass: "policy_effective",
      artifactType: "policy",
      createdBy: actor.actorId,
      body: "# Draft"
    });

    expect(document.status).toBe("draft");
    expect(document.version).toBe(1);
  });
});
