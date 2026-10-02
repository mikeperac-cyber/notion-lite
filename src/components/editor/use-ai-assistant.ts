"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { AiTask, requestAi } from "@/lib/ai-client";
import { toTiptapBlocks, toTiptapContent } from "@/lib/ai-markdown";

export type AiMode = "summarize" | "fix_grammar" | "make_shorter" | "make_longer" | "translate" | "extract_tasks" | "write" | "continue";
export type AiScope = "selection" | "page";
export interface AiRequest { mode: AiMode; scope?: AiScope; targetLanguage?: string }
export type ApplyKind = "replace" | "below" | "caret";

export const AI_LABELS: Record<AiMode, string> = {
  summarize: "Summarize",
  fix_grammar: "Fix spelling & grammar",
  make_shorter: "Make shorter",
  make_longer: "Make longer",
  translate: "Translate",
  extract_tasks: "Action items",
  write: "Write with AI",
  continue: "Continue writing",
};

export interface AiPanelState {
  request: AiRequest;
  phase: "prompt" | "loading" | "done" | "error";
  hasSelection: boolean;
  result?: string;
  tasks?: AiTask[];
  error?: string;
  notConfigured?: boolean;
}

const CONTINUE_CONTEXT_CHARS = 6000;

export function useAiAssistant(editor: Editor | null) {
  const [panel, setPanel] = useState<AiPanelState | null>(null);
  const anchor = useRef({ from: 0, to: 0 });
  const body = useRef<Record<string, unknown> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const runId = useRef(0);

  const execute = useCallback(async (payload: Record<string, unknown>, request: AiRequest, hasSelection: boolean) => {
    controller.current?.abort();
    const id = ++runId.current;
    const ctrl = new AbortController();
    controller.current = ctrl;
    body.current = payload;
    setPanel({ request, phase: "loading", hasSelection });
    const outcome = await requestAi(payload, ctrl.signal);
    if (id !== runId.current) return;
    if (outcome.ok) setPanel({ request, phase: "done", hasSelection, result: outcome.result, tasks: outcome.tasks });
    else if (!outcome.cancelled) setPanel({ request, phase: "error", hasSelection, error: outcome.error, notConfigured: outcome.notConfigured });
  }, []);

  const start = useCallback((request: AiRequest) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    anchor.current = { from, to };
    const hasSelection = from !== to;
    const doc = editor.state.doc;
    const page = editor.getText();
    const base = { mode: request.mode, ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}) };

    if (request.mode === "write") {
      body.current = { ...base, contextText: page };
      setPanel({ request, phase: "prompt", hasSelection });
      return;
    }
    if (request.mode === "continue") {
      const before = doc.textBetween(0, from, "\n", " ").slice(-CONTINUE_CONTEXT_CHARS);
      if (!before.trim()) {
        setPanel({ request, phase: "error", hasSelection, error: "Write something first so AI has text to continue from." });
        return;
      }
      void execute({ ...base, contextText: before }, request, false);
      return;
    }
    const selected = hasSelection ? doc.textBetween(from, to, " ") : "";
    const text = request.scope === "page" ? page : selected || page;
    if (!text.trim()) {
      setPanel({ request, phase: "error", hasSelection, error: "There is no text on this page yet." });
      return;
    }
    void execute({ ...base, contextText: text }, request, hasSelection && request.scope !== "page");
  }, [editor, execute]);

  const submitPrompt = useCallback((prompt: string) => {
    if (!panel || !prompt.trim()) return;
    void execute({ ...(body.current || {}), prompt: prompt.trim() }, panel.request, false);
  }, [panel, execute]);

  const retry = useCallback(() => {
    if (panel && body.current) void execute(body.current, panel.request, panel.hasSelection);
  }, [panel, execute]);

  const close = useCallback(() => {
    runId.current++;
    controller.current?.abort();
    setPanel(null);
  }, []);

  const apply = useCallback((kind: ApplyKind) => {
    if (!editor || !panel) return;
    const size = editor.state.doc.content.size;
    const clamp = (position: number) => Math.min(Math.max(position, 0), size);
    const { from, to } = anchor.current;
    const chain = editor.chain().focus();

    const belowPosition = () => {
      const $to = editor.state.doc.resolve(clamp(to));
      return $to.depth >= 1 ? $to.after(1) : $to.pos;
    };

    // Block content typed on an empty top-level line should replace that line, not leave a blank one above it.
    const caretTarget = (isBlock: boolean) => {
      const $from = editor.state.doc.resolve(clamp(from));
      if (isBlock && $from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size === 0) {
        return { from: $from.before(), to: $from.after() };
      }
      return clamp(from);
    };

    if (panel.tasks?.length) {
      const taskList = {
        type: "taskList",
        content: panel.tasks.map(task => ({
          type: "taskItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: task.priority ? `${task.title} (${task.priority})` : task.title }] }],
        })),
      };
      chain.insertContentAt(panel.hasSelection ? belowPosition() : caretTarget(true), taskList).run();
    } else if (panel.result) {
      const content = toTiptapContent(panel.result);
      if (kind === "replace") chain.insertContentAt({ from: clamp(from), to: clamp(to) }, content).run();
      else if (kind === "below") chain.insertContentAt(belowPosition(), toTiptapBlocks(panel.result)).run();
      else chain.insertContentAt(caretTarget(content[0]?.type !== "text"), content).run();
    }
    close();
  }, [editor, panel, close]);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<AiRequest>).detail;
      if (detail?.mode) start(detail);
    };
    window.addEventListener("ai-request", onRequest);
    return () => window.removeEventListener("ai-request", onRequest);
  }, [start]);

  useEffect(() => {
    const current = controller;
    return () => current.current?.abort();
  }, []);

  return { panel, start, submitPrompt, retry, close, apply };
}
