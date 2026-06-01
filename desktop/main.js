import { app, BrowserWindow, Menu, Notification as ElectronNotification, dialog, ipcMain, nativeImage, screen } from "electron";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const APP_NAME = "오토원워크";
const WINDOW_TITLE = "오토원워크";
const STARTUP_LOG = join(tmpdir(), "autone-work-desktop.log");
const HOST = "127.0.0.1";
const MIN_WINDOW_SIZE = { width: 480, height: 720 };
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"]
]);

let server = null;
let mainWindow = null;
let activeNativeNotifications = new Set();

function getWindowStatePath() {
  return join(app.getPath("userData"), "window-state.json");
}

function getSavedWindowState() {
  try {
    const state = JSON.parse(readFileSync(getWindowStatePath(), "utf8"));
    const x = Number(state && state.x);
    const y = Number(state && state.y);
    const width = Number(state && state.width);
    const height = Number(state && state.height);
    if (width >= MIN_WINDOW_SIZE.width && height >= MIN_WINDOW_SIZE.height) {
      const savedState = { width: Math.round(width), height: Math.round(height) };
      if (Number.isFinite(x) && Number.isFinite(y)) {
        savedState.x = Math.round(x);
        savedState.y = Math.round(y);
      }
      return isWindowStateVisible(savedState) ? savedState : { width: savedState.width, height: savedState.height };
    }
  } catch (error) {}

  return getDefaultWindowState();
}

function getDefaultWindowState() {
  const display = screen.getPrimaryDisplay();
  const workArea = display && display.workArea ? display.workArea : display.bounds;
  return {
    width: 520,
    height: Math.max(MIN_WINDOW_SIZE.height, workArea.height)
  };
}

function isWindowStateVisible(state) {
  if (!Number.isFinite(state && state.x) || !Number.isFinite(state && state.y)) return false;
  const bounds = {
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height
  };
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea || display.bounds;
    return bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y;
  });
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    if (bounds.width < MIN_WINDOW_SIZE.width || bounds.height < MIN_WINDOW_SIZE.height) return;
    writeFileSync(getWindowStatePath(), JSON.stringify({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    }), "utf8");
  } catch (error) {}
}

function logStartup(message) {
  try {
    appendFileSync(STARTUP_LOG, `${new Date().toISOString()} ${message}\n`);
  } catch (error) {}
}

function getProjectRoot() {
  return resolve(fileURLToPath(new URL("..", import.meta.url)));
}

function getWebRoot() {
  if (app.isPackaged) {
    return resolve(process.resourcesPath, "webapp");
  }

  return getProjectRoot();
}

function getAppIconPath() {
  if (process.platform === "darwin") {
    if (app.isPackaged) {
      return resolve(process.resourcesPath, "icon.icns");
    }

    return resolve(getProjectRoot(), "img/app-icon-512.png");
  }

  return resolve(getProjectRoot(), "img/app-icon-512.png");
}

function resolveRequestPath(requestUrl, rootDir, port) {
  const url = new URL(requestUrl || "/", `http://${HOST}:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const relativePath = normalize(pathname).replace(/^([/\\])+/, "");
  const absolutePath = resolve(join(rootDir, relativePath));
  const rootWithSeparator = rootDir.endsWith(sep) ? rootDir : rootDir + sep;

  if (absolutePath !== rootDir && !absolutePath.startsWith(rootWithSeparator)) {
    return null;
  }

  return absolutePath;
}

function sendPlain(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

function startStaticServer(rootDir) {
  return new Promise((resolveServer, rejectServer) => {
    const instance = createServer(async (request, response) => {
      if (!["GET", "HEAD"].includes(request.method || "")) {
        sendPlain(response, 405, "Method not allowed");
        return;
      }

      const filePath = resolveRequestPath(request.url, rootDir, instance.address().port);
      if (!filePath) {
        sendPlain(response, 403, "Forbidden");
        return;
      }

      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
          sendPlain(response, 404, "File not found");
          return;
        }

        const contentType = MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream";
        response.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": fileStat.size,
          "Cache-Control": "no-cache"
        });

        if (request.method === "HEAD") {
          response.end();
          return;
        }

        createReadStream(filePath).pipe(response);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          sendPlain(response, 404, "File not found");
          return;
        }

        console.error(error);
        sendPlain(response, 500, "Internal server error");
      }
    });

    instance.on("error", rejectServer);
    instance.listen(0, HOST, () => resolveServer(instance));
  });
}

function focusMainWindow() {
  if (!mainWindow) return;
  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } catch (error) {}
}

function centerMainWindow() {
  if (!mainWindow) return;
  try {
    const displayBounds = screen.getPrimaryDisplay().bounds;
    const [width, height] = mainWindow.getSize();
    const x = Math.round(displayBounds.x + (displayBounds.width - width) / 2);
    const y = Math.round(displayBounds.y + (displayBounds.height - height) / 2);
    mainWindow.setPosition(x, y, false);
  } catch (error) {
    try {
      mainWindow.center();
    } catch (innerError) {}
  }
}

function positionMainWindowForDefaultSize() {
  if (!mainWindow) return;
  try {
    const display = screen.getPrimaryDisplay();
    const area = display.workArea || display.bounds;
    const [width] = mainWindow.getSize();
    const x = Math.round(area.x + (area.width - width) / 2);
    const y = Math.round(area.y);
    mainWindow.setPosition(x, y, false);
  } catch (error) {
    try {
      mainWindow.center();
    } catch (innerError) {}
  }
}

function showNativeNotification(payload) {
  const title = String(payload && payload.title || "새 알림").trim() || "새 알림";
  const hasSubtitle = payload && Object.prototype.hasOwnProperty.call(payload, "subtitle");
  const subtitle = hasSubtitle ? String(payload.subtitle || "").trim() : "";
  const body = String(payload && payload.body || "").trim();
  const url = String(payload && payload.url || "").trim();
  const iconPath = getAppIconPath();

  if (typeof ElectronNotification !== "function") return false;

  try {
    const notificationOptions = {
      title,
      body,
      icon: iconPath,
      silent: false
    };
    if (subtitle) notificationOptions.subtitle = subtitle;
    const notification = new ElectronNotification(notificationOptions);

    activeNativeNotifications.add(notification);
    notification.on("show", () => {});
    notification.on("close", () => {
      activeNativeNotifications.delete(notification);
    });
    notification.on("click", () => {
      focusMainWindow();
      if (mainWindow && url) {
        try {
          mainWindow.webContents.send("groupware:notification-open", { url });
        } catch (error) {}
      }
      activeNativeNotifications.delete(notification);
    });

    notification.show();
    return true;
  } catch (error) {
    return false;
  }
}

function configureApplicationMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "편집",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createMainWindow(baseUrl) {
  const iconPath = getAppIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  const savedWindowState = getSavedWindowState();
  const hasSavedPosition = Number.isFinite(savedWindowState.x) && Number.isFinite(savedWindowState.y);

  mainWindow = new BrowserWindow({
    ...(hasSavedPosition ? { x: savedWindowState.x, y: savedWindowState.y } : {}),
    width: savedWindowState.width,
    height: savedWindowState.height,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    backgroundColor: "#ffffff",
    title: WINDOW_TITLE,
    show: false,
    webPreferences: {
      preload: resolve(fileURLToPath(new URL("./preload.js", import.meta.url))),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.platform === "darwin" && icon && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }

  if (!icon.isEmpty()) {
    mainWindow.setIcon(icon);
  }

  if (!hasSavedPosition) positionMainWindowForDefaultSize();
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !hasSavedPosition) positionMainWindowForDefaultSize();
    if (mainWindow) mainWindow.show();
  });
  mainWindow.on("resize", saveWindowState);
  mainWindow.on("move", saveWindowState);
  mainWindow.on("close", () => {
    saveWindowState();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(new URL("/index.html", baseUrl).toString());
}

async function printHtmlDocument(html) {
  if (typeof html !== "string" || !html.trim()) {
    return false;
  }

  if (!app || typeof app.isReady !== "function" || !app.isReady()) {
    return false;
  }

  return await new Promise((resolve) => {
    const printWindow = new BrowserWindow({
      show: false,
      width: 960,
      height: 820,
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    let finished = false;
    const settle = (value) => {
      if (finished) return;
      finished = true;
      try {
        if (!printWindow.isDestroyed()) {
          printWindow.close();
        }
      } catch (error) {}
      resolve(value);
    };

    printWindow.on("closed", () => {
      settle(false);
    });

    printWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        if (printWindow.isDestroyed()) {
          settle(false);
          return;
        }

        printWindow.webContents.print({ printBackground: true, silent: false }, (success, errorType) => {
          if (!success && errorType) {
            console.error("Print failed:", errorType);
          }
          settle(!!success);
        });
      }, 100);
    });

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch((error) => {
      console.error(error);
      settle(false);
    });
  });
}

async function downloadDataUrlFile(payload) {
  const name = String(payload && payload.name || "download").trim() || "download";
  const dataUrl = String(payload && payload.dataUrl || "");
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return false;

  const header = dataUrl.slice(0, commaIndex).toLowerCase();
  const body = dataUrl.slice(commaIndex + 1);
  const buffer = header.includes(";base64")
    ? Buffer.from(body, "base64")
    : Buffer.from(decodeURIComponent(body), "utf8");
  const result = await dialog.showSaveDialog(mainWindow || undefined, {
    defaultPath: name
  });
  if (result.canceled || !result.filePath) return false;
  writeFileSync(result.filePath, buffer);
  return true;
}

app.setName(APP_NAME);
app.setAppUserModelId("com.autone.work");
logStartup("main.js loaded");

ipcMain.handle("groupware:show-notification", (_event, payload) => {
  return showNativeNotification(payload);
});

ipcMain.handle("groupware:request-notification-permission", async () => {
  return "granted";
});

ipcMain.handle("groupware:print-mail-html", async (_event, payload) => {
  const html = String(payload && payload.html || "");
  return printHtmlDocument(html);
});

ipcMain.handle("groupware:download-file", async (_event, payload) => {
  return downloadDataUrlFile(payload);
});

app.whenReady().then(async () => {
  logStartup("app.whenReady");
  configureApplicationMenu();
  const rootDir = getWebRoot();
  logStartup(`webRoot=${rootDir}`);
  server = await startStaticServer(rootDir);
  logStartup("server started");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = new URL(`http://${HOST}:${port}`);

  logStartup(`baseUrl=${baseUrl.toString()}`);
  await createMainWindow(baseUrl);
  logStartup("main window created");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(baseUrl).catch((error) => console.error(error));
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (server) {
    server.close();
    server = null;
  }
});
