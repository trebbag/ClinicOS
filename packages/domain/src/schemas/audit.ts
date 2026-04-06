import { z } from "zod";
import { roles, type Role } from "../enums";
import { randomId } from "../common";

export const auditEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  actorId: z.string(),
  actorRole: z.enum(roles),
  actorName: z.string().nullable().default(null),
  payload: z.record(z.unknown()),
  createdAt: z.string()
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export function createAuditEvent(input: {
  eventType: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: Role;
  actorName?: string | null;
  payload?: Record<string, unknown>;
}): AuditEvent {
  return auditEventSchema.parse({
    id: randomId("audit"),
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    actorName: input.actorName ?? null,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString()
  });
}
