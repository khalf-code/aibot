/**
 * SMS Webhook Handler
 * Handles inbound SMS/MMS messages and delivery reports
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { parse as parseUrl } from "node:url";
import type { SMSProvider } from "./providers/index.js";
import type { SMSResolvedAccount, QuickCommand } from "./types.js";

export type WebhookMessageHandler = (message: {
  from: string;
  to: string;
  text: string;
  messageId: string;
  isMedia: boolean;
  mediaUrls: string[];
  accountId: string;
}) => Promise<string | void>;

export type WebhookServerOptions = {
  provider: SMSProvider;
  account: SMSResolvedAccount;
  accountId: string;
  path: string;
  port: number;
  host?: string;
  onMessage: WebhookMessageHandler;
  onError?: (error: Error) => void;
  log?: (message: string, data?: Record<string, unknown>) => void;
};

/**
 * Parse URL-encoded body from request
 */
async function parseBody(req: IncomingMessage): Promise<{ body: Record<string, string>; raw: string }> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        const params = new URLSearchParams(raw);
        const body: Record<string, string> = {};
        for (const [key, value] of params) {
          body[key] = value;
        }
        resolve({ body, raw });
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Process quick commands - expand shortcuts to full commands
 */
function processQuickCommand(
  text: string,
  commands: QuickCommand[],
  enabled: boolean
): string {
  if (!enabled || !commands.length) return text;

  const commandMap = new Map(commands.map((c) => [c.trigger.toLowerCase(), c]));
  const trimmedText = text.trim().toLowerCase();

  // Exact match
  const exactMatch = commandMap.get(trimmedText);
  if (exactMatch) return exactMatch.fullCommand;

  // Prefix match (e.g., "cal tomorrow" -> "show my calendar for tomorrow")
  const words = trimmedText.split(/\s+/);
  const prefixMatch = commandMap.get(words[0]);
  if (prefixMatch && words.length > 1) {
    return `${prefixMatch.fullCommand} ${words.slice(1).join(" ")}`;
  }

  return text;
}

/**
 * Create and start webhook server
 */
export async function startWebhookServer(
  options: WebhookServerOptions
): Promise<{ server: ReturnType<typeof createServer>; stop: () => Promise<void> }> {
  const {
    provider,
    account,
    accountId,
    path,
    port,
    host = "0.0.0.0",
    onMessage,
    onError,
    log = console.log,
  } = options;

  const inboundPath = path;
  const statusPath = `${path}/status`;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parseUrl(req.url || "", true);
    const urlPath = parsedUrl.pathname || "";

    // Health check
    if (urlPath === `${path}/health` && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", channel: "sms", provider: provider.name, accountId }));
      return;
    }

    // Only handle POST requests
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }

    try {
      const { body, raw } = await parseBody(req);
      const fullUrl = `http://${req.headers.host}${req.url}`;

      // Validate signature
      if (account.webhookSecret) {
        const verification = provider.verifyWebhook(
          { req, body, rawBody: raw, url: fullUrl },
          account.webhookSecret
        );
        if (!verification.valid) {
          log("Invalid webhook signature", { path: urlPath, error: verification.error });
          res.writeHead(401);
          res.end("Unauthorized");
          return;
        }
      }

      // Parse webhook
      const parsed = provider.parseWebhook({ req, body, rawBody: raw, url: fullUrl });

      // Inbound message
      if (urlPath === inboundPath && parsed.type === "message" && parsed.message) {
        const message = parsed.message;

        // Process quick commands
        const processedText = processQuickCommand(
          message.text,
          account.quickCommands,
          account.enableQuickCommands
        );

        log("Received inbound message", {
          from: message.from,
          messageId: message.messageId,
          isMedia: message.isMedia,
        });

        // Call message handler
        const reply = await onMessage({
          from: message.from,
          to: message.to,
          text: processedText,
          messageId: message.messageId,
          isMedia: message.isMedia,
          mediaUrls: message.mediaUrls,
          accountId,
        });

        // If handler returns a string, send as immediate reply
        if (reply && typeof reply === "string") {
          const xml = provider.buildReplyResponse(message.to, message.from, reply);
          res.writeHead(200, { "Content-Type": "application/xml" });
          res.end(xml);
          return;
        }

        res.writeHead(200);
        res.end("OK");
        return;
      }

      // Delivery status report
      if (urlPath === statusPath && parsed.type === "status" && parsed.status) {
        log("Received delivery report", {
          messageId: parsed.status.messageId,
          status: parsed.status.status,
        });
        res.writeHead(200);
        res.end("OK");
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    } catch (error) {
      log("Webhook error", { error: String(error) });
      onError?.(error as Error);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      log(`SMS webhook server started`, { port, path: inboundPath, provider: provider.name });
      resolve({
        server,
        stop: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
