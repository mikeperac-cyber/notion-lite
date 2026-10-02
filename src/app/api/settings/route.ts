import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const PROVIDERS = ["gemini", "openai", "anthropic", "openrouter", "opencode", "nvidia"] as const;
type Provider = (typeof PROVIDERS)[number];

function settingsPath() {
  const folder = process.env.NOTIONLITE_DATA_DIR || path.dirname((process.env.DATABASE_URL || "file:./prisma/dev.db").replace(/^file:/, ""));
  return path.join(folder, "settings.json");
}

async function readSettings(): Promise<any> {
  try {
    return JSON.parse(await fs.readFile(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function maskKey(key: string) {
  if (!key) return "";
  return key.length <= 4 ? "••••" : `••••${key.slice(-4)}`;
}

export async function GET() {
  const saved = await readSettings();
  const keyPreviews: Record<string, string> = {};
  for (const provider of PROVIDERS) {
    const key = process.env[`NL_AI_KEY_${provider.toUpperCase()}`] || "";
    if (key) keyPreviews[provider] = maskKey(key);
  }
  return NextResponse.json({
    aiProvider: PROVIDERS.includes(saved.aiProvider) ? saved.aiProvider : "gemini",
    aiModel: saved.aiModel || "",
    keyPreviews,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const provider: Provider = PROVIDERS.includes(body.aiProvider) ? body.aiProvider : "gemini";
  const model = String(body.aiModel || "").trim();
  const key = typeof body.aiKey === "string" ? body.aiKey.trim() : undefined;
  if (key) return NextResponse.json({ error: "Save AI keys in desktop Settings. For web development, set NL_AI_KEY_<PROVIDER> in the environment." }, { status: 400 });

  const saved = await readSettings();
  const next = { ...saved, aiProvider: provider, aiModel: model };
  const target = settingsPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(next, null, 2), "utf8");

  return NextResponse.json({ ok: true });
}
