import { PrismaClinicRepository, prisma } from "@clinic-os/db";
import { buildMicrosoftPilotOps } from "@clinic-os/msgraph";
import { assertWorkerConfig, workerConfig } from "./config";
import { WorkerJobRunner } from "./jobs";

export async function runOnce(): Promise<void> {
  const runner = new WorkerJobRunner(
    new PrismaClinicRepository(prisma),
    buildMicrosoftPilotOps({
      mode: workerConfig.microsoft.integrationMode,
      ...workerConfig.microsoft
    })
  );

  const summary = await runner.runOnce({
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
  console.log(JSON.stringify({
    level: "info",
    service: "clinic-os-worker",
    event: "worker.started",
    pollIntervalMs: workerConfig.pollIntervalMs,
    batchSize: workerConfig.batchSize,
    integrationMode: workerConfig.microsoft.integrationMode,
    checkedAt: new Date().toISOString()
  }));
  for (;;) {
    await runOnce();
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
