import { z } from "zod";
import { approvalClasses, roles, workflowStates, type Role } from "../enums";
import { randomId } from "../common";

export const workflowStateSchema = z.enum(workflowStates);
export const approvalClassSchema = z.enum(approvalClasses);

export const workflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  approvalClass: approvalClassSchema,
  inputSchemaName: z.string(),
  artifactTypes: z.array(z.string()),
  initialState: workflowStateSchema,
  allowedTransitions: z.record(z.array(workflowStateSchema)),
  ownerRoles: z.array(z.string())
});

export const workflowRunSchema = z.object({
  id: z.string(),
  workflowDefinitionId: z.string(),
  requestedBy: z.string(),
  requestedByRole: z.enum(roles),
  state: workflowStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  documentId: z.string().nullable().default(null),
  lastTransitionNote: z.string().nullable().default(null),
  input: z.record(z.unknown())
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;

export function createWorkflowRun(
  workflowDefinitionId: string,
  requestedBy: string,
  requestedByRole: Role,
  input: Record<string, unknown>
): WorkflowRun {
  const now = new Date().toISOString();
  return {
    id: randomId("workflow"),
    workflowDefinitionId,
    requestedBy,
    requestedByRole,
    state: "new",
    createdAt: now,
    updatedAt: now,
    documentId: null,
    lastTransitionNote: null,
    input
  };
}
