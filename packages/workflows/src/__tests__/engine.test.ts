import { describe, expect, it } from "vitest";
import { createWorkflowRun } from "@clinic-os/domain";
import { canTransition, transitionWorkflow } from "../engine";
import { policyLifecycleDefinition } from "../definitions/policy-lifecycle";

describe("workflow engine", () => {
  it("allows valid transitions", () => {
    expect(canTransition(policyLifecycleDefinition, "new", "scoped")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    const run = createWorkflowRun("policy_lifecycle", "medical_director", "medical_director", {
      title: "Policy"
    });

    expect(() => transitionWorkflow(policyLifecycleDefinition, run, "published")).toThrow();
  });
});
