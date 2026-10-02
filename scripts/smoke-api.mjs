import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "notionlite-smoke-"));
const dbPath = path.join(temp, "workspace.db");
const port = 4197;
const secret = "smoke-test-secret";
await fs.copyFile(process.env.SMOKE_DATABASE_TEMPLATE || path.join(standalone, "prisma", "template.db"), dbPath);
const server = spawn(process.execPath, [path.join(standalone, "server.js")], {
  cwd: standalone, windowsHide: true,
  env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production", DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`, ATTACHMENTS_DIR: path.join(temp, "attachments"), NOTIONLITE_DATA_DIR: temp, INTERNAL_SECRET: secret },
  stdio: "pipe",
});
let errors = "";
server.stderr.on("data", chunk => { errors += chunk.toString(); });
const base = `http://127.0.0.1:${port}`;
async function request(route, method = "GET", data) {
  const response = await fetch(`${base}${route}`, { method, headers: { "x-internal-secret": secret, ...(data ? { "Content-Type": "application/json" } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${await response.text()}`);
  return response;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await request("/api/workspace"); ready = true; break; }
    catch { if (server.exitCode !== null) throw new Error(`Server exited: ${errors}`); await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  assert(ready, `Server did not start: ${errors}`);
  const migrationBackups = await fs.readdir(path.join(temp, "pre-migration"));
  assert.equal(migrationBackups.length, 1);
  assert.equal((await fs.readFile(path.join(temp, "pre-migration", migrationBackups[0]))).subarray(0, 16).toString(), "SQLite format 3\0");
  const created = await (await request("/api/pages", "POST", { title: "Unique Search Fixture" })).json();
  assert(created.id);
  const page = await (await request(`/api/pages/${created.id}`)).json();
  const headingId = crypto.randomUUID();
  const saved = await (await request("/api/blocks", "POST", { pageId: created.id, deletedBlockIds: page.blocks.map(block => block.id), changedBlocks: [{ id: headingId, type: "heading_1", order: 0, content: { node: { type: "heading", attrs: { level: 1, id: headingId }, content: [{ type: "text", text: "Asterism fixture" }] } } }] })).json();
  assert(saved.success);
  const loaded = await (await request(`/api/pages/${created.id}`)).json();
  assert.equal(loaded.blocks[0].content.node.content[0].text, "Asterism fixture");
  const search = await (await request("/api/search?q=Asterism")).json();
  assert(search.results.some(result => result.pageId === created.id));
  const aiContext = await (await request(`/api/ai?scope=current&pageId=${created.id}&q=Asterism`)).json();
  assert(aiContext.sources.some(source => source.id === created.id));
  assert.match(aiContext.preview, /Asterism fixture/);
  const history = await (await request(`/api/pages/${created.id}/history`)).json();
  assert(history.snapshots.length > 0);
  const restore = await (await request(`/api/pages/${created.id}/history`, "POST", { snapshotId: history.snapshots[0].id })).json();
  assert(restore.success);
  const restoredPage = await (await request(`/api/pages/${created.id}`)).json();
  assert.equal(restoredPage.title, "Unique Search Fixture");
  assert(!restoredPage.blocks.some(block => block.content?.text === "Asterism fixture"));
  const undoHistory = await (await request(`/api/pages/${created.id}/history`)).json();
  assert(undoHistory.snapshots.length > history.snapshots.length);
  const noKey = await fetch(`${base}/api/ai`, { method: "POST", headers: { "x-internal-secret": secret, "Content-Type": "application/json" }, body: JSON.stringify({ mode: "summarize", contextText: "Test" }) });
  assert.equal(noKey.status, 409);
  const noContext = await (await request("/api/ai?scope=none&q=test")).json();
  assert.deepEqual(noContext.sources, []);
  const taskId = crypto.randomUUID();
  const dueAt = new Date(Date.now() - 60_000).toISOString();
  await request(`/api/pages/${created.id}/meta`, "PATCH", { tags: ["Reference", "Personal"], tasks: [{ id: taskId, title: "Review note", dueAt, completed: false, notified: false }] });
  const tags = await (await request("/api/tags")).json();
  assert(tags.tags.includes("Reference"));
  const due = await (await request("/api/reminders/due")).json();
  assert(due.due.some(task => task.taskId === taskId));
  await request("/api/reminders/due", "POST", { pageId: created.id, taskId });
  const afterNotice = await (await request("/api/reminders/due")).json();
  assert(!afterNotice.due.some(task => task.taskId === taskId));
  const taskInbox = await (await request("/api/tasks")).json();
  assert(taskInbox.tasks.some(task => task.taskId === taskId && !task.completed));
  const aiTasks = await (await request("/api/ai?scope=workspace&q=active%20tasks")).json();
  assert.match(aiTasks.preview, /Review note/);
  assert(aiTasks.sources.some(source => source.id === created.id));
  await request("/api/tasks", "PATCH", { pageId: created.id, taskId, action: "snooze" });
  const snoozed = await (await request(`/api/pages/${created.id}/meta`)).json();
  assert(Date.parse(snoozed.tasks[0].dueAt) > Date.now());
  assert.equal(snoozed.tasks[0].notified, false);
  await request("/api/tasks", "PATCH", { pageId: created.id, taskId, action: "complete" });
  const completed = await (await request("/api/tasks")).json();
  assert(completed.tasks.some(task => task.taskId === taskId && task.completed));

  const linkingPage = await (await request("/api/pages", "POST", { title: "Link source" })).json();
  const linkBlockId = crypto.randomUUID();
  const linkedNode = { type: "paragraph", attrs: { id: linkBlockId }, content: [{ type: "text", text: "Unique Search Fixture", marks: [{ type: "link", attrs: { href: `/editor/${created.id}` } }] }] };
  await request("/api/blocks", "POST", { pageId: linkingPage.id, changedBlocks: [{ id: linkBlockId, type: "paragraph", order: 0, content: { text: "Unique Search Fixture", node: linkedNode } }] });
  const backlinks = await (await request(`/api/pages/${created.id}/backlinks`)).json();
  assert(backlinks.pages.some(page => page.id === linkingPage.id));
  await request(`/api/pages/${linkingPage.id}`, "PATCH", { parentId: created.id });
  const cycle = await fetch(`${base}/api/pages/${created.id}`, { method: "PATCH", headers: { "x-internal-secret": secret, "Content-Type": "application/json" }, body: JSON.stringify({ parentId: linkingPage.id }) });
  assert.equal(cycle.status, 400);
  await request(`/api/pages/${linkingPage.id}`, "DELETE");
  const trash = await (await request("/api/trash")).json();
  assert(trash.pages.some(page => page.id === linkingPage.id));
  const backup = await (await request("/api/backup")).arrayBuffer();
  assert.equal(Buffer.from(backup).subarray(0, 16).toString(), "SQLite format 3\0");
  const attachmentId = `${crypto.randomUUID()}.png`;
  const attachmentBytes = Buffer.from("89504e470d0a1a0a0000000049454e44ae426082", "hex");
  await fs.mkdir(path.join(temp, "attachments"), { recursive: true });
  await fs.writeFile(path.join(temp, "attachments", attachmentId), attachmentBytes);
  const attachment = await (await request(`/api/attachments/${attachmentId}`)).arrayBuffer();
  assert.deepEqual(Buffer.from(attachment), attachmentBytes);
  const archive = new AdmZip();
  archive.addFile("workspace.db", Buffer.from(backup));
  archive.addFile(`attachments/${attachmentId}`, attachmentBytes);
  archive.addFile("manifest.json", Buffer.from(JSON.stringify({ format: "notionlite-backup", version: 1, databaseSha256: crypto.createHash("sha256").update(Buffer.from(backup)).digest("hex") })));
  const restored = new AdmZip(archive.toBuffer());
  assert.deepEqual(restored.getEntry("workspace.db").getData(), Buffer.from(backup));
  assert.deepEqual(restored.getEntry(`attachments/${attachmentId}`).getData(), attachmentBytes);

  const source = await (await request("/api/pages", "POST", { title: "Source DB", isDatabase: true })).json();
  const target = await (await request("/api/pages", "POST", { title: "Target DB", isDatabase: true })).json();
  const targetRow = await (await request(`/api/databases/${target.database.id}/rows`, "POST", { properties: {} })).json();
  const sourceRow = await (await request(`/api/databases/${source.database.id}/rows`, "POST", { properties: {} })).json();
  const relation = await (await request(`/api/databases/${source.database.id}/properties`, "POST", { name: "Links", type: "relation", config: { relationDatabaseId: target.database.id } })).json();
  await request(`/api/databases/${source.database.id}/rows`, "PATCH", { rowId: sourceRow.id, properties: { [relation.id]: [targetRow.id] } });
  const rollup = await (await request(`/api/databases/${source.database.id}/properties`, "POST", { name: "Count", type: "rollup", config: { rollupRelationPropId: relation.id, rollupTargetPropId: target.database.properties[0].id, rollupFunction: "count_all" } })).json();
  const value = await (await request(`/api/databases/${source.database.id}/rollup?rowId=${sourceRow.id}&propertyId=${rollup.id}`)).json();
  assert.equal(value.value, 1);
  console.log("API smoke passed: rich save, FTS, history restore, backup and attachments, links, tags, tasks, reminders, notebook cycles, trash, relation, rollup, AI context preview and unconfigured state");
} finally {
  server.kill();
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else { server.once("exit", resolve); setTimeout(resolve, 5000); } });
  await fs.rm(temp, { recursive: true, force: true });
}
