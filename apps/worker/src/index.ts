import { type ActorContext, createAuditEvent, workerRuntimeEntityId } from "@clinic-os/domain";
import { PrismaClinicRepository, prisma } from "@clinic-os/db";
import { buildMicrosoftPilotOps } from "@clinic-os/msgraph";
import { assertWorkerConfig, workerConfig } from "./config";
import { WorkerJobRunner } from "./jobs";

const workerRuntimeActor: ActorContext = {
  actorId: "clinic-os-worker",
  role: "office_manager",
  name: "Clinic OS Worker"
};

async function recordWorkerRuntimeEvent(
  repository: PrismaClinicRepository,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await repository.createAuditEvent(createAuditEvent({
    eventType,
    entityType: "worker_runtime",
    entityId: workerRuntimeEntityId,
    actorId: workerRuntimeActor.actorId,
    actorRole: workerRuntimeActor.role,
    actorName: workerRuntimeActor.name,
    payload
  }));
}

export async function runOnce(runner?: WorkerJobRunner): Promise<void> {
  const repository = new PrismaClinicRepository(prisma);
  const activeRunner = runner ?? new WorkerJobRunner(
    repository,
    buildMicrosoftPilotOps({
      mode: workerConfig.microsoft.integrationMode,
      ...workerConfig.microsoft
    })
  );

  const summary = await activeRunner.runOnce({
    limit: workerConfig.batchSize
  });

  console.log(JSON.stringify({
    level: "info",
    service: "clinic-os-worker",
    event: "worker.batch.complete",
    summary,
    checkedAt: new Date().toISOString()
  }));
}

async function main() {
  assertWorkerConfig();
  const repository = new PrismaClinicRepository(prisma);
  const runner = new WorkerJobRunner(
    repository,
    buildMicrosoftPilotOps({
      mode: workerConfig.microsoft.integrationMode,
      ...workerConfig.microsoft
    })
  );
  let lastHeartbeatAt = 0;

  console.log(JSON.stringify({
    level: "info",
    service: "clinic-os-worker",
    event: "worker.started",
    pollIntervalMs: workerConfig.pollIntervalMs,
    heartbeatIntervalMs: workerConfig.heartbeatIntervalMs,
    batchSize: workerConfig.batchSize,
    integrationMode: workerConfig.microsoft.integrationMode,
    checkedAt: new Date().toISOString()
  }));
  await recordWorkerRuntimeEvent(repository, "worker.started", {
    pollIntervalMs: workerConfig.pollIntervalMs,
    heartbeatIntervalMs: workerConfig.heartbeatIntervalMs,
    batchSize: workerConfig.batchSize,
    integrationMode: workerConfig.microsoft.integrationMode
  });
  for (;;) {
    const batchStartedAt = new Date().toISOString();
    try {
      const summary = await runner.runOnce({
        limit: workerConfig.batchSize
      });
      const checkedAt = new Date().toISOString();
      console.log(JSON.stringify({
        level: "info",
        service: "clinic-os-worker",
        event: "worker.batch.complete",
        summary,
        checkedAt
      }));

      const shouldRecordHeartbeat =
        summary.processed > 0
        || summary.failed > 0
        || Date.now() - lastHeartbeatAt >= workerConfig.heartbeatIntervalMs;
      if (shouldRecordHeartbeat) {
        if (summary.processed > 0 || summary.failed > 0) {
          await recordWorkerRuntimeEvent(repository, "worker.batch.completed", {
            batchStartedAt,
            pollAttemptedAt: checkedAt,
            pollIntervalMs: workerConfig.pollIntervalMs,
            heartbeatIntervalMs: workerConfig.heartbeatIntervalMs,
            batchSize: workerConfig.batchSize,
            integrationMode: workerConfig.microsoft.integrationMode,
            summary
          });
        } else {
          await recordWorkerRuntimeEvent(repository, "worker.heartbeat", {
            batchStartedAt,
            pollAttemptedAt: checkedAt,
            pollIntervalMs: workerConfig.pollIntervalMs,
            heartbeatIntervalMs: workerConfig.heartbeatIntervalMs,
            batchSize: workerConfig.batchSize,
            integrationMode: workerConfig.microsoft.integrationMode,
            summary
          });
        }
        lastHeartbeatAt = Date.now();
      }
    } catch (error) {
      const checkedAt = new Date().toISOString();
      console.error(JSON.stringify({
        level: "error",
        service: "clinic-os-worker",
        event: "worker.batch.failed",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        checkedAt
      }));
      await recordWorkerRuntimeEvent(repository, "worker.batch.failed", {
        batchStartedAt,
        pollAttemptedAt: checkedAt,
        pollIntervalMs: workerConfig.pollIntervalMs,
        heartbeatIntervalMs: workerConfig.heartbeatIntervalMs,
        batchSize: workerConfig.batchSize,
        integrationMode: workerConfig.microsoft.integrationMode,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      lastHeartbeatAt = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, workerConfig.pollIntervalMs));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    level: "error",
    service: "clinic-os-worker",
    event: "worker.crashed",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    checkedAt: new Date().toISOString()
  }));
  process.exit(1);
});
