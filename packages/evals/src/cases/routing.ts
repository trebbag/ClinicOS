export const routingCases = [
  {
    name: "policy requests route to policy drafter",
    workflowId: "policy_lifecycle",
    expectedAgentId: "policy_drafter"
  },
  {
    name: "office manager workflows route to office manager copilot",
    workflowId: "office_manager_daily",
    expectedAgentId: "office_manager_copilot"
  }
];
