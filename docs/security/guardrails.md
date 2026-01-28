---
title: Guardrails
summary: Input/output validation and tool call security with @sentinelseed/moltbot.
permalink: /security/guardrails/
---

# Guardrails

The [@sentinelseed/moltbot](https://www.npmjs.com/package/@sentinelseed/moltbot) package provides security guardrails for Moltbot, including prompt injection detection, tool call validation, and credential leak prevention.

```bash
npm install @sentinelseed/moltbot
```

## Usage

The package exposes three main functions: `validateInput`, `validateToolCall`, and `validateOutput`. Each returns a result object with a `blocked` boolean and, when blocked, a `reason` string explaining why.

**Input validation** checks user messages before they reach the agent. It detects prompt injection attempts, jailbreak patterns, and encoded payloads (base64, hex).

```ts
import { validateInput } from '@sentinelseed/moltbot';

const result = await validateInput(userMessage);
if (result.blocked) {
  // handle blocked input
}
```

**Tool call validation** inspects tool invocations before execution. It blocks dangerous shell commands (rm -rf, format), SQL injection patterns, path traversal attempts, and command injection via shell metacharacters.

```ts
import { validateToolCall } from '@sentinelseed/moltbot';

const result = await validateToolCall({
  name: 'shell',
  arguments: { command: 'rm -rf /' }
});
```

**Output validation** scans agent responses for leaked credentials. It catches API keys (OpenAI, GitHub, AWS), passwords, private keys (SSH, PGP), and tokens (JWT, bearer).

```ts
import { validateOutput } from '@sentinelseed/moltbot';

const result = await validateOutput(aiResponse);
```

## Hook integration

The recommended approach is to wire validation into Moltbot's hook system. The example below validates both incoming messages and tool calls before they execute.

```ts
// hooks/sentinel-guard/handler.ts
import { validateInput, validateToolCall } from '@sentinelseed/moltbot';

export default {
  'message:before': async (ctx) => {
    const result = await validateInput(ctx.message.text);
    if (result.blocked) {
      return { abort: true, reason: result.reason };
    }
  },

  'tool:before': async (ctx) => {
    const result = await validateToolCall(ctx.tool);
    if (result.blocked) {
      return { abort: true, reason: result.reason };
    }
  }
};
```

## Configuration

You can customize validation behavior by creating a `sentinel.config.ts` in your workspace. The config accepts custom patterns for dangerous commands and credentials.

```ts
import { defineConfig } from '@sentinelseed/moltbot';

export default defineConfig({
  blockDangerousCommands: true,
  dangerousPatterns: [/rm\s+-rf/, /DROP\s+TABLE/i],
  credentialPatterns: [/sk-[a-zA-Z0-9]{48}/, /ghp_[a-zA-Z0-9]{36}/],
});
```

All validation runs locally without external API calls. Typical latency is 2-5ms per validation call.

## Links

See the [npm package](https://www.npmjs.com/package/@sentinelseed/moltbot) for installation details, the [source repository](https://github.com/sentinel-seed/sentinel) for implementation, and the [Sentinel documentation](https://sentinelseed.dev/docs/moltbot) for additional examples.
