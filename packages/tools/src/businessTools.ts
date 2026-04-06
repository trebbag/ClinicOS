import type { ToolDescriptor } from "./types";

export const businessTools: ToolDescriptor[] = [
  {
    name: "save_draft_document",
    description: "Save a draft document and metadata record.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        ownerRole: { type: "string" },
        body: { type: "string" }
      },
      required: ["title", "ownerRole", "body"]
    }
  },
  {
    name: "submit_document_for_review",
    description: "Submit a document into the human approval workflow.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string" },
        approvalClass: { type: "string" }
      },
      required: ["documentId", "approvalClass"]
    }
  },
  {
    name: "publish_approved_document",
    description: "Publish an already approved document through the controlled publication path.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string" },
        approvalEvidenceId: { type: "string" }
      },
      required: ["documentId", "approvalEvidenceId"]
    }
  },
  {
    name: "create_action_item",
    description: "Create an internal action item.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        ownerRole: { type: "string" },
        dueDate: { type: "string" }
      },
      required: ["title", "ownerRole", "dueDate"]
    }
  },
  {
    name: "send_teams_notification",
    description: "Queue a Teams notification to an approved channel.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        message: { type: "string" }
      },
      required: ["channel", "message"]
    }
  }
];
