"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAppStore } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function markdownBlocks(source: string) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<{ type: string; content: Record<string, any>; order: number }> = [];
  const inline = (value: string) => {
    const result: any[] = [];
    let cursor = 0;
    for (const match of Array.from(value.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g))) {
      if (match.index! > cursor) result.push({ type: "text", text: value.slice(cursor, match.index) });
      result.push({ type: "text", text: match[1], marks: [{ type: "link", attrs: { href: match[2] } }] });
      cursor = match.index! + match[0].length;
    }
    if (cursor < value.length) result.push({ type: "text", text: value.slice(cursor) });
    return result;
  };
  const nodeFor = (type: string, value: string, checked = false): any => {
    const paragraph = { type: "paragraph", content: inline(value) };
    if (type.startsWith("heading_")) return { type: "heading", attrs: { level: Number(type.slice(-1)) }, content: inline(value) };
    if (type === "bullet_list" || type === "numbered_list") return { type: type === "bullet_list" ? "bulletList" : "orderedList", content: [{ type: "listItem", content: [paragraph] }] };
    if (type === "todo") return { type: "taskList", content: [{ type: "taskItem", attrs: { checked }, content: [paragraph] }] };
    if (type === "quote") return { type: "blockquote", content: [paragraph] };
    if (type === "code") return { type: "codeBlock", content: [{ type: "text", text: value }] };
    if (type === "image") { const match = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(value); return { type: "image", attrs: { alt: match?.[1] || "Image", src: match?.[2] || "" } }; }
    return paragraph;
  };
  let fence: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (fence) { const text = fence.join("\n"); blocks.push({ type: "code", content: { text, code: text, node: nodeFor("code", text) }, order: blocks.length }); fence = null; }
      else fence = [];
      continue;
    }
    if (fence) { fence.push(line); continue; }
    if (!line.trim()) continue;
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const todo = /^- \[([ xX])\] (.+)$/.exec(line);
    const bullet = /^[-*] (.+)$/.exec(line);
    const numbered = /^\d+\. (.+)$/.exec(line);
    const type = heading ? `heading_${heading[1].length}` : todo ? "todo" : bullet ? "bullet_list" : numbered ? "numbered_list" : /^!\[[^\]]*\]\([^)]+\)$/.test(line) ? "image" : line.startsWith("> ") ? "quote" : "paragraph";
    const text = heading?.[2] || todo?.[2] || bullet?.[1] || numbered?.[1] || (type === "quote" ? line.slice(2) : line);
    const checked = todo?.[1].toLowerCase() === "x";
    blocks.push({ type, content: { text, ...(todo ? { checked } : {}), node: nodeFor(type, text, checked) }, order: blocks.length });
  }
  if (fence) { const text = fence.join("\n"); blocks.push({ type: "code", content: { text, code: text, node: nodeFor("code", text) }, order: blocks.length }); }
  return blocks;
}

export function DesktopBridge() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { currentWorkspace, setSearchModalOpen, setTrashModalOpen } = useAppStore();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [status, setStatus] = useState("");
  const [ai, setAi] = useState<Record<string, any>>({ provider: "gemini", model: "", configured: {} });
  const [pendingKey, setPendingKey] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");
  const [dataPath, setDataPath] = useState("");

  const refresh = useCallback(async () => {
    if (window.electronAPI) {
      setSettings(await window.electronAPI.getSettings());
      setDataPath((await window.electronAPI.getAppInfo()).dataPath);
      try { setAi(await window.electronAPI.getAiSettings()); }
      catch (error: any) { setStatus(`Credential store unavailable: ${error.message}`); }
    }
  }, []);
  const update = async (changes: Record<string, any>) => {
    if (!window.electronAPI) return;
    const next = await window.electronAPI.setSettings(changes);
    setSettings(next);
    if (changes.theme) setTheme(changes.theme);
  };
  const createPage = useCallback(async () => {
    const response = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: currentWorkspace?.id, title: "Untitled" }) });
    if (!response.ok) throw new Error("Could not create page");
    const page = await response.json();
    router.push(`/editor/${page.id}`);
    router.refresh();
  }, [currentWorkspace?.id, router]);
  const importMarkdown = async () => {
    const files = await window.electronAPI?.importMarkdown() || [];
    for (const file of files) {
      const title = file.name.replace(/\.markdown?$|\.md$/i, "") || "Imported page";
      const create = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: currentWorkspace?.id, title }) });
      if (!create.ok) throw new Error(`Could not import ${file.name}`);
      const page = await create.json();
      const existingRes = await fetch(`/api/pages/${page.id}`);
      if (!existingRes.ok) throw new Error(`Could not load ${file.name}`);
      const existing = await existingRes.json();
      const save = await fetch("/api/blocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: page.id, deletedBlockIds: existing.blocks.map((block: any) => block.id), changedBlocks: markdownBlocks(file.content) }) });
      if (!save.ok) throw new Error(`Could not save ${file.name}`);
      router.push(`/editor/${page.id}`);
    }
    if (files.length) setStatus(`Imported ${files.length} Markdown file${files.length === 1 ? "" : "s"}.`);
  };

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    const off = api.onCommand(async (command) => {
      try {
        if (command === "new-page") await createPage();
        if (command === "search") setSearchModalOpen(true);
        if (command === "trash") setTrashModalOpen(true);
        if (command === "export") window.dispatchEvent(new Event("desktop-export"));
        if (command === "settings") { await refresh(); setOpen(true); }
        if (command.startsWith("open-page:")) router.push(`/editor/${encodeURIComponent(command.slice("open-page:".length))}`);
      } catch (error: any) { setStatus(error.message || "Desktop action failed"); setOpen(true); }
    });
    api.ready();
    return off;
  }, [createPage, refresh, router, setSearchModalOpen, setTrashModalOpen]);
  useEffect(() => window.electronAPI?.onUpdateStatus(setUpdateStatus), []);

  if (typeof window === "undefined" || !window.electronAPI) return null;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Notion Lite Settings</DialogTitle></DialogHeader>
      <div className="space-y-4 text-sm">
        <label className="flex justify-between items-center">Theme <select className="bg-background border rounded p-1" value={theme || "system"} onChange={event => update({ theme: event.target.value })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="flex justify-between items-center">Close to tray <input type="checkbox" checked={settings.closeToTray ?? true} onChange={event => update({ closeToTray: event.target.checked })} /></label>
        <label className="flex justify-between items-center">Ctrl+Alt+Space opens Search <input type="checkbox" checked={settings.globalShortcut ?? true} onChange={event => update({ globalShortcut: event.target.checked })} /></label>
        {settings.globalShortcut && settings.shortcutRegistered === false && <p className="text-amber-600">Windows could not register this shortcut. Another app may be using it.</p>}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={async () => { try { const result = await window.electronAPI!.createBackup(); if (!result.canceled) setStatus("Backup saved."); } catch (error: any) { setStatus(error.message); } }}>Create backup</Button>
          <Button variant="outline" onClick={async () => { try { await window.electronAPI!.restoreBackup(); } catch (error: any) { setStatus(error.message); } }}>Restore backup</Button>
          <Button variant="outline" onClick={() => importMarkdown().catch(error => setStatus(error.message))}>Import Markdown</Button>
        </div>
        <div className="space-y-2 border-t pt-4">
          <p className="font-medium">AI provider</p>
          <select aria-label="AI provider" className="w-full bg-background border rounded p-2" value={ai.provider} onChange={event => setAi({ ...ai, provider: event.target.value })}>
            {[["gemini", "Gemini"], ["openai", "OpenAI"], ["anthropic", "Anthropic"], ["openrouter", "OpenRouter"], ["opencode", "OpenCode Zen"], ["nvidia", "NVIDIA NIM"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input aria-label="AI model ID" className="w-full bg-background border rounded p-2" placeholder="Model ID" value={ai.model || ""} onChange={event => setAi({ ...ai, model: event.target.value })} />
          <input aria-label="AI API key" className="w-full bg-background border rounded p-2" type="password" autoComplete="off" placeholder={ai.configured?.[ai.provider] ? "Key saved — enter a new key to replace" : "Paste your API key"} value={pendingKey} onChange={event => setPendingKey(event.target.value)} />
          <div className="flex gap-2">
            <Button onClick={async () => { try { setAi(await window.electronAPI!.setAiSettings({ provider: ai.provider, model: ai.model, key: pendingKey })); setPendingKey(""); setStatus("AI settings saved."); } catch (error: any) { setStatus(error.message); } }}>Save AI settings</Button>
            {ai.configured?.[ai.provider] && <Button variant="outline" onClick={async () => { setAi(await window.electronAPI!.setAiSettings({ provider: ai.provider, model: ai.model, removeKey: true })); setStatus("Key removed."); }}>Remove key</Button>}
          </div>
        </div>
        <div className="border-t pt-4 flex items-center gap-2"><Button variant="outline" onClick={async () => { try { const result = await window.electronAPI!.checkForUpdates(); setUpdateStatus(result.status); } catch (error: any) { setUpdateStatus(error.message); } }}>Check for updates</Button><span role="status" className="text-xs text-muted-foreground">{updateStatus}</span></div>
        {dataPath && <p className="text-xs text-muted-foreground break-all">Workspace data: {dataPath}</p>}
        {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
