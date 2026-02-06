const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

function resolveMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function isSafePath(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

// The control UI is built with Vite base "./" by default. When the SPA navigates to /chat,
// the browser will try to fetch assets from /chat/assets/... (relative base). We map those
// back to /assets/... so deep routes and refreshes still work.
const TAB_PREFIXES = new Set([
  "chat",
  "overview",
  "channels",
  "instances",
  "sessions",
  "cron",
  "skills",
  "nodes",
  "agents",
  "config",
  "debug",
  "logs",
]);

function normalizeUrlPath(urlPath) {
  const raw = (urlPath || "/").split("?")[0].split("#")[0];
  if (!raw.startsWith("/")) {
    return `/${raw}`;
  }
  return raw;
}

function remapAssetPath(urlPath) {
  const normalized = normalizeUrlPath(urlPath);
  // /<tab>/assets/... -> /assets/...
  const parts = normalized.split("/").filter(Boolean);
  const tab = parts[0];
  if (tab && TAB_PREFIXES.has(tab) && parts[1] === "assets") {
    return `/${parts.slice(1).join("/")}`;
  }
  return normalized;
}

async function fileExists(filePath) {
  try {
    const st = await fs.promises.stat(filePath);
    return st.isFile();
  } catch {
    return false;
  }
}

function startStaticServer(rootDir, opts) {
  const host = (opts && opts.host) || "127.0.0.1";
  const port = (opts && opts.port) || 0;
  const indexPath = path.join(rootDir, "index.html");
  const injectHtml = opts && typeof opts.injectHtml === "function" ? opts.injectHtml : null;

  const server = http.createServer(async (req, res) => {
    try {
      const pathname = remapAssetPath(req.url || "/");

      const target =
        pathname === "/"
          ? indexPath
          : path.join(rootDir, pathname.replace(/^\//, ""));

      // Prevent directory traversal.
      if (!isSafePath(rootDir, target) && target !== indexPath) {
        res.statusCode = 403;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("Forbidden");
        return;
      }

      // Serve file if it exists; otherwise fall back to index.html (SPA).
      const resolved = (await fileExists(target)) ? target : indexPath;
      const mime = resolveMimeType(resolved);
      res.statusCode = 200;
      res.setHeader("content-type", mime);
      res.setHeader("cache-control", resolved === indexPath ? "no-cache" : "public, max-age=31536000, immutable");
      if (resolved === indexPath && injectHtml) {
        const html = await fs.promises.readFile(indexPath, "utf8");
        const injected = injectHtml(html) || html;
        res.end(injected);
        return;
      }
      fs.createReadStream(resolved).pipe(res);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(String(err));
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = address && typeof address === "object" ? address.port : port;
      resolve({
        server,
        url: `http://${host}:${actualPort}`,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

module.exports = { startStaticServer };
