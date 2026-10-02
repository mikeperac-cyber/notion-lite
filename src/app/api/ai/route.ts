import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Provider = "gemini" | "openai" | "anthropic" | "openrouter" | "opencode" | "nvidia";
const providers: Provider[] = ["gemini", "openai", "anthropic", "openrouter", "opencode", "nvidia"];

async function configuration(): Promise<{ provider: Provider; model: string; key: string }> {
  let saved: any = {};
  try {
    const folder = process.env.NOTIONLITE_DATA_DIR || path.dirname((process.env.DATABASE_URL || "file:./prisma/dev.db").replace(/^file:/, ""));
    saved = JSON.parse(await fs.readFile(path.join(folder, "settings.json"), "utf8"));
  } catch {}
  const provider: Provider = providers.includes(saved.aiProvider) ? saved.aiProvider : "gemini";
  const model = String(saved.aiModel || process.env.GEMINI_MODEL || "").trim();
  const key = (saved.aiKeys && saved.aiKeys[provider]) || process.env[`NL_AI_KEY_${provider.toUpperCase()}`] || "";
  return { provider, model, key };
}

async function requestJson(url: string, _key: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("AI key was rejected");
    if (response.status === 429) throw new Error("AI rate limit reached");
    const detail = String(payload?.error?.message || payload?.error || payload?.detail || payload?.message || "").slice(0, 200);
    const hint = response.status === 400 || response.status === 404 ? " Check the model name in Settings." : "";
    throw new Error(`AI provider returned ${response.status}${detail ? `: ${detail}` : ""}.${hint}`);
  }
  return payload;
}

async function complete(provider: Provider, model: string, key: string, prompt: string): Promise<string> {
  if (provider === "gemini") {
    const data = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, key, { contents: [{ parts: [{ text: prompt }] }] }, { "x-goog-api-key": key });
    return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
  }
  if (provider === "anthropic") {
    const data = await requestJson("https://api.anthropic.com/v1/messages", key, { model, max_tokens: 2048, messages: [{ role: "user", content: prompt }] }, { "x-api-key": key, "anthropic-version": "2023-06-01" });
    return data.content?.map((part: any) => part.text || "").join("") || "";
  }
  if (provider === "opencode" && /^gpt-/i.test(model)) {
    const data = await requestJson("https://opencode.ai/zen/v1/responses", key, { model, input: prompt }, { Authorization: `Bearer ${key}` });
    return data.output_text || data.output?.flatMap((item: any) => item.content || []).map((item: any) => item.text || "").join("") || "";
  }
  const base: Record<Exclude<Provider, "gemini" | "anthropic">, string> = {
    openai: "https://api.openai.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    opencode: "https://opencode.ai/zen/v1",
    nvidia: "https://integrate.api.nvidia.com/v1",
  };
  const data = await requestJson(`${base[provider]}/chat/completions`, key, { model, messages: [{ role: "user", content: prompt }], stream: false }, { Authorization: `Bearer ${key}` });
  return data.choices?.[0]?.message?.content || "";
}

async function workspaceContext() {
  const pages = await prisma.page.findMany({ where: { isArchived: false }, take: 15, orderBy: { updatedAt: "desc" }, include: { blocks: true } });
  return pages.map(page => {
    const body = page.blocks.map(block => {
      try { const content = JSON.parse(block.content); return content.text || ""; } catch { return ""; }
    }).join("\n");
    return `Page: ${page.title}\n${body}`;
  }).join("\n\n---\n\n").slice(0, 30000);
}

export async function POST(request: Request) {
  try {
    const { mode, prompt, contextText, targetLanguage } = await request.json();
    const { provider, model, key } = await configuration();
    if (!key) return NextResponse.json({ code: "not_configured", error: "Add an AI provider key in Settings." }, { status: 409 });
    if (!model) return NextResponse.json({ code: "model_required", error: "Choose an AI model in Settings." }, { status: 409 });
    const text = String(contextText || prompt || "").slice(0, 40000);
    if (!text.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });
    let instruction = text;
    if (mode === "chat") instruction = `Answer using the workspace context below. If it does not contain the answer, say so.\n\n${await workspaceContext()}\n\nQuestion: ${text}`;
    if (mode === "summarize") instruction = `Summarize the following text in two or three concise bullets:\n\n${text}`;
    if (mode === "fix_grammar") instruction = `Correct grammar and spelling while preserving meaning and tone. Return only the corrected text:\n\n${text}`;
    if (mode === "translate") instruction = `Translate to ${String(targetLanguage || "English").slice(0, 60)}. Return only the translation:\n\n${text}`;
    if (mode === "make_shorter") instruction = `Rewrite this more concisely. Return only the rewrite:\n\n${text}`;
    if (mode === "make_longer") instruction = `Expand this text. Return only the rewrite:\n\n${text}`;
    if (mode === "extract_tasks") instruction = `Extract actionable tasks. Return ONLY a JSON array of objects with title, priority (High, Medium, Low), and estimate (hours or null). Do not invent tasks.\n\n${text}`;
    const result = (await complete(provider, model, key, instruction)).trim();
    if (!result) throw new Error("AI provider returned an empty response");
    if (mode === "extract_tasks") {
      const tasks = JSON.parse(result.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      if (!Array.isArray(tasks) || !tasks.every(task => typeof task.title === "string")) throw new Error("AI returned an invalid task list");
      return NextResponse.json({ tasks });
    }
    return NextResponse.json(mode === "chat" ? { answer: result } : { result });
  } catch (error: any) {
    console.error("AI request failed", error instanceof SyntaxError ? "Invalid provider response" : "Provider error");
    return NextResponse.json({ error: error?.message || "AI request failed" }, { status: 502 });
  }
}
