import type { ClawdbotConfig, RuntimeEnv, ReplyPayload } from "clawdbot/plugin-sdk";
import { createReplyPrefixContext } from "clawdbot/plugin-sdk";
import { wpsOutbound } from "./send.js";
import { getWpsRuntime } from "./runtime.js";

type PayloadBody = string | { text?: string } | null | undefined;

/** Simple dispatcher for sending pairing/one-off messages. */
export type WpsSimpleDispatcher = {
  dispatch: (payload: { body?: PayloadBody }) => Promise<{ id: string; ts: number }>;
};

function extractText(body: PayloadBody): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && "text" in body) {
    return body.text ?? "";
  }
  return "";
}

/** Simple dispatcher for pairing and one-off messages. */
export function createWpsSimpleDispatcher(opts: {
  cfg: ClawdbotConfig;
  channelId: string;
}): WpsSimpleDispatcher {
  return {
    dispatch: async (payload) => {
      const text = extractText(payload.body);

      if (!text) {
        return { id: "skipped", ts: Date.now() };
      }

      if (!wpsOutbound.sendText) {
        throw new Error("wpsOutbound.sendText not implemented");
      }

      const result = await wpsOutbound.sendText({
        cfg: opts.cfg,
        to: opts.channelId,
        text,
      });

      return { id: result.messageId ?? "", ts: result.timestamp ?? Date.now() };
    },
  };
}

/** Full dispatcher for use with dispatchReplyFromConfig. */
export function createWpsReplyDispatcher(params: {
  cfg: ClawdbotConfig;
  agentId: string;
  runtime?: RuntimeEnv;
  channelId: string;
}) {
  const core = getWpsRuntime();
  const prefixContext = createReplyPrefixContext({
    cfg: params.cfg,
    agentId: params.agentId,
  });

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: prefixContext.responsePrefix,
      responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(params.cfg, params.agentId),
      deliver: async (payload: ReplyPayload) => {
        const text = payload.text ?? "";
        if (!text) return;

        if (!wpsOutbound.sendText) {
          throw new Error("wpsOutbound.sendText not implemented");
        }

        await wpsOutbound.sendText({
          cfg: params.cfg,
          to: params.channelId,
          text,
        });
      },
      onError: (err, info) => {
        const logError = params.runtime?.error ?? console.error;
        logError(`wps ${info.kind} reply failed: ${String(err)}`);
      },
    });

  return {
    dispatcher,
    replyOptions: { ...replyOptions, onModelSelected: prefixContext.onModelSelected },
    markDispatchIdle,
  };
}