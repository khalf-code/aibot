# openclaw safe_call patch research

## Scope

- Repository: `/Users/programcaicai/clawd/projects/openclaw`
- Goal: locate built-in tool registration path and compare `cron`/`gateway` registration+execution pattern before adding `safe_call`.

## Built-in tool registration path

1. Tool assembly entry is `createOpenClawTools` in `src/agents/openclaw-tools.ts`.
2. Core built-ins are instantiated directly in one array (`coreTools`) via factory functions (`createCronTool`, `createGatewayTool`, etc.).
3. Plugin tools are appended via `resolvePluginTools`, with conflict prevention using `existingToolNames`.
4. `safe_call` is registered last and wraps the combined tool list (`coreTools + pluginTools`) through a resolver callback.

Key code points:

- Imports include `createSafeCallTool`: `src/agents/openclaw-tools.ts:14`
- Core registration (cron/gateway): `src/agents/openclaw-tools.ts:99`, `src/agents/openclaw-tools.ts:109`, `src/agents/openclaw-tools.ts:117`
- Plugin conflict guard includes `safe_call`: `src/agents/openclaw-tools.ts:176`
- Wrapper tool registration and resolver: `src/agents/openclaw-tools.ts:181`

## Registration pattern analysis: cron/gateway

### Shared pattern

Both built-ins follow a consistent contract:

- Export a `createXxxTool(...)` factory returning `AnyAgentTool`
- Define a flattened TypeBox schema (provider-compatible; runtime validation for action-specific required fields)
- Parse `action` + common gateway options
- Dispatch with `switch`/`if` per action and return `jsonResult(...)`
- Use `callGatewayTool(...)` helper to invoke gateway RPC

Evidence:

- `cron` schema and factory: `src/agents/tools/cron-tool.ts:29`, `src/agents/tools/cron-tool.ts:223`
- `gateway` schema and factory: `src/agents/tools/gateway-tool.ts:42`, `src/agents/tools/gateway-tool.ts:64`
- Shared RPC helper: `src/agents/tools/gateway.ts:28`

### cron-specific traits

- Action multiplexer via explicit `switch (action)` covering `status/list/add/update/remove/run/runs/wake`.
- Runtime normalization + compatibility repair for flattened model outputs.
- Gateway calls consistently wrapped by `jsonResult`.

Evidence:

- Action list/schema: `src/agents/tools/cron-tool.ts:18`, `src/agents/tools/cron-tool.ts:29`
- Action dispatch: `src/agents/tools/cron-tool.ts:290`
- Gateway calls: `src/agents/tools/cron-tool.ts:292`, `src/agents/tools/cron-tool.ts:415`

### gateway-specific traits

- Flattened action schema to avoid provider JSON Schema incompatibilities (`anyOf`/`oneOf` constraints documented in comments).
- Runtime conditional checks (`raw`/`baseHash`/`sessionKey`) by action branch.
- Returns normalized `{ ok: true, result }` for most RPC branches.

Evidence:

- Schema compatibility note: `src/agents/tools/gateway-tool.ts:39`
- Action dispatch branches: `src/agents/tools/gateway-tool.ts:167`, `src/agents/tools/gateway-tool.ts:175`, `src/agents/tools/gateway-tool.ts:201`, `src/agents/tools/gateway-tool.ts:227`

## Implications for safe_call

To stay consistent with repository style, `safe_call` should:

- Use a flattened tool schema and runtime checks.
- Return via `jsonResult` with deterministic metadata.
- Be appended after plugin resolution, so it can wrap both core + plugin tools.
- Explicitly avoid self-wrapping and unknown-tool ambiguity.

## Conclusion

Built-in tools in this repo are centrally registered in `createOpenClawTools` and follow a uniform factory+schema+runtime-dispatch style. `safe_call` fits this model when added as a final wrapper tool over the merged tool set.
