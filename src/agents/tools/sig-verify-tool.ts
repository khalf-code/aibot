/**
 * sig verify tool — allows the LLM to verify instruction authenticity.
 *
 * Verifies system prompt templates against cryptographic signatures,
 * and verifies message provenance via the session ContentStore.
 * This is the out-of-band verification mechanism: the tool's return values
 * come from a code path the attacker cannot influence.
 */

import { findProjectRoot, verifyFile, checkAllSigned } from "@disreguard/sig";
import { Type } from "@sinclair/typebox";
import type { MessageSigningContext } from "../message-signing.js";
import type { AnyAgentTool } from "./common.js";
import { setVerified } from "../session-security-state.js";
import { jsonResult } from "./common.js";

export interface SigVerifyToolOptions {
  /** Message signing context for the current session. */
  messageSigning?: MessageSigningContext;
  /** Session key for verification state tracking. */
  sessionKey?: string;
  /** Current turn ID for scoped verification. */
  turnId?: string;
}

const SigVerifySchema = Type.Object({
  file: Type.Optional(
    Type.String({
      description:
        "Verify a specific template file (e.g. 'identity.txt'). Omit to verify all signed templates.",
    }),
  ),
  message: Type.Optional(
    Type.String({
      description:
        "Verify a signed message by its signature ID. Returns the original content and provenance if valid.",
    }),
  ),
});

// Lazily resolved project root (cached after first resolution)
let resolvedProjectRoot: string | null | undefined;

async function getProjectRoot(): Promise<string | null> {
  if (resolvedProjectRoot !== undefined) {
    return resolvedProjectRoot;
  }
  try {
    resolvedProjectRoot = await findProjectRoot(process.cwd());
  } catch {
    resolvedProjectRoot = null;
  }
  return resolvedProjectRoot;
}

/**
 * Create the sig verify tool.
 * Always returns a tool when message signing is available or when called for owner senders.
 */
export function createSigVerifyTool(options?: SigVerifyToolOptions): AnyAgentTool {
  return {
    label: "Verify",
    name: "verify",
    description:
      "Verify instruction authenticity and message provenance (sig). " +
      "Call without arguments to verify all system prompt templates. " +
      "Pass `file` to verify a specific template, or `message` to verify a signed message.",
    parameters: SigVerifySchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const file = typeof params.file === "string" ? params.file.trim() : undefined;
      const message = typeof params.message === "string" ? params.message.trim() : undefined;

      // Message verification
      if (message) {
        return verifyMessage(message, options);
      }

      // Template verification
      const projectRoot = await getProjectRoot();
      if (!projectRoot) {
        return jsonResult({
          allVerified: false,
          error: "No .sig/ directory found in project. Templates cannot be verified.",
        });
      }

      if (file) {
        return verifySingleTemplate(projectRoot, file, options);
      }

      return verifyAllTemplates(projectRoot, options);
    },
  };
}

// ---------------------------------------------------------------------------
// Template verification
// ---------------------------------------------------------------------------

async function verifySingleTemplate(
  projectRoot: string,
  file: string,
  options?: SigVerifyToolOptions,
) {
  const templatePath = `llm/prompts/${file}`;
  try {
    const result = await verifyFile(projectRoot, templatePath);
    const allVerified = result.verified;

    if (allVerified && options?.sessionKey && options.turnId) {
      setVerified(options.sessionKey, options.turnId);
    }

    return jsonResult({
      allVerified,
      templates: [
        {
          file: result.file,
          verified: result.verified,
          template: result.template,
          signedBy: result.signedBy,
          signedAt: result.signedAt,
          placeholders: result.placeholders,
          error: result.error,
        },
      ],
    });
  } catch (err) {
    return jsonResult({
      allVerified: false,
      templates: [
        {
          file: templatePath,
          verified: false,
          error: err instanceof Error ? err.message : String(err),
        },
      ],
    });
  }
}

async function verifyAllTemplates(projectRoot: string, options?: SigVerifyToolOptions) {
  try {
    const checkResults = await checkAllSigned(projectRoot);
    if (checkResults.length === 0) {
      return jsonResult({
        allVerified: false,
        error: "No signed templates found.",
        templates: [],
      });
    }

    // Verify each signed template
    const results = await Promise.all(
      checkResults.map(async (check) => {
        if (check.status !== "signed") {
          return {
            file: check.file,
            verified: false,
            error:
              check.status === "modified"
                ? "Content has been modified since signing"
                : check.status === "unsigned"
                  ? "No signature found"
                  : "Signature is corrupted",
          };
        }
        try {
          const result = await verifyFile(projectRoot, check.file);
          return {
            file: result.file,
            verified: result.verified,
            template: result.template,
            signedBy: result.signedBy,
            signedAt: result.signedAt,
            placeholders: result.placeholders,
            error: result.error,
          };
        } catch (err) {
          return {
            file: check.file,
            verified: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    const allVerified = results.every((r) => r.verified);
    if (allVerified && options?.sessionKey && options.turnId) {
      setVerified(options.sessionKey, options.turnId);
    }

    return jsonResult({ allVerified, templates: results });
  } catch (err) {
    return jsonResult({
      allVerified: false,
      error: err instanceof Error ? err.message : String(err),
      templates: [],
    });
  }
}

// ---------------------------------------------------------------------------
// Message verification
// ---------------------------------------------------------------------------

function verifyMessage(messageId: string, options?: SigVerifyToolOptions) {
  const store = options?.messageSigning?.store;
  if (!store) {
    return jsonResult({
      verified: false,
      messageId,
      error: "Message signing is not enabled for this session.",
    });
  }

  const result = store.verify(messageId);
  if (!result.verified) {
    return jsonResult({
      verified: false,
      messageId,
      error: result.error ?? "Message verification failed",
    });
  }

  return jsonResult({
    verified: true,
    messageId,
    content: result.content,
    signature: result.signature
      ? {
          signedBy: result.signature.signedBy,
          signedAt: result.signature.signedAt,
          metadata: result.signature.metadata,
        }
      : undefined,
  });
}
