const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain, Menu, shell, Tray } = require("electron");
const { startStaticServer } = require("./static-server.cjs");

const PRODUCT_NAME = "OpenClaw CN";

function resolveUiRoot() {
  // Packaged: extraResources -> <resources>/control-ui
  const packagedRoot = path.join(process.resourcesPath, "control-ui");
  if (fs.existsSync(path.join(packagedRoot, "index.html"))) {
    return packagedRoot;
  }

  // Dev: repoRoot/dist/control-ui
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  return path.join(repoRoot, "dist", "control-ui");
}

function createMainWindow(opts) {
  const win = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 1020,
    minHeight: 640,
    title: PRODUCT_NAME,
    backgroundColor: "#12141a",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.once("ready-to-show", () => win.show());

  // Handle external links safely.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    try {
      const parsed = new URL(url);
      // Allow our local UI server only; open other URLs externally.
      if (opts && opts.allowedOrigin && parsed.origin === opts.allowedOrigin) {
        return;
      }
      event.preventDefault();
      void shell.openExternal(url);
    } catch {
      // ignore
    }
  });

  return win;
}

function buildAppMenu(win) {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
          },
        ]
      : []),
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "Command Center",
          accelerator: "CommandOrControl+K",
          click: () => {
            if (!win) return;
            win.focus();
            // UI has its own Ctrl/Cmd+K listener; this is just a safe fallback.
            void win.webContents.executeJavaScript(
              "window.dispatchEvent(new CustomEvent('openclawDesktop:openCommandCenter'))",
            );
          },
        },
        { type: "separator" },
        { role: "minimize" },
        ...(isMac ? [{ role: "close" }] : [{ role: "close" }]),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Docs (zh-CN)",
          click: () => void shell.openExternal("https://docs.openclaw.ai/zh-CN/index"),
        },
        {
          label: "ClawHub",
          click: () => void shell.openExternal("https://clawhub.com"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray(win) {
  // Use a safe fallback icon if not found; tray is optional.
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const fallbackPng = path.join(repoRoot, "assets", "chrome-extension", "icons", "icon32.png");
  const trayIcon = fs.existsSync(fallbackPng) ? fallbackPng : undefined;
  if (!trayIcon) {
    return null;
  }
  const tray = new Tray(trayIcon);
  tray.setToolTip(PRODUCT_NAME);
  const menu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: () => {
        win.show();
        win.focus();
      },
    },
    { type: "separator" },
    {
      label: "Command Center",
      click: () => {
        win.show();
        win.focus();
        void win.webContents.executeJavaScript(
          "window.dispatchEvent(new CustomEvent('openclawDesktop:openCommandCenter'))",
        );
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => {
    win.show();
    win.focus();
  });
  return tray;
}

async function main() {
  app.setName(PRODUCT_NAME);

  const uiUrlOverride = process.env.OPENCLAW_CN_UI_URL;
  let server = null;
  let origin = null;
  let startUrl = null;

  if (uiUrlOverride && uiUrlOverride.trim()) {
    startUrl = uiUrlOverride.trim().replace(/\/$/, "");
    origin = new URL(startUrl).origin;
  } else {
    const uiRoot = resolveUiRoot();
    server = await startStaticServer(uiRoot, { host: "127.0.0.1", port: 0 });
    startUrl = server.url;
    origin = server.url;
  }

  const win = createMainWindow({ allowedOrigin: origin });
  buildAppMenu(win);
  createTray(win);

  ipcMain.handle("openclawDesktop.version", () => ({
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }));

  ipcMain.handle("openclawDesktop.openCommandCenter", async () => {
    if (!win || win.isDestroyed()) return { ok: false };
    win.show();
    win.focus();
    await win.webContents.executeJavaScript(
      "window.dispatchEvent(new CustomEvent('openclawDesktop:openCommandCenter'))",
    );
    return { ok: true };
  });

  // Note: Control UI uses History API; our local server supports SPA fallback.
  await win.loadURL(`${startUrl}/`);
}

app.whenReady().then(() => {
  void main();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

