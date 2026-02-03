import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { ResolvedBrowserConfig } from "./config.js";
import type { BrowserRouteRegistrar } from "./routes/types.js";
import { validateHostHeader } from "../gateway/auth.js";
import { registerBrowserRoutes } from "./routes/index.js";
import {
  type BrowserServerState,
  createBrowserRouteContext,
  type ProfileContext,
} from "./server-context.js";

export type BrowserBridge = {
  server: Server;
  port: number;
  baseUrl: string;
  state: BrowserServerState;
};

/** Default allowed Host header values for DNS rebinding protection. */
const DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "::1"];

export async function startBrowserBridgeServer(params: {
  resolved: ResolvedBrowserConfig;
  host?: string;
  port?: number;
  authToken?: string;
  allowedHosts?: string[];
  onEnsureAttachTarget?: (profile: ProfileContext["profile"]) => Promise<void>;
}): Promise<BrowserBridge> {
  const host = params.host ?? "127.0.0.1";
  const port = params.port ?? 0;

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // DNS rebinding protection: validate Host header on all requests
  const allowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...(params.allowedHosts ?? [])];
  app.use((req, res, next) => {
    const hostCheck = validateHostHeader(req, allowedHosts);
    if (!hostCheck.valid) {
      res.status(403).send("Forbidden: Invalid Host header");
      return;
    }
    next();
  });

  const authToken = params.authToken?.trim();
  if (authToken) {
    app.use((req, res, next) => {
      const auth = String(req.headers.authorization ?? "").trim();
      if (auth === `Bearer ${authToken}`) {
        return next();
      }
      res.status(401).send("Unauthorized");
    });
  }

  const state: BrowserServerState = {
    server: null as unknown as Server,
    port,
    resolved: params.resolved,
    profiles: new Map(),
  };

  const ctx = createBrowserRouteContext({
    getState: () => state,
    onEnsureAttachTarget: params.onEnsureAttachTarget,
  });
  registerBrowserRoutes(app as unknown as BrowserRouteRegistrar, ctx);

  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, host, () => resolve(s));
    s.once("error", reject);
  });

  const address = server.address() as AddressInfo | null;
  const resolvedPort = address?.port ?? port;
  state.server = server;
  state.port = resolvedPort;
  state.resolved.controlPort = resolvedPort;

  const baseUrl = `http://${host}:${resolvedPort}`;
  return { server, port: resolvedPort, baseUrl, state };
}

export async function stopBrowserBridgeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
