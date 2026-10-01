const { app, BrowserWindow, Menu, Tray, shell, nativeImage, ipcMain, dialog, globalShortcut } = require("electron");
const path = require("path");
const { spawn, fork } = require("child_process");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const AdmZip = require("adm-zip");
const { autoUpdater } = require("electron-updater");

// Performance flags
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

let mainWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;
let rendererReady = false;
const pendingCommands = [];
let PORT = 3000;
let startUrl = `http://127.0.0.1:${PORT}`;
const defaults = { closeToTray: true, globalShortcut: true, theme: "system" };
let settings = { ...defaults };

function settingsPath() { return path.join(app.getPath("userData"), "settings.json"); }
function logError(label, error) {
  try {
    const folder = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(folder, { recursive: true });
    fs.appendFileSync(path.join(folder, "desktop.log"), `${new Date().toISOString()} ${label}: ${String(error?.stack || error)}\n`);
  } catch {}
}
process.on("uncaughtException", error => logError("uncaughtException", error));
process.on("unhandledRejection", error => logError("unhandledRejection", error));
function ensureDesktopShortcut() {
  if (!app.isPackaged || process.platform !== "win32") return;
  const dirs = new Set([app.getPath("desktop"), path.join(app.getPath("home"), "OneDrive", "Desktop")]);
  for (const directory of dirs) {
    if (!fs.existsSync(directory)) continue;
    const shortcut = path.join(directory, "Notion Lite.lnk");
    try {
      shell.writeShortcutLink(shortcut, "create", {
        target: app.getPath("exe"), cwd: path.dirname(app.getPath("exe")), icon: app.getPath("exe"), iconIndex: 0,
        description: "Open Notion Lite"
      });
    } catch (error) { logError("shortcut", error); }
  }
}
function announceUpdate(status) { mainWindow?.webContents.send("desktop:update-status", status); }
autoUpdater.autoDownload = true;
autoUpdater.on("checking-for-update", () => announceUpdate("Checking for updates..."));
autoUpdater.on("update-available", () => announceUpdate("Downloading update..."));
autoUpdater.on("update-not-available", () => announceUpdate("Up to date."));
autoUpdater.on("error", error => { logError("update", error); announceUpdate("Update check failed."); });
autoUpdater.on("update-downloaded", async () => {
  announceUpdate("Update ready to install.");
  const response = await dialog.showMessageBox(mainWindow, { type: "info", buttons: ["Later", "Restart and install"], defaultId: 1, title: "Notion Lite update", message: "An update is ready." });
  if (response.response === 1) { isQuitting = true; autoUpdater.quitAndInstall(); }
});
ipcMain.handle("desktop:check-updates", async event => {
  trusted(event);
  if (!app.isPackaged) return { status: "Available in packaged builds" };
  await autoUpdater.checkForUpdates();
  return { status: "Checking for updates" };
});
function loadSettings() {
  try { settings = { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath(), "utf8")) }; }
  catch { settings = { ...defaults }; }
}
function persistSettings() {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}
function showWindow(command) {
  if (!mainWindow || mainWindow.isDestroyed()) { if (command) pendingCommands.push(command); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
  if (command) {
    if (rendererReady) mainWindow.webContents.send("desktop:command", command);
    else pendingCommands.push(command);
  }
}
ipcMain.on("desktop:renderer-ready", event => {
  trusted(event);
  rendererReady = true;
  while (pendingCommands.length) mainWindow?.webContents.send("desktop:command", pendingCommands.shift());
});
function setShortcut() {
  globalShortcut.unregister("Control+Alt+Space");
  if (!settings.globalShortcut) return;
  settings.shortcutRegistered = globalShortcut.register("Control+Alt+Space", () => showWindow("search"));
}

// Generate a random internal secret for API authentication
const internalSecret = crypto.randomBytes(32).toString('hex');

// Provide internal secret to preload via IPC
ipcMain.on("get-internal-secret-sync", (event) => {
  trusted(event);
  event.returnValue = internalSecret;
});

function trusted(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error("Untrusted desktop request");
}
ipcMain.handle("desktop:get-settings", (event) => {
  trusted(event);
  return { ...settings, shortcutRegistered: settings.shortcutRegistered !== false };
});
ipcMain.handle("desktop:set-settings", (event, changes) => {
  trusted(event);
  if (!changes || typeof changes !== "object") throw new Error("Invalid settings");
  for (const key of ["closeToTray", "globalShortcut"]) {
    if (typeof changes[key] === "boolean") settings[key] = changes[key];
  }
  if (["light", "dark", "system"].includes(changes.theme)) settings.theme = changes.theme;
  persistSettings(); setShortcut(); createAppMenu();
  return { ...settings, shortcutRegistered: settings.shortcutRegistered !== false };
});
ipcMain.handle("desktop:get-app-info", (event) => {
  trusted(event);
  return { version: app.getVersion(), dataPath: app.getPath("userData"), packaged: app.isPackaged };
});
ipcMain.handle("desktop:save-file", async (event, request) => {
  trusted(event);
  const allowed = { md: "Markdown", json: "JSON", html: "HTML" };
  if (!request || !allowed[request.format] || typeof request.content !== "string" || Buffer.byteLength(request.content) > 20 * 1024 * 1024) throw new Error("Invalid export");
  const basename = String(request.filename || "page").replace(/[\\/:*?"<>|]/g, "-").slice(0, 100);
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `${basename}.${request.format}`, filters: [{ name: allowed[request.format], extensions: [request.format] }] });
  if (result.canceled || !result.filePath) return { canceled: true };
  let content = request.content;
  if (request.format !== "json") {
    const ids = [...new Set(Array.from(content.matchAll(/\/api\/attachments\/([a-f0-9-]{36}\.(?:png|jpe?g|gif|webp))/gi), match => match[1]))];
    if (ids.length) {
      const assetsName = `${path.parse(result.filePath).name}-assets`;
      const assetsDir = path.join(path.dirname(result.filePath), assetsName);
      await fs.promises.mkdir(assetsDir, { recursive: true });
      for (const id of ids) {
        await fs.promises.copyFile(path.join(app.getPath("userData"), "attachments", id), path.join(assetsDir, id));
        content = content.replaceAll(`/api/attachments/${id}`, `${assetsName}/${id}`);
      }
    }
  }
  await fs.promises.writeFile(result.filePath, content, "utf8");
  return { canceled: false };
});
ipcMain.handle("desktop:import-markdown", async (event) => {
  trusted(event);
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openFile", "multiSelections"], filters: [{ name: "Markdown", extensions: ["md", "markdown"] }] });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(async (filePath) => {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > 10 * 1024 * 1024) throw new Error("Markdown file exceeds 10 MB");
    let content = await fs.promises.readFile(filePath, "utf8");
    const base = path.dirname(filePath);
    const directory = path.join(app.getPath("userData"), "attachments");
    await fs.promises.mkdir(directory, { recursive: true });
    for (const match of content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      const reference = match[2];
      if (/^[a-z]+:/i.test(reference) || reference.startsWith("/")) continue;
      const source = path.resolve(base, decodeURIComponent(reference));
      if (!source.startsWith(base + path.sep)) continue;
      const extension = path.extname(source).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extension)) continue;
      const imageStat = await fs.promises.stat(source).catch(() => null);
      if (!imageStat || imageStat.size > 20 * 1024 * 1024) continue;
      const id = `${crypto.randomUUID()}${extension}`;
      await fs.promises.copyFile(source, path.join(directory, id));
      content = content.replace(match[0], `![${match[1]}](/api/attachments/${id})`);
    }
    return { name: path.basename(filePath), content };
  }));
});
ipcMain.handle("desktop:pick-attachment", async (event) => {
  trusted(event);
  const result = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }] });
  if (result.canceled) return null;
  const source = result.filePaths[0];
  const stat = await fs.promises.stat(source);
  if (stat.size > 20 * 1024 * 1024) throw new Error("Image exceeds 20 MB");
  const extension = path.extname(source).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extension)) throw new Error("Unsupported image");
  const id = `${crypto.randomUUID()}${extension}`;
  const directory = path.join(app.getPath("userData"), "attachments");
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.copyFile(source, path.join(directory, id));
  return { url: `/api/attachments/${id}`, name: path.basename(source) };
});

function fetchSnapshot() {
  return new Promise((resolve, reject) => {
    http.get(`${startUrl}/api/backup`, { headers: { "x-internal-secret": internalSecret } }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error("Database snapshot failed")); return; }
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    }).on("error", reject);
  });
}
ipcMain.handle("desktop:create-backup", async (event) => {
  trusted(event);
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `Notion-Lite-${new Date().toISOString().slice(0, 10)}.zip`, filters: [{ name: "Notion Lite Backup", extensions: ["zip"] }] });
  if (result.canceled || !result.filePath) return { canceled: true };
  const zip = new AdmZip();
  const database = await fetchSnapshot();
  zip.addFile("workspace.db", database);
  const attachments = path.join(app.getPath("userData"), "attachments");
  if (fs.existsSync(attachments)) zip.addLocalFolder(attachments, "attachments");
  zip.addFile("manifest.json", Buffer.from(JSON.stringify({ format: "notionlite-backup", version: 1, createdAt: new Date().toISOString(), databaseSha256: crypto.createHash("sha256").update(database).digest("hex") })));
  const temporary = `${result.filePath}.partial`;
  zip.writeZip(temporary);
  await fs.promises.rename(temporary, result.filePath);
  return { canceled: false, path: result.filePath };
});
ipcMain.handle("desktop:restore-backup", async (event) => {
  trusted(event);
  const selected = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"], filters: [{ name: "Notion Lite Backup", extensions: ["zip"] }] });
  if (selected.canceled) return { canceled: true };
  const zip = new AdmZip(selected.filePaths[0]);
  const manifestEntry = zip.getEntry("manifest.json");
  const databaseEntry = zip.getEntry("workspace.db");
  if (!manifestEntry || !databaseEntry) throw new Error("Backup is incomplete");
  const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
  if (manifest.format !== "notionlite-backup" || manifest.version !== 1 || databaseEntry.header.size > 2 * 1024 * 1024 * 1024) throw new Error("Unsupported backup");
  const bytes = databaseEntry.getData();
  if (bytes.subarray(0, 16).toString("utf8") !== "SQLite format 3\0") throw new Error("Backup database is invalid");
  if (manifest.databaseSha256 && crypto.createHash("sha256").update(bytes).digest("hex") !== manifest.databaseSha256) throw new Error("Backup database checksum failed");
  const attachmentEntries = zip.getEntries().filter(entry => entry.entryName.startsWith("attachments/") && !entry.isDirectory);
  if (attachmentEntries.length > 10000) throw new Error("Backup has too many attachments");
  for (const entry of attachmentEntries) {
    if (!/^attachments\/[a-f0-9-]{36}\.(png|jpe?g|gif|webp)$/i.test(entry.entryName) || entry.header.size > 20 * 1024 * 1024) throw new Error("Backup contains an invalid attachment");
  }
  const choice = await dialog.showMessageBox(mainWindow, { type: "warning", buttons: ["Cancel", "Replace workspace"], defaultId: 0, cancelId: 0, title: "Restore backup", message: "Replace the current workspace with this backup?", detail: "Notion Lite will save a rollback copy and restart." });
  if (choice.response !== 1) return { canceled: true };
  const userData = app.getPath("userData");
  const db = path.join(userData, "notionlite.db");
  const attachments = path.join(userData, "attachments");
  const rollback = path.join(userData, `rollback-${Date.now()}`);
  await fs.promises.mkdir(rollback, { recursive: true });
  if (serverProcess) { serverProcess.kill(); await new Promise(resolve => { if (serverProcess.exitCode !== null) resolve(); else { serverProcess.once("exit", resolve); setTimeout(resolve, 5000); } }); }
  try {
    for (const suffix of ["", "-wal", "-shm"]) if (fs.existsSync(db + suffix)) await fs.promises.rename(db + suffix, path.join(rollback, `notionlite.db${suffix}`));
    if (fs.existsSync(attachments)) await fs.promises.rename(attachments, path.join(rollback, "attachments"));
    await fs.promises.writeFile(db, bytes);
    await fs.promises.mkdir(attachments, { recursive: true });
    for (const entry of attachmentEntries) await fs.promises.writeFile(path.join(attachments, path.basename(entry.entryName)), entry.getData());
    isQuitting = true; app.relaunch(); app.exit(0);
    return { canceled: false };
  } catch (error) {
    for (const suffix of ["", "-wal", "-shm"]) {
      const source = path.join(rollback, `notionlite.db${suffix}`);
      if (fs.existsSync(source)) await fs.promises.copyFile(source, db + suffix);
    }
    if (fs.existsSync(path.join(rollback, "attachments"))) await fs.promises.rename(path.join(rollback, "attachments"), attachments);
    startNextServer(() => mainWindow?.loadURL(startUrl));
    throw error;
  }
});

const aiProviders = ["gemini", "openai", "anthropic", "openrouter", "opencode", "nvidia"];
async function aiStatus() {
  const keytar = require("keytar");
  const configured = {};
  for (const provider of aiProviders) configured[provider] = Boolean(await keytar.getPassword("Notion Lite", provider));
  return { provider: settings.aiProvider || "gemini", model: settings.aiModel || "", configured };
}
ipcMain.handle("desktop:get-ai-settings", async event => { trusted(event); return aiStatus(); });
ipcMain.handle("desktop:set-ai-settings", async (event, value) => {
  trusted(event);
  if (!value || !aiProviders.includes(value.provider)) throw new Error("Unsupported AI provider");
  const keytar = require("keytar");
  if (typeof value.key === "string" && value.key.trim()) await keytar.setPassword("Notion Lite", value.provider, value.key.trim());
  if (value.removeKey === true) await keytar.deletePassword("Notion Lite", value.provider);
  settings.aiProvider = value.provider;
  settings.aiModel = String(value.model || "").trim().slice(0, 120);
  persistSettings();
  const previousServer = serverProcess;
  if (previousServer) {
    previousServer.kill();
    await new Promise(resolve => {
      if (previousServer.exitCode !== null) return resolve();
      previousServer.once("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
  startNextServer(() => mainWindow?.loadURL(startUrl));
  return aiStatus();
});

// Enforce single instance lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      showWindow();
    }
  });
}

// Find an open port starting from 3000
function getAvailablePort(startPort, callback) {
  const server = net.createServer();
  server.unref();
  server.on('error', () => {
    getAvailablePort(startPort + 1, callback);
  });
  server.listen(startPort, '127.0.0.1', () => {
    server.close(() => {
      callback(startPort);
    });
  });
}

// Check if server is responding with 200 OK
function isServerRunning(port, callback) {
  const req = http.get(`http://127.0.0.1:${port}/api/workspace`, {
    headers: { 'x-internal-secret': internalSecret }
  }, (res) => {
    if (res.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
  });
  req.on("error", () => {
    callback(false);
  });
  req.setTimeout(400, () => {
    req.abort();
    callback(false);
  });
}

function startNextServer(callback) {
  getAvailablePort(3000, async (availablePort) => {
    PORT = availablePort;
    startUrl = `http://127.0.0.1:${PORT}`;

    const isDev = !app.isPackaged;
    const projectRoot = path.join(__dirname, "..");
    const env = { 
      ...process.env, 
      PORT: String(PORT), 
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      INTERNAL_SECRET: internalSecret,
      ATTACHMENTS_DIR: path.join(app.getPath("userData"), "attachments"),
      NOTIONLITE_DATA_DIR: app.getPath("userData")
    };
    try {
      const keytar = require("keytar");
      for (const provider of aiProviders) {
        const key = await keytar.getPassword("Notion Lite", provider);
        if (key) env[`NL_AI_KEY_${provider.toUpperCase()}`] = key;
      }
    } catch (error) { logError("credential loading", error); }

    let called = false;
    const done = () => {
      if (!called) {
        called = true;
        callback();
      }
    };

    if (isDev) {
      const isWin = process.platform === "win32";
      const npmCmd = isWin ? "npm.cmd" : "npm";

      serverProcess = spawn(npmCmd, ["run", "dev", "--", "-p", String(PORT)], {
        cwd: projectRoot,
        env: { ...env, NODE_ENV: "development" },
        stdio: "pipe",
        shell: true,
      });
    } else {
      const userDataDir = app.getPath("userData");
      const dbPath = path.join(userDataDir, "notionlite.db");
      const standaloneRoot = path.join(process.resourcesPath, "standalone");
      const templateDb = path.join(standaloneRoot, "prisma/template.db");

      // Ensure userData directory exists and copy template DB if needed
      try {
        fs.mkdirSync(userDataDir, { recursive: true });
        if (!fs.existsSync(dbPath) && fs.existsSync(templateDb)) {
          fs.copyFileSync(templateDb, dbPath);
          console.log("Database initialized at:", dbPath);
        }
      } catch (err) {
        console.error("Database initialization error:", err);
      }

      env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
      env.ELECTRON_RUN_AS_NODE = "1";

      const serverPath = path.join(standaloneRoot, "server.js");
      serverProcess = fork(serverPath, [], {
        cwd: standaloneRoot,
        env,
        stdio: "pipe",
      });
    }

    serverProcess.stdout.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Ready in") || msg.includes("started server on") || msg.includes("http://")) {
        done();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`Next.js: ${data}`);
    });

    // High-frequency polling (100ms) for ultra-fast startup detection
    const pollInterval = setInterval(() => {
      isServerRunning(PORT, (isReady) => {
        if (isReady) {
          clearInterval(pollInterval);
          done();
        }
      });
    }, 100);

    // Hard fallback timeout
    setTimeout(() => {
      clearInterval(pollInterval);
      done();
    }, 3000);
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, "icon.png");
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      tray = new Tray(icon.resize({ width: 16, height: 16 }));
      tray.setToolTip("Notion Lite");

      const contextMenu = Menu.buildFromTemplate([
        {
          label: "Show Notion Lite",
          click: () => {
            if (mainWindow) {
              showWindow();
            }
          },
        },
        {
          label: "New Page",
          click: () => {
            showWindow("new-page");
          },
        },
        { type: "separator" },
        { label: "Search", click: () => showWindow("search") },
        { label: "Trash", click: () => showWindow("trash") },
        { label: "Hide", click: () => mainWindow?.hide() },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);

      tray.setContextMenu(contextMenu);
      tray.on("double-click", () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.focus();
          } else {
            mainWindow.show();
          }
        }
      });
    }
  } catch (err) {
    console.error("Failed to create tray icon:", err);
  }
}

function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const iconPath = path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: "Notion Lite",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: "#191919",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      v8CacheOptions: "code"
    },
    show: true,
  });

  const loadApp = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.loadURL(startUrl).catch(() => {
      setTimeout(loadApp, 400);
    });
  };

  loadApp();

  mainWindow.webContents.on("did-fail-load", () => {
    setTimeout(loadApp, 400);
  });
  mainWindow.webContents.on("did-start-loading", () => { rendererReady = false; });

  mainWindow.show();
  mainWindow.focus();

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${startUrl}/site/`) || url.startsWith("https:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(startUrl + "/") && url !== startUrl) event.preventDefault();
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => logError("renderer", details.reason));

  mainWindow.on("close", (event) => {
    if (!isQuitting && settings.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  createAppMenu();
}

function createAppMenu() {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Page",
          accelerator: "CmdOrCtrl+N",
          click: () => showWindow("new-page"),
        },
        { label: "Search", accelerator: "CmdOrCtrl+K", click: () => showWindow("search") },
        { label: "Trash", click: () => showWindow("trash") },
        { label: "Export Page...", accelerator: "CmdOrCtrl+Shift+E", click: () => showWindow("export") },
        { label: "Settings...", click: () => showWindow("settings") },
        { label: "Hide to Tray", click: () => mainWindow?.hide() },
        { type: "separator" },
        {
          label: "Exit Notion Lite",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
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
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Project on GitHub",
          click: async () => {
            await shell.openExternal("https://github.com/mikeperac-cyber/notion-lite");
          },
        },
        { label: "About Notion Lite", click: () => dialog.showMessageBox(mainWindow, { type: "info", title: "About Notion Lite", message: `Notion Lite ${app.getVersion()}`, detail: "A local Windows workspace." }) },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  loadSettings();
  ensureDesktopShortcut();
  setShortcut();
  createTray();
  startNextServer(() => {
    createWindow();
    if (app.isPackaged) setTimeout(() => autoUpdater.checkForUpdates().catch(error => logError("update", error)), 10000);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function cleanupServer() {
  if (serverProcess) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"]);
      } else {
        serverProcess.kill();
      }
    } catch (e) {}
  }
}

app.on("before-quit", () => {
  globalShortcut.unregisterAll();
  cleanupServer();
});

app.on("window-all-closed", () => {
  cleanupServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
