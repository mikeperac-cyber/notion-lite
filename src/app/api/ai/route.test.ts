import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { page: { findMany } } }));

import { POST } from "./route";

let dir: string;
const fetchMock = vi.fn();

const writeSettings = (settings: unknown) => fs.writeFile(path.join(dir, "settings.json"), JSON.stringify(settings));
const reply = (payload: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status }));
const call = (body: Record<string, unknown>) =>
  POST(new Request("http://localhost/api/ai", { method: "POST", body: JSON.stringify(body) }));
const sent = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: String(url), headers: init.headers as Record<string, string>, body: JSON.parse(init.body) };
};
const chatReply = (content: string) => ({ choices: [{ message: { content } }] });

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "nl-ai-"));
  process.env.NOTIONLITE_DATA_DIR = dir;
  for (const key of Object.keys(process.env)) if (key.startsWith("NL_AI_KEY_")) delete process.env[key];
  fetchMock.mockReset();
  findMany.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.NOTIONLITE_DATA_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

describe("/api/ai configuration", () => {
  it("asks for a key when none is configured", async () => {
    await writeSettings({ aiProvider: "openai", aiModel: "gpt-4o-mini" });
    const res = await call({ mode: "summarize", contextText: "hello" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for a model when a key exists but no model is set", async () => {
    await writeSettings({ aiProvider: "openai", aiKeys: { openai: "k" } });
    const res = await call({ mode: "summarize", contextText: "hello" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("model_required");
  });

  it("rejects empty text", async () => {
    await writeSettings({ aiProvider: "openai", aiModel: "m", aiKeys: { openai: "k" } });
    const res = await call({ mode: "summarize", contextText: "   " });
    expect(res.status).toBe(400);
  });

  it("falls back to the environment key when none is saved", async () => {
    await writeSettings({ aiProvider: "openai", aiModel: "m" });
    process.env.NL_AI_KEY_OPENAI = "env-key";
    reply(chatReply("ok"));
    await call({ mode: "summarize", contextText: "hello" });
    expect(sent().headers.Authorization).toBe("Bearer env-key");
  });

  it("prefers the saved key over the environment key", async () => {
    await writeSettings({ aiProvider: "openai", aiModel: "m", aiKeys: { openai: "saved-key" } });
    process.env.NL_AI_KEY_OPENAI = "env-key";
    reply(chatReply("ok"));
    await call({ mode: "summarize", contextText: "hello" });
    expect(sent().headers.Authorization).toBe("Bearer saved-key");
  });
});

describe("/api/ai providers", () => {
  it("calls Gemini with the model in the URL and the key in a header", async () => {
    await writeSettings({ aiProvider: "gemini", aiModel: "gemini-1.5-flash", aiKeys: { gemini: "gk" } });
    reply({ candidates: [{ content: { parts: [{ text: "Hel" }, { text: "lo" }] } }] });
    const res = await call({ mode: "summarize", contextText: "text" });
    expect((await res.json()).result).toBe("Hello");
    expect(sent().url).toContain("/models/gemini-1.5-flash:generateContent");
    expect(sent().url).not.toContain("gk");
    expect(sent().headers["x-goog-api-key"]).toBe("gk");
  });

  it("calls Anthropic with its own auth headers", async () => {
    await writeSettings({ aiProvider: "anthropic", aiModel: "claude-x", aiKeys: { anthropic: "ak" } });
    reply({ content: [{ text: "Hi" }, { text: " there" }] });
    const res = await call({ mode: "make_shorter", contextText: "text" });
    expect((await res.json()).result).toBe("Hi there");
    expect(sent().url).toBe("https://api.anthropic.com/v1/messages");
    expect(sent().headers["x-api-key"]).toBe("ak");
    expect(sent().headers["anthropic-version"]).toBe("2023-06-01");
    expect(sent().body.model).toBe("claude-x");
  });

  it.each([
    ["openai", "https://api.openai.com/v1/chat/completions"],
    ["openrouter", "https://openrouter.ai/api/v1/chat/completions"],
    ["nvidia", "https://integrate.api.nvidia.com/v1/chat/completions"],
  ])("routes %s through its chat completions endpoint", async (provider, url) => {
    await writeSettings({ aiProvider: provider, aiModel: "vendor/model", aiKeys: { [provider]: "bk" } });
    reply(chatReply("done"));
    const res = await call({ mode: "make_longer", contextText: "text" });
    expect((await res.json()).result).toBe("done");
    expect(sent().url).toBe(url);
    expect(sent().headers.Authorization).toBe("Bearer bk");
    expect(sent().body.model).toBe("vendor/model");
  });

  it("sends opencode gpt models to the responses endpoint", async () => {
    await writeSettings({ aiProvider: "opencode", aiModel: "gpt-5", aiKeys: { opencode: "ok" } });
    reply({ output_text: "from responses" });
    const res = await call({ mode: "summarize", contextText: "text" });
    expect((await res.json()).result).toBe("from responses");
    expect(sent().url).toBe("https://opencode.ai/zen/v1/responses");
  });

  it("sends other opencode models to chat completions", async () => {
    await writeSettings({ aiProvider: "opencode", aiModel: "qwen3", aiKeys: { opencode: "ok" } });
    reply(chatReply("chat"));
    await call({ mode: "summarize", contextText: "text" });
    expect(sent().url).toBe("https://opencode.ai/zen/v1/chat/completions");
  });
});

describe("/api/ai provider errors", () => {
  beforeEach(() => writeSettings({ aiProvider: "openrouter", aiModel: "bad", aiKeys: { openrouter: "k" } }));

  it.each([401, 403])("reports a rejected key for HTTP %i", async status => {
    reply({ error: { message: "nope" } }, status);
    const res = await call({ mode: "summarize", contextText: "t" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("AI key was rejected");
  });

  it("reports rate limiting", async () => {
    reply({}, 429);
    expect((await (await call({ mode: "summarize", contextText: "t" })).json()).error).toBe("AI rate limit reached");
  });

  it("includes the provider's message and a model hint on a 400", async () => {
    reply({ error: { message: "bad is not a valid model ID", code: 400 } }, 400);
    const { error } = await (await call({ mode: "summarize", contextText: "t" })).json();
    expect(error).toContain("returned 400");
    expect(error).toContain("bad is not a valid model ID");
    expect(error).toContain("Check the model name in Settings");
  });

  it("includes the message from string-style errors", async () => {
    reply({ detail: "Function not found" }, 404);
    const { error } = await (await call({ mode: "summarize", contextText: "t" })).json();
    expect(error).toContain("Function not found");
  });

  it("omits the model hint for server errors", async () => {
    reply({ error: { message: "overloaded" } }, 500);
    const { error } = await (await call({ mode: "summarize", contextText: "t" })).json();
    expect(error).toContain("overloaded");
    expect(error).not.toContain("model name");
  });

  it("handles a non-JSON error body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("404 page not found", { status: 404 }));
    const { error } = await (await call({ mode: "summarize", contextText: "t" })).json();
    expect(error).toMatch(/^AI provider returned 404\./);
  });

  it("fails clearly when the provider returns nothing", async () => {
    reply(chatReply(""));
    const res = await call({ mode: "summarize", contextText: "t" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("AI provider returned an empty response");
  });

  it("never leaks the API key in an error", async () => {
    reply({ error: { message: "bad" } }, 400);
    expect(JSON.stringify(await (await call({ mode: "summarize", contextText: "t" })).json())).not.toContain('"k"');
  });
});

describe("/api/ai modes", () => {
  beforeEach(() => writeSettings({ aiProvider: "openai", aiModel: "m", aiKeys: { openai: "k" } }));
  const prompt = () => sent().body.messages[0].content as string;

  it("builds a translate prompt with the target language", async () => {
    reply(chatReply("Hola"));
    await call({ mode: "translate", contextText: "Hello", targetLanguage: "Spanish" });
    expect(prompt()).toContain("Translate to Spanish");
    expect(prompt()).toContain("Hello");
  });

  it("defaults translation to English", async () => {
    reply(chatReply("Hi"));
    await call({ mode: "translate", contextText: "Hola" });
    expect(prompt()).toContain("Translate to English");
  });

  it.each([
    ["summarize", "Summarize"],
    ["fix_grammar", "Correct grammar"],
    ["make_shorter", "more concisely"],
    ["make_longer", "Expand"],
  ])("builds the %s prompt", async (mode, expected) => {
    reply(chatReply("x"));
    await call({ mode, contextText: "source text" });
    expect(prompt()).toContain(expected);
    expect(prompt()).toContain("source text");
  });

  it("includes earlier turns so follow-up questions work", async () => {
    findMany.mockResolvedValue([]);
    reply(chatReply("shorter"));
    await call({
      mode: "chat",
      prompt: "make that shorter",
      history: [
        { role: "user", content: "Summarize the roadmap" },
        { role: "assistant", content: "Ship v2 in May after the beta." },
      ],
    });
    expect(prompt()).toContain("Conversation so far:\nUser: Summarize the roadmap\nAssistant: Ship v2 in May after the beta.");
    expect(prompt()).toContain("Question: make that shorter");
  });

  it("keeps only the 10 most recent turns and truncates long ones", async () => {
    findMany.mockResolvedValue([]);
    reply(chatReply("ok"));
    const history = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `turn-${i} ${"x".repeat(i === 13 ? 5000 : 0)}` }));
    await call({ mode: "chat", prompt: "next", history });
    expect(prompt()).not.toContain("turn-3 ");
    expect(prompt()).toContain("turn-4 ");
    expect(prompt().match(/turn-13 x+/)![0]).toHaveLength(2000);
  });

  it("ignores malformed history entries", async () => {
    findMany.mockResolvedValue([]);
    reply(chatReply("ok"));
    await call({ mode: "chat", prompt: "hi", history: [null, 5, { role: "system", content: "evil" }, { role: "user", content: "" }, { role: "user" }] });
    expect(prompt()).not.toContain("Conversation so far");
    expect(prompt()).not.toContain("evil");
  });

  it("ignores history that is not an array", async () => {
    findMany.mockResolvedValue([]);
    reply(chatReply("ok"));
    await call({ mode: "chat", prompt: "hi", history: "nope" });
    expect(prompt()).not.toContain("Conversation so far");
  });

  it("answers chat questions using workspace pages", async () => {
    findMany.mockResolvedValue([{ title: "Roadmap", blocks: [{ content: JSON.stringify({ text: "Ship v2 in May" }) }, { content: "not json" }] }]);
    reply(chatReply("May"));
    const res = await call({ mode: "chat", prompt: "When do we ship?" });
    expect(await res.json()).toEqual({ answer: "May" });
    expect(prompt()).toContain("Page: Roadmap");
    expect(prompt()).toContain("Ship v2 in May");
    expect(prompt()).toContain("When do we ship?");
  });
});

describe("/api/ai extract_tasks", () => {
  beforeEach(() => writeSettings({ aiProvider: "openai", aiModel: "m", aiKeys: { openai: "k" } }));

  it("parses a plain JSON array", async () => {
    reply(chatReply('[{"title":"Write docs","priority":"High","estimate":2}]'));
    const res = await call({ mode: "extract_tasks", contextText: "Write docs" });
    expect(await res.json()).toEqual({ tasks: [{ title: "Write docs", priority: "High", estimate: 2 }] });
  });

  it("strips markdown code fences around the JSON", async () => {
    reply(chatReply('```json\n[{"title":"Ship it"}]\n```'));
    const { tasks } = await (await call({ mode: "extract_tasks", contextText: "x" })).json();
    expect(tasks).toEqual([{ title: "Ship it" }]);
  });

  it("returns an empty list when there are no tasks", async () => {
    reply(chatReply("[]"));
    expect((await (await call({ mode: "extract_tasks", contextText: "x" })).json()).tasks).toEqual([]);
  });

  it("rejects output that is not a task list", async () => {
    reply(chatReply('{"title":"not an array"}'));
    const res = await call({ mode: "extract_tasks", contextText: "x" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("AI returned an invalid task list");
  });

  it("rejects tasks without a title", async () => {
    reply(chatReply('[{"priority":"Low"}]'));
    expect((await call({ mode: "extract_tasks", contextText: "x" })).status).toBe(502);
  });

  it("fails cleanly when the model replies with prose instead of JSON", async () => {
    reply(chatReply("Here are your tasks: write docs."));
    const res = await call({ mode: "extract_tasks", contextText: "x" });
    expect(res.status).toBe(502);
    expect(typeof (await res.json()).error).toBe("string");
  });
});
