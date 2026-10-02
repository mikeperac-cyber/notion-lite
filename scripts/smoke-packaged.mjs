import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

if (process.platform !== "win32") throw new Error("Packaged smoke test requires Windows");
const root = path.resolve(import.meta.dirname, "..");
const unpacked = path.join(root, "dist-electron", "win-unpacked");
const executable = path.join(unpacked, "Notion Lite.exe");
const standalone = path.join(unpacked, "resources", "standalone");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "notionlite-packaged-smoke-"));
const db = path.join(temp, "workspace.db");
const secret = "packaged-smoke-secret";
const port = await new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const address = listener.address();
    listener.close(() => resolve(address.port));
  });
});
await fs.copyFile(path.join(standalone, "prisma", "template.db"), db);
const server = spawn(executable, [path.join(standalone, "server.js")], {
  cwd: standalone,
  windowsHide: true,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    DATABASE_URL: `file:${db.replace(/\\/g, "/")}`,
    ATTACHMENTS_DIR: path.join(temp, "attachments"),
    NOTIONLITE_DATA_DIR: temp,
    INTERNAL_SECRET: secret,
  },
  stdio: "pipe",
});
let stderr = "";
server.stderr.on("data", chunk => { stderr += chunk.toString(); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Packaged server exited: ${stderr}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/workspace`, { headers: { "x-internal-secret": secret } });
      if (response.ok) {
        const body = await response.json();
        assert(body.workspace);
        ready = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(ready, `Packaged server did not become ready: ${stderr}`);
  console.log("Packaged Electron server smoke passed");
} finally {
  server.kill();
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else { server.once("exit", resolve); setTimeout(resolve, 5000); } });
  await fs.rm(temp, { recursive: true, force: true });
}
