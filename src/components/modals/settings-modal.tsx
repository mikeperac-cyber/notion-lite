"use client";

import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Check, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PROVIDERS: Array<{ value: string; label: string; modelHint: string }> = [
  { value: "gemini", label: "Google Gemini", modelHint: "e.g. gemini-1.5-flash" },
  { value: "openai", label: "OpenAI", modelHint: "e.g. gpt-4o-mini" },
  { value: "anthropic", label: "Anthropic", modelHint: "e.g. claude-3-5-sonnet-latest" },
  { value: "openrouter", label: "OpenRouter", modelHint: "e.g. meta-llama/llama-3.1-70b-instruct" },
  { value: "opencode", label: "opencode zen", modelHint: "e.g. gpt-4o-mini" },
  { value: "nvidia", label: "NVIDIA NIM", modelHint: "e.g. meta/llama-3.1-70b-instruct" },
];

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useAppStore();
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [keyPreviews, setKeyPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!settingsOpen) return;
    setSaved(false);
    setError("");
    setKey("");
    setLoading(true);
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        setProvider(data.aiProvider || "gemini");
        setModel(data.aiModel || "");
        setKeyPreviews(data.keyPreviews || {});
      })
      .catch(() => setError("Could not load current settings."))
      .finally(() => setLoading(false));
  }, [settingsOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiProvider: provider, aiModel: model, aiKey: key || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      setSaved(true);
      setKey("");
      const refreshed = await fetch("/api/settings").then(r => r.json());
      setKeyPreviews(refreshed.keyPreviews || {});
    } catch (err: any) {
      setError(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const activePreview = keyPreviews[provider];

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-zinc-500" />
            <DialogTitle className="text-base font-semibold">AI Settings</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose a provider and add your own API key. Keys are stored locally and never leave this device.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Model</label>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder={PROVIDERS.find(p => p.value === provider)?.modelHint}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                API Key
              </label>
              <input
                type="password"
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder={activePreview ? `Saved (${activePreview}) — enter a new key to replace` : "Paste your API key"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-indigo-500 font-mono"
              />
              {activePreview && !key && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Key saved and active for this provider
                </p>
              )}
            </div>

            {error && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
              </p>
            )}
            {saved && !error && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Saved
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(false)}>Close</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !model.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
