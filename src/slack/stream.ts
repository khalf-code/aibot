import type { WebClient } from "@slack/web-api";
import { logVerbose } from "../globals.js";

export type SlackStreamHandle = {
  /** Append markdown text to the live-updating message. */
  append: (text: string) => Promise<void>;
  /** Finalize the stream. The message becomes a normal Slack message. */
  stop: () => Promise<void>;
};

/** Minimum ms between stream appends to create a visible reveal effect. */
const STREAM_CHUNK_DELAY_MS = 80;
/** Approximate characters per streaming chunk. */
const STREAM_CHUNK_SIZE = 60;

/**
 * Split `text` into chunks that break on word/sentence boundaries so the
 * streaming reveal looks natural.  Each chunk is roughly `chunkSize` chars
 * but never splits mid-word.
 */
function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= chunkSize) {
      chunks.push(remaining);
      break;
    }
    // Try to break on whitespace near the target size.
    let end = remaining.lastIndexOf(" ", chunkSize);
    if (end <= 0) {
      // No space found — try newline or just hard-cut.
      end = remaining.indexOf(" ", chunkSize);
      if (end <= 0) end = remaining.length;
    }
    chunks.push(remaining.slice(0, end + 1));
    remaining = remaining.slice(end + 1);
  }
  return chunks;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Start a Slack streaming message using the `chat.startStream` /
 * `chat.appendStream` / `chat.stopStream` API family (Web API ≥ 7.11).
 *
 * The handle's `append` method automatically chunks large text into
 * incremental updates with short delays to create a visible streaming
 * effect in the Slack client.
 *
 * The helper uses `client.chatStream()` when available and falls back to
 * raw `apiCall` for older SDK builds that expose the methods but not the
 * convenience wrapper.
 */
export async function startSlackStream(params: {
  client: WebClient;
  channel: string;
  threadTs?: string;
}): Promise<SlackStreamHandle> {
  const { client, channel, threadTs } = params;

  // The @slack/web-api >=7.11 exposes chatStream() as a convenience helper.
  const clientAny = client as unknown as {
    chatStream?: (opts: Record<string, unknown>) => {
      append: (opts: { markdown_text: string }) => Promise<void>;
      stop: () => Promise<void>;
    };
  };

  // Build the raw append/stop functions first, then wrap with chunking.
  let rawAppend: (text: string) => Promise<void>;
  let rawStop: () => Promise<void>;

  if (typeof clientAny.chatStream === "function") {
    const streamer = clientAny.chatStream({
      channel,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    });
    rawAppend = (text: string) => streamer.append({ markdown_text: text });
    rawStop = () => streamer.stop();
  } else {
    // Fallback: call raw API methods.
    const startResult = (await client.apiCall("chat.startStream", {
      channel,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    })) as { stream_id?: string };

    const streamId = startResult.stream_id;
    if (!streamId) {
      throw new Error("chat.startStream did not return a stream_id");
    }

    rawAppend = async (text: string) => {
      await client.apiCall("chat.appendStream", {
        stream_id: streamId,
        text,
      });
    };
    rawStop = async () => {
      await client.apiCall("chat.stopStream", {
        stream_id: streamId,
      });
    };
  }

  // Wrap append with chunking for visible progressive reveal.
  const chunkedAppend = async (text: string) => {
    const chunks = chunkText(text, STREAM_CHUNK_SIZE);
    for (let i = 0; i < chunks.length; i++) {
      await rawAppend(chunks[i]);
      // Delay between chunks (skip after last chunk).
      if (i < chunks.length - 1) {
        await sleep(STREAM_CHUNK_DELAY_MS);
      }
    }
  };

  return {
    append: chunkedAppend,
    stop: rawStop,
  };
}

/**
 * Deliver a complete message via streaming, chunking the text into
 * incremental appends.  Falls back to returning `false` if the stream
 * API is unavailable so callers can use the normal `postMessage` path.
 */
export async function deliverViaStream(params: {
  client: WebClient;
  channel: string;
  text: string;
  threadTs?: string;
}): Promise<boolean> {
  try {
    const stream = await startSlackStream({
      client: params.client,
      channel: params.channel,
      threadTs: params.threadTs,
    });
    await stream.append(params.text);
    await stream.stop();
    return true;
  } catch (err) {
    logVerbose(`slack stream delivery failed, will fall back: ${String(err)}`);
    return false;
  }
}
