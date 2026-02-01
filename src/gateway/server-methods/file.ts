import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const DEFAULT_WORKSPACE = path.join(os.homedir(), ".openclaw", "workspace");

function expandTilde(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath === "~") {
    return os.homedir();
  }
  return filePath;
}

export const fileHandlers: GatewayRequestHandlers = {
  "file.read": async ({ params, respond }) => {
    const filePath = params.path;
    if (typeof filePath !== "string" || !filePath) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "missing required param: path"),
      );
      return;
    }
    const expanded = expandTilde(filePath);
    const resolved = path.isAbsolute(expanded)
      ? expanded
      : path.resolve(DEFAULT_WORKSPACE, expanded);
    const encoding =
      typeof params.encoding === "string" && params.encoding === "base64" ? "base64" : "utf-8";
    try {
      const [buf, info] = await Promise.all([readFile(resolved), stat(resolved)]);
      const content = encoding === "base64" ? buf.toString("base64") : buf.toString("utf-8");
      respond(true, { path: resolved, content, size: info.size, encoding });
    } catch {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `cannot read file: ${resolved}`),
      );
    }
  },
};
