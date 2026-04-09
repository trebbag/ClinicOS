import type { ActorContext } from "@clinic-os/domain";
import { PrismaClinicRepository, prisma } from "@clinic-os/db";
import { buildMicrosoftPilotOps } from "@clinic-os/msgraph";
import { assertWorkerConfig, workerConfig } from "./config";
import { WorkerJobRunner } from "./jobs";
import { createWorkerRuntimeRecorder } from "./runtime";

const workerRuntimeActor: ActorContext = {
  actorId: "clinic-os-worker",
  role: "office_manager",
  name: "Clinic OS Worker"
};

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
  const runtimeRecorder = createWorkerRuntimeRecorder({
    repository,
    source: "worker",
    pollIntervalMs: workerConfig.pollIntervalMs,
    heartbeatIntervalMs: workerConfig.heartbeatIntervalMs,
    batchSize: workerConfig.batchSize,
    integrationMode: workerConfig.microsoft.integrationMode,
    log: (entry) => {
      console.warn(JSON.stringify({
        level: entry.level,
        service: "clinic-os-worker",
        event: entry.event,
        message: entry.message,
        detail: entry.detail,
        checkedAt: new Date().toISOString()
      }));
    }
  });

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
  await runtimeRecorder.recordStarted();
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
      await runtimeRecorder.recordBatchCompleted(summary, checkedAt, batchStartedAt);
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
      await runtimeRecorder.recordBatchFailed(error, checkedAt, batchStartedAt);
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
