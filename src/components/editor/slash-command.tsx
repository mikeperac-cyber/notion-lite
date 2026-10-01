"use client";

import React from "react";
import { Editor } from "@tiptap/react";
import { Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Code2, Quote, Minus, Keyboard, Lightbulb, ChevronRight, Columns, Table2, GitFork, Calculator, BarChart2, Video, Image as ImageIcon, Bookmark as BookmarkIcon, RefreshCw, Sparkles, ListChecks, Link2 } from "lucide-react";

export interface CommandItem { title: string; description: string; category: "Basic" | "Callouts & Toggles" | "Advanced & Media" | "AI & Data"; icon: any; command: (editor: Editor) => void }
const paragraph = (text = "") => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const insert = (editor: Editor, type: string, attrs: Record<string, any> = {}, content?: any[]) => editor.chain().focus().insertContent({ type, attrs, ...(content ? { content } : {}) }).run();
const item = (title: string, description: string, category: CommandItem["category"], icon: any, command: (editor: Editor) => void): CommandItem => ({ title, description, category, icon, command });

async function aiAction(editor: Editor, mode: string) {
  const selected = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ");
  const contextText = selected || editor.getText();
  const prompt = mode === "prompt" ? window.prompt("What should AI write?") : undefined;
  if (mode === "prompt" && !prompt) return;
  const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, prompt, contextText: mode === "prompt" ? prompt : contextText }) });
  const data = await response.json();
  if (!response.ok) { window.alert(data.error || "AI is unavailable. Configure a provider in Settings."); return; }
  if (mode === "extract_tasks") {
    const tasks: any[] = data.tasks || [];
    if (!tasks.length) return;
    if (!window.confirm(`Insert these tasks?\n\n${tasks.map(task => `• ${task.title}`).join("\n")}`)) return;
    insert(editor, "taskList", {}, tasks.map(task => ({ type: "taskItem", attrs: { checked: false }, content: [paragraph(task.title)] })));
  } else if (data.result && window.confirm(`Insert this AI result?\n\n${data.result}`)) editor.chain().focus().insertContent(data.result).run();
}

export function getSuggestionItems(): CommandItem[] {
  return [
    item("Text", "Plain paragraph", "Basic", Type, editor => editor.chain().focus().setParagraph().run()),
    item("Heading 1", "Large heading", "Basic", Heading1, editor => editor.chain().focus().toggleHeading({ level: 1 }).run()),
    item("Heading 2", "Section heading", "Basic", Heading2, editor => editor.chain().focus().toggleHeading({ level: 2 }).run()),
    item("Heading 3", "Small heading", "Basic", Heading3, editor => editor.chain().focus().toggleHeading({ level: 3 }).run()),
    item("Bullet List", "Bulleted items", "Basic", List, editor => editor.chain().focus().toggleBulletList().run()),
    item("Numbered List", "Numbered items", "Basic", ListOrdered, editor => editor.chain().focus().toggleOrderedList().run()),
    item("To-do List", "Interactive checklist", "Basic", CheckSquare, editor => editor.chain().focus().toggleTaskList().run()),
    item("Code Block", "Code with syntax", "Basic", Code2, editor => editor.chain().focus().toggleCodeBlock().run()),
    item("Quote", "Quotation", "Basic", Quote, editor => editor.chain().focus().toggleBlockquote().run()),
    item("Divider", "Horizontal rule", "Basic", Minus, editor => editor.chain().focus().setHorizontalRule().run()),
    item("Keyboard Shortcut", "Inline keyboard badge", "Basic", Keyboard, editor => insert(editor, "keyboardBadge", { keys: window.prompt("Keys", "Ctrl+K") || "Ctrl+K" })),
    item("Link to Page", "Insert a link to another page", "Basic", Link2, () => window.dispatchEvent(new Event("open-page-link-picker"))),
    ...(["Info", "Success", "Warning", "Danger"] as const).map((variant, index) => item(`${variant} Callout`, "Editable highlighted note", "Callouts & Toggles", Lightbulb, editor => insert(editor, "callout", { variant: variant.toLowerCase() }, [paragraph("Write a note...")]))),
    item("Toggle List", "Collapsible notes", "Callouts & Toggles", ChevronRight, editor => insert(editor, "toggleBlock", { open: true }, [paragraph("Toggle heading"), paragraph("Details...")])),
    item("2 Columns", "Two editable columns", "Advanced & Media", Columns, editor => insert(editor, "columns", { count: 2 }, [{ type: "column", content: [paragraph()] }, { type: "column", content: [paragraph()] }])),
    item("3 Columns", "Three editable columns", "Advanced & Media", Columns, editor => insert(editor, "columns", { count: 3 }, [{ type: "column", content: [paragraph()] }, { type: "column", content: [paragraph()] }, { type: "column", content: [paragraph()] }])),
    item("Data Table Matrix", "Editable table", "Advanced & Media", Table2, editor => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()),
    item("Image", "Choose a local image", "Advanced & Media", ImageIcon, editor => { void window.electronAPI?.pickAttachment().then(picked => { if (picked) editor.chain().focus().setImage({ src: picked.url, alt: picked.name }).run(); }); }),
    item("Flowchart & Diagram", "Mermaid diagram", "Advanced & Media", GitFork, editor => insert(editor, "mermaidBlock")),
    item("Math & LaTeX", "Rendered equation", "Advanced & Media", Calculator, editor => insert(editor, "mathBlock")),
    item("Progress Tracker", "Editable goal meter", "Advanced & Media", BarChart2, editor => insert(editor, "progressBlock")),
    item("Video Embed", "YouTube or Vimeo video", "Advanced & Media", Video, editor => { const url = window.prompt("Video URL"); if (url) insert(editor, "videoEmbed", { url }); }),
    item("Web Bookmark", "Editable link card", "Advanced & Media", BookmarkIcon, editor => { const url = window.prompt("Bookmark URL"); if (url) insert(editor, "bookmark", { url, title: url }); }),
    item("Synced Block", "Share a block across pages", "AI & Data", RefreshCw, editor => { const id = window.prompt("Existing sync ID (leave blank to create a new block)"); if (id === null) return; if (id.trim()) fetch(`/api/synced-blocks/${encodeURIComponent(id.trim())}`).then(response => response.json()).then(data => { if (data.node) editor.chain().focus().insertContent({ ...data.node, attrs: { ...(data.node.attrs || {}), syncId: id.trim(), id: null } }).run(); else window.alert("Sync ID not found"); }); else insert(editor, "syncedBlock", { syncId: crypto.randomUUID() }, [paragraph("Shared content")]); }),
    item("AI Prompt", "Draft with your AI provider", "AI & Data", Sparkles, editor => { void aiAction(editor, "prompt"); }),
    item("AI Action Items", "Extract tasks from page", "AI & Data", ListChecks, editor => { void aiAction(editor, "extract_tasks"); }),
  ];
}

interface ListProps { items: CommandItem[]; command: (item: CommandItem) => void; selectedIndex: number; onHover: (index: number) => void }
export function SlashCommandList({ items, command, selectedIndex, onHover }: ListProps) {
  return <div role="listbox" aria-label="Slash commands" className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl">{items.length ? items.map((entry, index) => <button role="option" aria-selected={selectedIndex === index} key={entry.title} onMouseMove={() => onHover(index)} onMouseDown={event => event.preventDefault()} onClick={() => command(entry)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${selectedIndex === index ? "bg-accent" : "hover:bg-accent"}`}><entry.icon className="h-4 w-4 shrink-0" /><span><strong className="block">{entry.title}</strong><small className="text-muted-foreground">{entry.description}</small></span></button>) : <p className="p-2 text-xs text-muted-foreground">No commands found.</p>}</div>;
}
