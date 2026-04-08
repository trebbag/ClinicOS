import { z } from "zod";
import type { ActorContext, RuntimeAgentToolCall } from "@clinic-os/domain";
import {
  businessTools,
  createActionItem,
  publishApprovedDocument,
  saveDraftDocument,
  sendTeamsNotification,
  submitDocumentForReview
} from "@clinic-os/tools";

type RuntimeAgentToolService = {
  createDocument(actor: ActorContext, input: unknown): Promise<unknown>;
  submitDocument(actor: ActorContext, documentId: string): Promise<unknown>;
  publishDocument(actor: ActorContext, documentId: string): Promise<unknown>;
  createActionItem(actor: ActorContext, input: unknown): Promise<unknown>;
  sendTeamsNotification(actor: ActorContext, input: {
    channel: string;
    message: string;
  }): Promise<unknown>;
};

export type RuntimeAgentToolContext = {
  service?: RuntimeAgentToolService;
  actor?: ActorContext;
};

export type RuntimeFunctionCallItem = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

const saveDraftDocumentSchema = z.object({
  title: z.string().min(1),
  ownerRole: z.string().min(1),
  body: z.string().min(1)
});

const submitDocumentForReviewSchema = z.object({
  documentId: z.string().min(1),
  approvalClass: z.string().min(1)
});

const publishApprovedDocumentSchema = z.object({
  documentId: z.string().min(1),
  approvalEvidenceId: z.string().min(1)
});

const createActionItemSchema = z.object({
  title: z.string().min(1),
  ownerRole: z.string().min(1),
  dueDate: z.string().min(1)
});

const sendTeamsNotificationSchema = z.object({
  channel: z.string().min(1),
  message: z.string().min(1)
});

const toolParsers = {
  save_draft_document: saveDraftDocumentSchema,
  submit_document_for_review: submitDocumentForReviewSchema,
  publish_approved_document: publishApprovedDocumentSchema,
  create_action_item: createActionItemSchema,
  send_teams_notification: sendTeamsNotificationSchema
} as const;

const toolHandlers = {
  save_draft_document: saveDraftDocument,
  submit_document_for_review: submitDocumentForReview,
  publish_approved_document: publishApprovedDocument,
  create_action_item: createActionItem,
  send_teams_notification: sendTeamsNotification
} as const;

export function listAllowedToolDefinitions(allowedTools: ReadonlyArray<string>) {
  const allowed = new Set(allowedTools);
  return businessTools
    .filter((tool) => allowed.has(tool.name))
    .map((tool) => ({
      type: "function" as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      strict: true as const
    }));
}

export function isFunctionCallItem(item: unknown): item is RuntimeFunctionCallItem {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Record<string, unknown>;
  return candidate.type === "function_call"
    && typeof candidate.call_id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.arguments === "string";
}

export async function executeRuntimeFunctionCall(
  item: RuntimeFunctionCallItem,
  allowedTools: ReadonlySet<string>,
  context?: RuntimeAgentToolContext
): Promise<{
  toolCall: RuntimeAgentToolCall;
  outputItem: {
    type: "function_call_output";
    call_id: string;
    output: string;
  };
}> {
  if (!allowedTools.has(item.name)) {
    throw new Error(`Agent attempted to call disallowed tool: ${item.name}`);
  }

  if (!(item.name in toolParsers) || !(item.name in toolHandlers)) {
    throw new Error(`Agent attempted to call an unknown tool: ${item.name}`);
  }

  let parsedArguments: Record<string, unknown>;
  try {
    parsedArguments = JSON.parse(item.arguments) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse tool arguments.";
    return {
      toolCall: {
        callId: item.call_id,
        name: item.name,
        arguments: {},
        status: "failed",
        output: null,
        error: `Invalid tool arguments: ${message}`
      },
      outputItem: {
        type: "function_call_output",
        call_id: item.call_id,
        output: JSON.stringify({ error: `Invalid tool arguments: ${message}` })
      }
    };
  }

  try {
    const parser = toolParsers[item.name as keyof typeof toolParsers];
    const handler = toolHandlers[item.name as keyof typeof toolHandlers];
    const validated = parser.parse(parsedArguments);
    const output = await handler(validated as never, context as never);
    return {
      toolCall: {
        callId: item.call_id,
        name: item.name,
        arguments: validated as Record<string, unknown>,
        status: "completed",
        output,
        error: null
      },
      outputItem: {
        type: "function_call_output",
        call_id: item.call_id,
        output: JSON.stringify(output ?? null)
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed.";
    return {
      toolCall: {
        callId: item.call_id,
        name: item.name,
        arguments: parsedArguments,
        status: "failed",
        output: null,
        error: message
      },
      outputItem: {
        type: "function_call_output",
        call_id: item.call_id,
        output: JSON.stringify({ error: message })
      }
    };
  }
}

export function extractResponseText(response: {
  output_text?: string | null;
  output?: Array<Record<string, unknown>>;
}): string {
  if (typeof response.output_text === "string" && response.output_text.length > 0) {
    return response.output_text;
  }

  const messageTexts = (response.output ?? [])
    .filter((item) => item.type === "message" && Array.isArray(item.content))
    .flatMap((item) => item.content as Array<Record<string, unknown>>)
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text as string);

  return messageTexts.join("\n\n").trim();
}
