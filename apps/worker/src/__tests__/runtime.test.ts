import { describe, expect, it, vi } from "vitest";
import { MemoryClinicRepository } from "../../../api/src/lib/repositories";
import { createWorkerRuntimeRecorder } from "../runtime";

describe("createWorkerRuntimeRecorder", () => {
  it("records worker runtime events without blocking normal progress", async () => {
    const repository = new MemoryClinicRepository();
    const recorder = createWorkerRuntimeRecorder({
      repository,
      source: "worker",
      pollIntervalMs: 5000,
      heartbeatIntervalMs: 300000,
      batchSize: 10,
      integrationMode: "stub"
    });

    await recorder.recordStarted();
    await recorder.recordBatchCompleted(
      { processed: 1, succeeded: 1, failed: 0 },
      "2026-04-09T16:30:00.000Z",
      "2026-04-09T16:29:59.000Z"
    );

    expect(repository.auditEvents.some((event) => event.eventType === "worker.started")).toBe(true);
    expect(repository.auditEvents.some((event) => event.eventType === "worker.batch.completed")).toBe(true);
  });

  it("times out runtime audit writes instead of stalling the loop", async () => {
    const repository = new MemoryClinicRepository();
    const warning = vi.fn();
    repository.createAuditEvent = () => new Promise(() => {});

    const recorder = createWorkerRuntimeRecorder({
      repository,
      source: "api_assist",
      pollIntervalMs: 5000,
      heartbeatIntervalMs: 300000,
      batchSize: 10,
      integrationMode: "stub",
      eventTimeoutMs: 10,
      log: warning
    });

    await recorder.recordStarted();

    expect(warning).toHaveBeenCalled();
    expect(warning.mock.calls[0]?.[0]?.event).toBe("worker.runtime_audit_failed");
  });
});
