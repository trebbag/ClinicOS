import { describe, expect, it } from "vitest";
import { reviewersForApprovalClass } from "../guards";

describe("approval matrix", () => {
  it("returns reviewers for policy-effective artifacts", () => {
    expect(reviewersForApprovalClass("policy_effective")).toContain("medical_director");
  });
});
