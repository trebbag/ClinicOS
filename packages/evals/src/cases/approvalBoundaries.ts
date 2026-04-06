export const approvalBoundaryCases = [
  {
    name: "public-facing artifact requires human approval",
    approvalClass: "public_facing",
    shouldRequireHumanReview: true
  },
  {
    name: "policy-effective artifact requires human approval",
    approvalClass: "policy_effective",
    shouldRequireHumanReview: true
  }
];
