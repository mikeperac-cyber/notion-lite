import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GET, POST } from "./route";

let dir: string;

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/settings", { method: "POST", body: JSON.stringify(body) }));

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "nl-settings-"));
  process.env.NOTIONLITE_DATA_DIR = dir;
  for (const key of Object.keys(process.env)) if (key.startsWith("NL_AI_KEY_")) delete process.env[key];
});

afterEach(async () => {
  delete process.env.NOTIONLITE_DATA_DIR;
  for (const key of Object.keys(process.env)) if (key.startsWith("NL_AI_KEY_")) delete process.env[key];
  await fs.rm(dir, { recursive: true, force: true });
});

describe("/api/settings", () => {
  it("returns defaults when nothing is saved", async () => {
    const data = await (await GET()).json();
    expect(data).toEqual({ aiProvider: "gemini", aiModel: "", keyPreviews: {} });
  });

  it("saves provider and model without accepting plaintext keys", async () => {
    expect((await post({ aiProvider: "openai", aiModel: "m", aiKey: "secret" })).status).toBe(400);
    process.env.NL_AI_KEY_OPENAI = "sk-secret-1234";
    await post({ aiProvider: "openai", aiModel: "gpt-4o-mini" });
    const res = await GET();
    const text = JSON.stringify(await res.clone().json());
    const data = await res.json();
    expect(data.aiProvider).toBe("openai");
    expect(data.aiModel).toBe("gpt-4o-mini");
    expect(data.keyPreviews.openai).toBe("••••1234");
    expect(text).not.toContain("sk-secret");
  });

  it("falls back to gemini for an unknown provider", async () => {
    await post({ aiProvider: "not-a-provider", aiModel: "m" });
    expect((await (await GET()).json()).aiProvider).toBe("gemini");
  });

  it("keeps an environment key when preferences change", async () => {
    process.env.NL_AI_KEY_GEMINI = "key-abcd";
    await post({ aiProvider: "gemini", aiModel: "a" });
    await post({ aiProvider: "gemini", aiModel: "b" });
    const data = await (await GET()).json();
    expect(data.aiModel).toBe("b");
    expect(data.keyPreviews.gemini).toBe("••••abcd");
  });

  it("reports keys for other providers when switching", async () => {
    process.env.NL_AI_KEY_GEMINI = "gem-1111";
    process.env.NL_AI_KEY_ANTHROPIC = "ant-2222";
    await post({ aiProvider: "gemini", aiModel: "a" });
    await post({ aiProvider: "anthropic", aiModel: "b" });
    const { keyPreviews } = await (await GET()).json();
    expect(keyPreviews).toEqual({ gemini: "••••1111", anthropic: "••••2222" });
  });

  it("reports a key supplied through the environment", async () => {
    process.env.NL_AI_KEY_NVIDIA = "env-key-9999";
    const { keyPreviews } = await (await GET()).json();
    expect(keyPreviews.nvidia).toBe("••••9999");
  });

  it("recovers from a corrupt settings file", async () => {
    await fs.writeFile(path.join(dir, "settings.json"), "{not json");
    expect((await (await GET()).json()).aiProvider).toBe("gemini");
  });
});
