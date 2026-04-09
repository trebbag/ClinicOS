import type { ClinicRepository } from "@clinic-os/db";
import {
  type ActorContext,
  createAuditEvent,
  workerRuntimeEntityId
} from "@clinic-os/domain";
import type { MicrosoftIntegrationMode } from "@clinic-os/msgraph";
import type { WorkerRunSummary } from "./jobs";

type WorkerRuntimeRepository = Pick<ClinicRepository, "createAuditEvent">;

type WorkerRuntimeSource = "worker" | "api_assist";

type WorkerRuntimeLogger = (entry: {
  level: "warn";
  event: string;
  message: string;
  detail?: string;
}) => void;

type WorkerRuntimeRecorderOptions = {
  repository: WorkerRuntimeRepository;
  source: WorkerRuntimeSource;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  batchSize: number;
  integrationMode: MicrosoftIntegrationMode;
  eventTimeoutMs?: number;
  log?: WorkerRuntimeLogger;
};

const workerRuntimeActors: Record<WorkerRuntimeSource, ActorContext> = {
  worker: {
    actorId: "clinic-os-worker",
    role: "office_manager",
    name: "Clinic OS Worker"
  },
  api_assist: {
    actorId: "clinic-os-api-worker-assist",
    role: "office_manager",
    name: "Clinic OS API Worker Assist"
  }
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

export function createWorkerRuntimeRecorder(options: WorkerRuntimeRecorderOptions) {
  let lastHeartbeatAt = 0;
  const actor = workerRuntimeActors[options.source];
  const eventTimeoutMs = options.eventTimeoutMs ?? 5_000;

  async function safeRecord(eventType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await withTimeout(
        options.repository.createAuditEvent(createAuditEvent({
          eventType,
          entityType: "worker_runtime",
          entityId: workerRuntimeEntityId,
          actorId: actor.actorId,
          actorRole: actor.role,
          actorName: actor.name,
          payload: {
            runtimeSource: options.source,
            ...payload
          }
        })),
        eventTimeoutMs,
        `${eventType} audit write`
      );
    } catch (error) {
      options.log?.({
        level: "warn",
        event: "worker.runtime_audit_failed",
        message: error instanceof Error ? error.message : String(error),
        detail: eventType
      });
    }
  }

  return {
    async recordStarted(): Promise<void> {
      await safeRecord("worker.started", {
        pollIntervalMs: options.pollIntervalMs,
        heartbeatIntervalMs: options.heartbeatIntervalMs,
        batchSize: options.batchSize,
        integrationMode: options.integrationMode
      });
      lastHeartbeatAt = Date.now();
    },

    async recordBatchCompleted(summary: WorkerRunSummary, checkedAt: string, batchStartedAt: string): Promise<void> {
      const shouldRecordHeartbeat =
        summary.processed > 0
        || summary.failed > 0
        || Date.now() - lastHeartbeatAt >= options.heartbeatIntervalMs;

      if (!shouldRecordHeartbeat) {
        return;
      }

      if (summary.processed > 0 || summary.failed > 0) {
        await safeRecord("worker.batch.completed", {
          batchStartedAt,
          pollAttemptedAt: checkedAt,
          pollIntervalMs: options.pollIntervalMs,
          heartbeatIntervalMs: options.heartbeatIntervalMs,
          batchSize: options.batchSize,
          integrationMode: options.integrationMode,
          summary
        });
      } else {
        await safeRecord("worker.heartbeat", {
          batchStartedAt,
          pollAttemptedAt: checkedAt,
          pollIntervalMs: options.pollIntervalMs,
          heartbeatIntervalMs: options.heartbeatIntervalMs,
          batchSize: options.batchSize,
          integrationMode: options.integrationMode,
          summary
        });
      }

      lastHeartbeatAt = Date.now();
    },

    async recordBatchFailed(error: unknown, checkedAt: string, batchStartedAt: string): Promise<void> {
      await safeRecord("worker.batch.failed", {
        batchStartedAt,
        pollAttemptedAt: checkedAt,
        pollIntervalMs: options.pollIntervalMs,
        heartbeatIntervalMs: options.heartbeatIntervalMs,
        batchSize: options.batchSize,
        integrationMode: options.integrationMode,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      lastHeartbeatAt = Date.now();
    }
  };
}
