You are a senior infrastructure engineer working inside this codebase.
Your goal is to add deterministic, inspectable tracing and replay for agent runs with minimal surface area and zero behavior change by default.

Context

This project executes LLM-driven agents that invoke tools and mutate internal state across steps. Today, failures are difficult to debug because agent runs are not reproducible once LLM calls and tool side effects occur.

We want a lightweight tracing layer that records what happened and a replay mode that can deterministically re-execute the run without calling the LLM or tools again.

This is a debugging and testability feature, not a UI or product feature.

Requirements

1. Trace Model

Introduce a structured trace format (JSON or SQLite-backed) that records, per step:

step index

model name + config

full prompt/messages sent to the LLM

tool name + serialized arguments (if any)

tool output (raw)

token usage (if available)

timestamp

a stable hash of the agent’s internal state after the step

The trace must be append-only and safe to write during execution.

2. Trace Writer

Add an optional trace writer that can be enabled via:

CLI flag or config (trace=true, tracePath=...)

When disabled, the system must behave exactly as it does today (no perf regression, no branching complexity leaking into agent logic).

3. Replay Executor

Implement a replay mode that:

Loads a recorded trace

Replays steps sequentially

Does not call the LLM

Does not call real tools

Returns recorded tool outputs instead

Verifies that the computed state hash at each step matches the trace

Hard-fails with a useful diff if divergence occurs

This should reuse as much of the existing execution pipeline as possible (don’t fork logic).

4. CLI Support

Add minimal CLI commands:

agent run --trace <path>

agent replay <trace-path>

agent trace inspect <trace-path>

inspect should print a readable step-by-step summary (no UI, no TUI).

Design Constraints

No UI work

No network calls in replay mode

No global mutable state

No breaking changes

Prefer composition over inheritance

Prefer explicit data structures over magic hooks

Code should be readable by contributors unfamiliar with the tracing system

Implementation Guidance

Identify the single place where:

LLM calls are made

tools are dispatched

Insert tracing hooks there, not scattered across the codebase

Keep trace schema versioned

Treat this like infra code: boring, deterministic, testable

Tests

Add focused tests that:

Run a short agent task with tracing enabled

Replay the trace

Assert identical outputs

Assert divergence is detected if state is mutated

Output Expectations

Produce:

New trace module

Minimal CLI wiring

Tests

Clear inline comments explaining why decisions were made

Avoid overengineering. This should feel like a feature maintainers would actually merge.
