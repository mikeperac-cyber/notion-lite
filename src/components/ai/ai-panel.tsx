"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Settings as SettingsIcon, Sparkles, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { MarkdownText } from "./markdown-text";
import { AI_LABELS, AiPanelState, ApplyKind } from "@/components/editor/use-ai-assistant";

interface AiPanelProps {
  state: AiPanelState | null;
  onClose: () => void;
  onApply: (kind: ApplyKind) => void;
  onRetry: () => void;
  onSubmitPrompt: (prompt: string) => void;
}

const primary = "h-7 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white";
const quiet = "h-7 px-2.5 text-xs";

export function AiPanel({ state, onClose, onApply, onRetry, onSubmitPrompt }: AiPanelProps) {
  const { setSettingsOpen } = useAppStore();
  const [draft, setDraft] = useState("");
  const open = Boolean(state);
  const isPrompt = state?.phase === "prompt";

  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isPrompt) return;
    setDraft("");
    // The slash menu returns focus to the editor after the panel mounts, so autoFocus alone loses the race.
    const timer = window.setTimeout(() => promptRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [isPrompt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!state) return null;
  const { request, phase, hasSelection, result, tasks, error, notConfigured } = state;

  return (
    <div
      role="dialog"
      aria-label={AI_LABELS[request.mode]}
      className="fixed bottom-6 left-1/2 z-50 w-[30rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 space-y-2.5 rounded-xl border border-indigo-500/30 bg-popover p-3 text-xs shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-semibold text-indigo-500">
          <Sparkles className="h-3.5 w-3.5" />
          {AI_LABELS[request.mode]}
          {request.targetLanguage ? ` to ${request.targetLanguage}` : ""}
        </span>
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {phase === "prompt" && (
        <form
          className="space-y-2"
          onSubmit={event => {
            event.preventDefault();
            onSubmitPrompt(draft);
          }}
        >
          <textarea
            ref={promptRef}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmitPrompt(draft);
              }
            }}
            placeholder="What should AI write? e.g. a short intro for this page"
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-indigo-500"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Enter to write · Shift+Enter for a new line</span>
            <div className="flex gap-1.5">
              <Button type="button" variant="ghost" className={quiet} onClick={onClose}>Cancel</Button>
              <Button type="submit" className={primary} disabled={!draft.trim()}>Write</Button>
            </div>
          </div>
        </form>
      )}

      {phase === "loading" && (
        <div className="flex items-center justify-between py-1">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </span>
          <Button variant="ghost" className={quiet} onClick={onClose}>Cancel</Button>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-2">
          <p className="text-rose-500">{error}</p>
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" className={quiet} onClick={onClose}>Close</Button>
            {notConfigured ? (
              <Button className={primary} onClick={() => { onClose(); setSettingsOpen(true); }}>
                <SettingsIcon className="mr-1 h-3 w-3" />
                Open Settings
              </Button>
            ) : (
              <Button variant="ghost" className={quiet} onClick={onRetry}>
                <RotateCcw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === "done" && tasks && (
        <div className="space-y-2">
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-muted/40 p-2">
            {tasks.length === 0 ? (
              <p className="italic text-muted-foreground">No actionable tasks found.</p>
            ) : (
              tasks.map((task, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 shrink-0 rounded border border-border" />
                  <span className="truncate">{task.title}</span>
                  {task.priority && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{task.priority}</span>}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" className={quiet} onClick={onClose}>Discard</Button>
            {tasks.length > 0 && <Button className={primary} onClick={() => onApply(hasSelection ? "below" : "caret")}>Insert as tasks</Button>}
          </div>
        </div>
      )}

      {phase === "done" && !tasks && (
        <div className="space-y-2">
          <div className="max-h-60 overflow-y-auto rounded-md border border-border/60 bg-muted/40 p-2.5">
            {result ? <MarkdownText text={result} /> : <p className="italic text-muted-foreground">AI returned nothing. Try again.</p>}
          </div>
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" className={quiet} onClick={onClose}>Discard</Button>
            <Button variant="ghost" className={quiet} onClick={onRetry}>
              <RotateCcw className="mr-1 h-3 w-3" />
              Retry
            </Button>
            {result && hasSelection && <Button className={primary} onClick={() => onApply("replace")}>Replace</Button>}
            {result && <Button className={primary} onClick={() => onApply(hasSelection ? "below" : "caret")}>{hasSelection ? "Insert below" : "Insert"}</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
