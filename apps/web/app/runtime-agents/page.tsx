"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import { useAppAuth } from "../../components/auth-provider";

type RuntimeAgentSpec = {
  id: string;
  name: string;
  purpose: string;
  model: "gpt-5.4" | "gpt-5.4-mini";
  reasoning: "low" | "medium" | "high";
  allowedTools: string[];
  promptKey: string;
  reviewerRoles: string[];
  requiresApproval: boolean;
  forbiddenActions: string[];
  outputShape: string;
};

type RuntimeAgentStatus = {
  enabled: boolean;
  reason: string | null;
  agents: RuntimeAgentSpec[];
};

type RuntimeAgentToolCall = {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "completed" | "failed";
  output: unknown;
  error: string | null;
};

type RuntimeAgentRunResult = {
  agent: RuntimeAgentSpec;
  requestId: string;
  workflowId: string;
  responseId: string;
  startedAt: string;
  completedAt: string;
  finalText: string;
  toolCalls: RuntimeAgentToolCall[];
  requiresApproval: boolean;
  reviewerRoles: string[];
};

export default function RuntimeAgentsPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [status, setStatus] = useState<RuntimeAgentStatus | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [workflowId, setWorkflowId] = useState("");
  const [payloadText, setPayloadText] = useState("{\n  \"objective\": \"Draft a governance-ready packet summary.\",\n  \"context\": []\n}");
  const [result, setResult] = useState<RuntimeAgentRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    if (!actor) {
      return;
    }
    setLoading(true);
    try {
      const nextStatus = await apiRequest<RuntimeAgentStatus>("/runtime-agents", actor);
      setStatus(nextStatus);
      setSelectedAgentId((current) => current || nextStatus.agents[0]?.id || "");
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load runtime agents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [actor?.actorId, actor?.role]);

  const selectedAgent = useMemo(
    () => status?.agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [selectedAgentId, status]
  );

  async function handleRun(): Promise<void> {
    if (!actor || !selectedAgent) {
      return;
    }

    setRunning(true);
    try {
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      const nextResult = await apiRequest<RuntimeAgentRunResult>("/runtime-agents/run", actor, {
        method: "POST",
        body: JSON.stringify({
          agentId: selectedAgent.id,
          workflowId: workflowId.trim() || undefined,
          payload
        })
      });
      setResult(nextResult);
      setError(null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run runtime agent.");
    } finally {
      setRunning(false);
    }
  }

  if (!hasCapability("runtime_agents.view")) {
    return (
      <main className="stack">
        <h1>Runtime Agents</h1>
        <p className="muted">Your active role cannot view runtime-agent execution.</p>
      </main>
    );
  }

  return (
    <main className="stack">
      <header className="stack">
        <h1>Runtime Agents</h1>
        <p className="muted">
          Run bounded Clinic OS agents through the approved internal tool layer.
        </p>
      </header>

      {loading ? <p className="muted">Loading runtime agents...</p> : null}
      {error ? <p className="panel danger">{error}</p> : null}

      {status ? (
        <section className="panel stack">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{status.enabled ? "Runtime agents enabled" : "Runtime agents disabled"}</strong>
              <p className="muted" style={{ marginTop: 6 }}>
                {status.enabled ? "OPENAI-backed execution is available for approved roles." : status.reason ?? "Runtime agents are unavailable."}
              </p>
            </div>
            <span className={`status-chip ${status.enabled ? "approved" : "warning"}`}>
              {status.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </section>
      ) : null}

      <section className="grid two-column" style={{ gap: 24 }}>
        <div className="panel stack">
          <label className="stack">
            <span>Agent</span>
            <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
              {status?.agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          <label className="stack">
            <span>Workflow ID override</span>
            <input
              value={workflowId}
              onChange={(event) => setWorkflowId(event.target.value)}
              placeholder="Optional workflow ID"
            />
          </label>

          <label className="stack">
            <span>Payload JSON</span>
            <textarea
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              rows={14}
              spellCheck={false}
            />
          </label>

          <button
            className="button"
            disabled={!status?.enabled || !selectedAgent || !hasCapability("runtime_agents.run") || running}
            onClick={() => {
              void handleRun();
            }}
          >
            {running ? "Running..." : "Run runtime agent"}
          </button>

          {!hasCapability("runtime_agents.run") ? (
            <p className="muted">Your active role can view runtime agents but cannot run them.</p>
          ) : null}
        </div>

        <div className="stack">
          {selectedAgent ? (
            <section className="panel stack">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{selectedAgent.name}</strong>
                <span className="status-chip pending">{selectedAgent.model} / {selectedAgent.reasoning}</span>
              </div>
              <p>{selectedAgent.purpose}</p>
              <p className="muted"><strong>Output shape:</strong> {selectedAgent.outputShape}</p>
              <p className="muted"><strong>Allowed tools:</strong> {selectedAgent.allowedTools.join(", ") || "None"}</p>
              <p className="muted"><strong>Reviewer roles:</strong> {selectedAgent.reviewerRoles.join(", ") || "None"}</p>
              <p className="muted"><strong>Forbidden actions:</strong> {selectedAgent.forbiddenActions.join(", ")}</p>
            </section>
          ) : null}

          {result ? (
            <section className="panel stack">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>Latest run</strong>
                <span className="status-chip approved">{result.responseId}</span>
              </div>
              <p className="muted">
                Workflow: {result.workflowId} · Request: {result.requestId}
              </p>
              <div className="stack">
                <strong>Final summary</strong>
                <pre>{result.finalText || "No final text returned."}</pre>
              </div>
              <div className="stack">
                <strong>Tool calls</strong>
                {result.toolCalls.length === 0 ? (
                  <p className="muted">No tool calls were required.</p>
                ) : result.toolCalls.map((call) => (
                  <article key={call.callId} className="panel stack" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong>{call.name}</strong>
                      <span className={`status-chip ${call.status === "completed" ? "approved" : "warning"}`}>
                        {call.status}
                      </span>
                    </div>
                    <pre>{JSON.stringify(call.arguments, null, 2)}</pre>
                    <pre>{JSON.stringify(call.output, null, 2)}</pre>
                    {call.error ? <p className="muted">Error: {call.error}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
