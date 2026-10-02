import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222/json";
const targets = await fetch(endpoint).then(response => response.json());
const target = (Array.isArray(targets) ? targets : [targets]).find(item => item.type === "page" && item.url.includes("127.0.0.1"));
assert(target?.webSocketDebuggerUrl, "Notion Lite renderer was not exposed through Chromium DevTools");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const runtimeErrors = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails?.text || "Runtime exception");
  if (message.method === "Log.entryAdded" && message.params.entry?.level === "error") runtimeErrors.push(message.params.entry.text);
});

function call(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Evaluation failed");
  return result.result.value;
}

async function waitFor(expression, label, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const context = await evaluate("JSON.stringify({ path: location.pathname, buttons: [...document.querySelectorAll('button')].map(node => node.textContent.trim()).filter(Boolean).slice(-20), selects: [...document.querySelectorAll('select')].map(node => node.getAttribute('aria-label')) })");
  const tabs = await evaluate("JSON.stringify([...document.querySelectorAll('[role=\"tab\"]')].map(node => ({ text: node.textContent.trim(), selected: node.getAttribute('aria-selected'), cls: node.className })))");
  const dialogs = await evaluate("JSON.stringify([...document.querySelectorAll('[role=\"dialog\"]')].map(node => ({ text: node.textContent.trim().slice(0, 80), state: node.getAttribute('data-state'), hidden: node.getAttribute('aria-hidden'), display: getComputedStyle(node).display })))");
  throw new Error(`Timed out waiting for ${label}: ${context}; tabs=${tabs}; dialogs=${dialogs}`);
}

async function click(expression, label) {
  const point = await evaluate(`(() => {
    const element = ${expression};
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert(point, `${label} was not found`);
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function pressKey(key, code, text = "") {
  await call("Input.dispatchKeyEvent", { type: "keyDown", key, code, text });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key, code });
}

await call("Runtime.enable");
await call("Log.enable");
try {
  await call("Page.reload", { ignoreCache: true });
  await waitFor("document.readyState === 'complete'", "renderer reload");
  assert.match(await evaluate("document.title"), /Notion Lite/);
  assert(await evaluate("Boolean(document.querySelector('a[href=\"/today\"]'))"), "Today navigation is missing");

  await click("document.querySelector('a[href=\"/today\"]')", "Today navigation");
  await waitFor("location.pathname === '/today' && document.querySelector('h1')?.textContent === 'Today'", "Today page");
  const filters = await evaluate("[...document.querySelectorAll('[role=\"tab\"]')].map(node => node.textContent.trim())");
  assert(filters.includes("Today & unscheduled") && filters.includes("Overdue") && filters.includes("Upcoming") && filters.includes("Completed"), "Today filters are missing");

  await click("[...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Overdue')", "Overdue filter");
  if (!await evaluate("[...document.querySelectorAll('button')].some(node => node.textContent.trim() === 'Overdue' && node.getAttribute('aria-selected') === 'true')")) {
    await evaluate("[...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Overdue')?.click(); true");
  }
  await waitFor("[...document.querySelectorAll('button')].some(node => node.textContent.trim() === 'Overdue' && node.getAttribute('aria-selected') === 'true')", "Overdue filter selection");

  await click("[...document.querySelectorAll('button')].find(node => node.textContent.includes('Workspace AI'))", "Workspace AI");
  if (!await evaluate("Boolean(document.querySelector('select[aria-label=\"AI context scope\"]'))")) {
    await evaluate("[...document.querySelectorAll('button')].find(node => node.textContent.includes('Workspace AI'))?.click(); true");
  }
  await waitFor("Boolean(document.querySelector('select[aria-label=\"AI context scope\"]'))", "Workspace AI drawer");
  assert(["none", "current", "workspace"].includes(await evaluate("document.querySelector('select[aria-label=\"AI context scope\"]')?.value")), "AI context scope has an invalid value");
  await click("document.querySelector('button[title=\"Close\"]')", "Workspace AI close button");
  if (await evaluate("Boolean(document.querySelector('select[aria-label=\"AI context scope\"]'))")) {
    await evaluate("document.querySelector('button[title=\"Close\"]')?.click(); true");
  }
  await waitFor("!document.querySelector('select[aria-label=\"AI context scope\"]')", "Workspace AI drawer to close");

  await click("document.querySelector('button[title=\"AI Settings\"]')", "AI settings");
  if (!await evaluate("[...document.querySelectorAll('[role=\"dialog\"]')].some(dialog => dialog.textContent.includes('AI Settings') && dialog.getAttribute('data-state') === 'open')")) {
    await evaluate("document.querySelector('button[title=\"AI Settings\"]')?.click(); true");
  }
  await waitFor("[...document.querySelectorAll('[role=\"dialog\"]')].some(node => node.textContent.includes('AI Settings') && node.getAttribute('data-state') === 'open')", "AI settings dialog");
  assert.equal(await evaluate("[...document.querySelectorAll('[role=\"dialog\"]')].find(dialog => dialog.textContent.includes('AI Settings') && dialog.getAttribute('data-state') === 'open')?.querySelector('input[type=\"password\"]')?.disabled || false"), false, "Desktop AI key input should be enabled");
  await click("[...document.querySelectorAll('[role=\"dialog\"]')].find(dialog => dialog.textContent.includes('AI Settings') && dialog.getAttribute('data-state') === 'open')?.querySelector('button:not([aria-label=\"Close\"])')", "AI settings close button");
  if (await evaluate("[...document.querySelectorAll('[role=\"dialog\"]')].some(dialog => dialog.textContent.includes('AI Settings') && dialog.getAttribute('data-state') === 'open')")) {
    await evaluate("[...document.querySelectorAll('[role=\"dialog\"]')].find(dialog => dialog.textContent.includes('AI Settings') && dialog.getAttribute('data-state') === 'open')?.querySelector('button:not([aria-label=\"Close\"])')?.click(); true");
  }
  if (await evaluate("[...document.querySelectorAll('[role=\"dialog\"]')].some(dialog => dialog.textContent.includes('AI Settings') && dialog.getAttribute('data-state') === 'open')")) {
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  }
  await waitFor("![...document.querySelectorAll('[role=\"dialog\"]')].some(dialog => dialog.textContent.includes('AI Settings') && dialog.getAttribute('data-state') === 'open')", "AI settings dialog to close");

  const editorHref = await evaluate("document.querySelector('a[href^=\"/editor/\"]')?.getAttribute('href')");
  assert(editorHref, "No workspace page link is available");
  await click("document.querySelector('a[href^=\"/editor/\"]')", "workspace page");
  if (!await evaluate("location.pathname.startsWith('/editor/')")) {
    await evaluate("document.querySelector('a[href^=\"/editor/\"]')?.click(); true");
  }
  await waitFor("location.pathname.startsWith('/editor/') && Boolean(document.querySelector('.ProseMirror'))", "editor page");
  assert.match(await evaluate("document.querySelector('[role=\"status\"]')?.textContent || ''"), /Saved|Saving/);

  await evaluate("document.querySelector('.ProseMirror')?.focus(); true");
  await pressKey("/", "Slash", "/");
  await waitFor("Boolean(document.querySelector('[data-slash-command-list]'))", "slash command list");
  const paletteBefore = await evaluate("(() => { const list = document.querySelector('[data-slash-command-list]'); return { scrollTop: list.scrollTop, clientHeight: list.clientHeight, scrollHeight: list.scrollHeight }; })()");
  assert(paletteBefore.scrollHeight > paletteBefore.clientHeight, "Slash command list is not scrollable");
  for (let index = 0; index < 10; index++) await pressKey("ArrowDown", "ArrowDown");
  const paletteAfter = await evaluate("(() => { const list = document.querySelector('[data-slash-command-list]'); return { scrollTop: list.scrollTop, selected: list.querySelector('[aria-selected=\"true\"]')?.textContent.trim() }; })()");
  assert(paletteAfter.scrollTop > paletteBefore.scrollTop, `Arrow navigation did not scroll the slash command list: ${JSON.stringify({ paletteBefore, paletteAfter })}`);
  await pressKey("PageDown", "PageDown");
  assert(await evaluate("Boolean(document.querySelector('[data-slash-command-list] [aria-selected=\"true\"]'))"), "PageDown did not keep a command selected");
  await pressKey("Escape", "Escape");

  await new Promise(resolve => setTimeout(resolve, 500));
  assert.deepEqual(runtimeErrors, [], `Renderer errors: ${runtimeErrors.join("; ")}`);
  console.log("Installed UI click-through passed: Today filters, Workspace AI, AI settings, and editor navigation");
} finally {
  socket.close();
}
