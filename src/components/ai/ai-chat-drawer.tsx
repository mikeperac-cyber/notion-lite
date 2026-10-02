"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Copy,
  Check,
  PlusCircle,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import { MarkdownText } from "./markdown-text";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
  notConfigured?: boolean;
  error?: boolean;
  sources?: Array<{ id: string; title: string }>;
}

const GREETING: Message = {
  role: "assistant",
  content:
    "Hello! I am your Notion Lite Workspace AI. Ask me anything about your project roadmap, task statuses, or documentation, or ask me to draft content for you.",
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  opencode: "opencode zen",
  nvidia: "NVIDIA NIM",
};

export function AiChatDrawer({ onInsertText }: { onInsertText?: (text: string) => void }) {
  const insertText = onInsertText || ((text: string) => window.dispatchEvent(new CustomEvent("ai-insert", { detail: text })));
  const { aiChatOpen, setAiChatOpen, setSettingsOpen, activePageId } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [providerLabel, setProviderLabel] = useState("AI Assistant");
  const [configured, setConfigured] = useState(true);
  const [contextScope, setContextScope] = useState<"none" | "current" | "workspace">("none");
  const [contextPreview, setContextPreview] = useState<{ sources: Array<{ id: string; title: string }>; preview: string }>({ sources: [], preview: "" });

  useEffect(() => {
    if (!aiChatOpen) return;
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        setProviderLabel(PROVIDER_LABELS[data.aiProvider] || "AI Assistant");
        setConfigured(!!data.keyPreviews?.[data.aiProvider]);
      })
      .catch(() => {});
  }, [aiChatOpen]);

  useEffect(() => {
    if (!aiChatOpen || contextScope === "none" || (contextScope === "current" && !activePageId)) { setContextPreview({ sources: [], preview: "" }); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ scope: contextScope, q: input, ...(activePageId ? { pageId: activePageId } : {}) });
      fetch(`/api/ai?${params}`, { signal: controller.signal }).then(response => response.json()).then(data => { if (!controller.signal.aborted) setContextPreview({ sources: data.sources || [], preview: data.preview || "" }); }).catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [aiChatOpen, contextScope, activePageId, input]);

  if (!aiChatOpen) return null;

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || loading) return;

    const history = messages
      .filter((msg) => msg !== GREETING && !msg.error && !msg.notConfigured)
      .map(({ role, content }) => ({ role, content }));
    const userMsg: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          prompt: textToSend,
          history,
          contextScope,
          pageId: contextScope === "current" ? activePageId : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const notConfigured = data.code === "not_configured" || data.code === "model_required";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || `AI request failed (HTTP ${res.status})`, notConfigured, error: true },
        ]);
        return;
      }
      const assistantMsg: Message = {
        role: "assistant",
        content: data.answer || data.result || "No response generated.",
        sources: data.sources || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err?.message || "Sorry, I encountered an error answering your request.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] h-[540px] flex flex-col bg-background/95 backdrop-blur border border-indigo-500/30 shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-none">Workspace AI</h3>
            <span className="text-[11px] text-muted-foreground">
              {configured ? providerLabel : "Not configured"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 1 && (
            <button
              onClick={() => setMessages([GREETING])}
              title="Clear conversation"
              className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setAiChatOpen(false)}
            title="Close"
            className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Message List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-muted text-foreground border border-border/60"
                }`}
              >
                {msg.role === "assistant" ? <MarkdownText text={msg.content} /> : <p className="whitespace-pre-wrap">{msg.content}</p>}
                {Boolean(msg.sources?.length) && <div className="mt-2 border-t border-border/40 pt-1 text-[10px]">Pages used: {msg.sources!.map(source => <a key={source.id} href={`/editor/${encodeURIComponent(source.id)}`} className="mr-2 text-indigo-500 underline">{source.title}</a>)}</div>}

                {msg.notConfigured && (
                  <button
                    onClick={() => { setAiChatOpen(false); setSettingsOpen(true); }}
                    className="mt-2 text-[10px] flex items-center gap-1 text-indigo-500 hover:text-indigo-600 font-medium"
                  >
                    <SettingsIcon className="h-3 w-3" />
                    Open Settings
                  </button>
                )}

                {msg.role === "assistant" && i !== 0 && !msg.notConfigured && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40 justify-end">
                    <button
                      onClick={() => handleCopy(msg.content, i)}
                      className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {copiedIndex === i ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedIndex === i ? "Copied" : "Copy"}
                    </button>
                    {(
                      <button
                        onClick={() => insertText(msg.content)}
                        className="text-[10px] flex items-center gap-1 text-indigo-500 hover:text-indigo-600 font-medium"
                      >
                        <PlusCircle className="h-3 w-3" />
                        Insert
                      </button>
                    )}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-300 mt-0.5">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
              <Sparkles className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              Thinking...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggested chips */}
      <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t border-border/40 text-[11px] text-muted-foreground scrollbar-none">
        <button
          onClick={() => handleSend("What are the active tasks in this workspace?")}
          className="whitespace-nowrap px-2 py-0.5 rounded-full bg-muted hover:bg-accent border border-border"
        >
          Active tasks?
        </button>
        <button
          onClick={() => handleSend("Summarize the main project roadmap")}
          className="whitespace-nowrap px-2 py-0.5 rounded-full bg-muted hover:bg-accent border border-border"
        >
          Summarize roadmap
        </button>
      </div>

      {/* Input Form */}
      <div className="space-y-1 border-t border-border px-3 py-2 text-[11px]">
        <label className="flex items-center gap-2">Share with AI
          <select aria-label="AI context scope" className="flex-1 rounded border border-border bg-background px-2 py-1" value={contextScope} onChange={event => setContextScope(event.target.value as typeof contextScope)}>
            <option value="none">No workspace content</option>
            {activePageId && <option value="current">Current page</option>}
            <option value="workspace">Relevant workspace pages and rows</option>
          </select>
        </label>
        {contextScope !== "none" && <details><summary className="cursor-pointer text-muted-foreground">Preview content sent · {contextPreview.sources.length} pages</summary><pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">{contextPreview.preview || "No matching content found."}</pre></details>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-border flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI anything..."
          className="flex-1 bg-muted/60 text-xs px-3 py-2 rounded-lg border border-border outline-none focus:border-indigo-500"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || loading}
          className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
