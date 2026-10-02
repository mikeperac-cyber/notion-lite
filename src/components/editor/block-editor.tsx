"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Suggestion from "@tiptap/suggestion";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Sparkles,
  Check,
  Highlighter,
  Languages,
  ListChecks,
} from "lucide-react";
import { toTiptapContent } from "@/lib/ai-markdown";
import { AiPanel } from "@/components/ai/ai-panel";
import { AiMode, useAiAssistant } from "./use-ai-assistant";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SlashCommandList, getSuggestionItems, CommandItem } from "./slash-command";
import { BlockSchema } from "@/types";
import { Callout, ToggleBlock, Column, Columns, MermaidBlock, MathBlock, ProgressBlock, VideoEmbed, Bookmark, KeyboardBadge, SyncedBlock } from "./rich-nodes";

interface BlockEditorProps {
  pageId: string;
  initialBlocks?: BlockSchema[];
  readOnly?: boolean;
}

function legacyNode(block: BlockSchema): any {
  const content = typeof block.content === "string" ? JSON.parse(block.content || "{}") : block.content;
  if (content?.node?.type) return { ...content.node, attrs: { ...(content.node.attrs || {}), id: block.id } };
  const text = String(content?.text || content?.code || "");
  const paragraph = { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
  const attrs = { id: block.id };
  if (block.type.startsWith("heading_")) return { type: "heading", attrs: { ...attrs, level: Number(block.type.slice(-1)) }, content: paragraph.content };
  if (block.type === "bullet_list" || block.type === "numbered_list") return { type: block.type === "bullet_list" ? "bulletList" : "orderedList", attrs, content: [{ type: "listItem", content: [paragraph] }] };
  if (block.type === "todo") return { type: "taskList", attrs, content: [{ type: "taskItem", attrs: { checked: !!content.checked }, content: [paragraph] }] };
  if (block.type === "code") return { type: "codeBlock", attrs, content: paragraph.content };
  if (block.type === "callout") return { type: "callout", attrs: { ...attrs, variant: "info" }, content: [{ type: "paragraph", content: [{ type: "text", text: `${content.icon || "💡"} ${text}` }] }] };
  if (block.type === "toggle") return { type: "toggleBlock", attrs: { ...attrs, open: true }, content: [paragraph] };
  if (block.type === "image" && content.src) return { type: "image", attrs: { ...attrs, src: content.src, alt: content.alt || "Image" } };
  if (block.type === "quote") return { type: "blockquote", attrs, content: [paragraph] };
  if (block.type === "divider") return { type: "horizontalRule", attrs };
  return { ...paragraph, attrs };
}

// TipTap extension for slash commands
const SlashCommandsExtension = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: any) => {
          editor.commands.deleteRange(range);
          props.command(editor);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

const GlobalId = Extension.create({
  name: 'globalId',
  addGlobalAttributes() {
    return [
      {
        types: ['heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'taskItem', 'codeBlock', 'blockquote', 'horizontalRule', 'table', 'image', 'callout', 'toggleBlock', 'columns', 'mermaidBlock', 'mathBlock', 'progressBlock', 'videoEmbed', 'bookmark', 'syncedBlock'],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-id'),
            renderHTML: attributes => {
              if (!attributes.id) return {};
              return { 'data-id': attributes.id };
            },
          },
        },
      },
    ];
  },
});

export function BlockEditor({ pageId, initialBlocks, readOnly = false }: BlockEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [recoveryDraft, setRecoveryDraft] = useState<any | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkChoices, setLinkChoices] = useState<Array<{ id: string; title: string; icon: string | null }>>([]);
  const [linkQuery, setLinkQuery] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingBlocksRef = useRef<any[] | null>(null);
  const saveInFlightRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const draftKey = `notionlite:draft:${pageId}`;

  // Parse initial content from block models into HTML or JSON
  const getInitialContent = () => {
    if (!initialBlocks || initialBlocks.length === 0) {
      return "<p></p>";
    }
    return { type: "doc", content: initialBlocks.map(legacyNode) };
  };

  const lastSavedBlocksRef = useRef<any[]>(initialBlocks || []);
  
  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      GlobalId,
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      Callout, ToggleBlock, Column, Columns, MermaidBlock, MathBlock, ProgressBlock, VideoEmbed, Bookmark, KeyboardBadge, SyncedBlock,
      Highlight,
      Image.configure({ allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Typography,
      Placeholder.configure({
        placeholder: "Type '/' for commands, or start writing...",
      }),
      SlashCommandsExtension.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return getSuggestionItems().filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            );
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: TippyInstance[] | null = null;
            let selectedIndex = 0;
            let currentProps: any = null;
            const updateList = () => component?.updateProps({ ...currentProps, selectedIndex, onHover: (index: number) => {
              selectedIndex = index;
              updateList();
            } });

            return {
              onStart: (props: any) => {
                currentProps = props;
                selectedIndex = 0;
                component = new ReactRenderer(SlashCommandList, {
                  props: { ...props, selectedIndex, onHover: (index: number) => { selectedIndex = index; updateList(); } },
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              onUpdate(props: any) {
                currentProps = props;
                selectedIndex = 0;
                updateList();

                if (!props.clientRect) {
                  return;
                }

                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },

              onKeyDown(props: any) {
                const items: CommandItem[] = currentProps?.items || [];
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                if (items.length && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(props.event.key)) {
                  if (props.event.key === "Home") {
                    selectedIndex = 0;
                  } else if (props.event.key === "End") {
                    selectedIndex = items.length - 1;
                  } else if (props.event.key === "PageDown" || props.event.key === "PageUp") {
                    const list = popup?.[0]?.popper?.querySelector<HTMLElement>("[data-slash-command-list]");
                    const option = list?.querySelector<HTMLElement>("[role=option]");
                    const pageSize = list && option ? Math.max(1, Math.floor((list.clientHeight - 8) / option.getBoundingClientRect().height)) : 6;
                    const direction = props.event.key === "PageDown" ? 1 : -1;
                    selectedIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + direction * pageSize));
                  } else if (props.event.key === "ArrowDown") {
                    selectedIndex = (selectedIndex + 1) % items.length;
                  } else {
                    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                  }
                  updateList();
                  return true;
                }
                if (props.event.key === "Enter" && items[selectedIndex]) {
                  currentProps.command(items[selectedIndex]);
                  return true;
                }
                return false;
              },

              onExit() {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content: getInitialContent(),
    onUpdate: ({ editor }) => {
      if (readOnly) return;
      const missing: Array<{ position: number; node: any }> = [];
      const seenIds = new Set<string>();
      editor.state.doc.forEach((node, position) => {
        const id = node.attrs.id;
        if (!id || seenIds.has(id)) missing.push({ position, node });
        else seenIds.add(id);
      });
      if (missing.length) {
        const transaction = editor.state.tr;
        for (const { position, node } of missing) transaction.setNodeMarkup(position, undefined, { ...node.attrs, id: crypto.randomUUID() });
        editor.view.dispatch(transaction);
        return;
      }
      const json = editor.getJSON();
      try {
        localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), doc: json }));
      } catch {
        setSaveError("Local recovery storage is full. Keep this page open until it saves.");
      }
      setIsSaving(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      {
          // Extract top level nodes into block array
          const currentBlocks = (json.content || []).map((node, index) => {
            let type = "paragraph";
            if (node.type === "heading") type = `heading_${node.attrs?.level || 1}`;
            else if (node.type === "bulletList") type = "bullet_list";
            else if (node.type === "orderedList") type = "numbered_list";
            else if (node.type === "taskList") type = "todo";
            else if (node.type === "codeBlock") type = "code";
            else if (node.type === "blockquote") type = "quote";
            else if (node.type === "horizontalRule") type = "divider";
            else if (node.type === "image") type = "image";
            else if (node.type === "callout") type = "callout";
            else if (node.type === "toggleBlock") type = "toggle";
            else if (node.type === "columns") type = "columns";
            else if (node.type === "table") type = "table";
            else if (node.type === "mermaidBlock") type = "mermaid";
            else if (node.type === "mathBlock") type = "math";
            else if (node.type === "progressBlock") type = "progress";
            else if (node.type === "videoEmbed") type = "video";
            else if (node.type === "bookmark") type = "bookmark";
            else if (node.type === "syncedBlock") type = "synced_block";

            const text = editor.state.doc.child(index).textContent || node.attrs?.source || node.attrs?.title || node.attrs?.url || "";

            return {
              id: node.attrs?.id,
              type,
              content: { text, node },
              order: index,
              syncedBlockId: node.type === "syncedBlock" ? node.attrs?.syncId : null,
            };
          });
          pendingBlocksRef.current = currentBlocks;
      }
      saveTimeoutRef.current = setTimeout(() => void flushRef.current(), 400);
    },
  });

  flushRef.current = async () => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    try {
      while (pendingBlocksRef.current) {
        const currentBlocks = pendingBlocksRef.current;
        pendingBlocksRef.current = null;
        const previousById = new Map(lastSavedBlocksRef.current.map(block => [block.id, block]));
        const changedBlocks = currentBlocks.filter(block => {
          const previous = previousById.get(block.id);
          return !previous || previous.type !== block.type || JSON.stringify(previous.content) !== JSON.stringify(block.content) || previous.order !== block.order;
        });
        const orderedBlockIds = currentBlocks.map(block => block.id);
        const currentIds = new Set(orderedBlockIds);
        const deletedBlockIds = lastSavedBlocksRef.current.map(block => block.id).filter(id => id && !currentIds.has(id));
        try {
          const response = await fetch("/api/blocks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId, changedBlocks, deletedBlockIds, orderedBlockIds }),
          });
          if (!response.ok) throw new Error(`Save failed (HTTP ${response.status})`);
          lastSavedBlocksRef.current = currentBlocks;
          setSaveError("");
          if (!pendingBlocksRef.current) localStorage.removeItem(draftKey);
        } catch (error) {
          pendingBlocksRef.current ??= currentBlocks;
          setSaveError(error instanceof Error ? error.message : "Save failed");
          break;
        }
      }
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(Boolean(pendingBlocksRef.current));
    }
  };

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      const serverUpdated = Math.max(0, ...(initialBlocks || []).map(block => new Date(block.updatedAt).getTime() || 0));
      if (draft?.doc?.type === "doc" && draft.savedAt > serverUpdated) setRecoveryDraft(draft.doc);
    } catch {}
    const onPageHide = () => void flushRef.current();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      window.removeEventListener("pagehide", onPageHide);
      void flushRef.current();
    };
  }, [draftKey, initialBlocks]);

  useEffect(() => {
    if (!editor) return;
    const insertAi = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      const content = value ? toTiptapContent(value) : [];
      if (content.length) editor.chain().focus().insertContent(content).run();
    };
    window.addEventListener("ai-insert", insertAi);
    return () => window.removeEventListener("ai-insert", insertAi);
  }, [editor]);

  useEffect(() => {
    const openPicker = async () => {
      try {
        const response = await fetch("/api/pages/choices");
        if (!response.ok) { window.alert("Could not load pages"); return; }
        const data = await response.json();
        setLinkChoices((data.pages || []).filter((choice: { id: string }) => choice.id !== pageId));
        setLinkQuery("");
        setLinkPickerOpen(true);
      } catch {
        window.alert("Could not load pages");
      }
    };
    window.addEventListener("open-page-link-picker", openPicker);
    return () => window.removeEventListener("open-page-link-picker", openPicker);
  }, [pageId]);

  const insertPageLink = (choice: { id: string; title: string }) => {
    editor?.chain().focus().insertContent({ type: "text", text: choice.title, marks: [{ type: "link", attrs: { href: `/editor/${choice.id}` } }] }).run();
    setLinkPickerOpen(false);
  };

  const ai = useAiAssistant(editor);
  const runToolbarAction = (mode: AiMode, targetLanguage?: string) => {
    setAiMenuOpen(false);
    setTranslateMenuOpen(false);
    ai.start({ mode, scope: "selection", targetLanguage });
  };

  return (
    <div className="w-full relative min-h-[400px]">
      {/* Floating Save Status */}
      <div role="status" className="absolute top-2 right-4 z-10 text-[11px] text-muted-foreground flex items-center gap-1">
        {saveError ? (
          <button className="text-red-600 underline" onClick={() => void flushRef.current()}>{saveError} · Retry</button>
        ) : isSaving ? (
          <span className="flex items-center gap-1 text-amber-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Saving...
          </span>
        ) : (
          <span className="flex items-center gap-1 opacity-60">
            <Check className="h-3 w-3 text-green-500" />
            Saved
          </span>
        )}
      </div>
      {recoveryDraft && <div className="mt-8 flex items-center gap-2 rounded border border-amber-400 p-2 text-xs">
        Unsaved text from this page is available.
        <Button size="xs" onClick={() => { editor?.commands.setContent(recoveryDraft); setRecoveryDraft(null); }}>Recover</Button>
        <Button size="xs" variant="ghost" onClick={() => { localStorage.removeItem(draftKey); setRecoveryDraft(null); }}>Discard</Button>
      </div>}

      {/* Inline Selection Bubble Menu */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg backdrop-blur"
        >
          <Button
            size="xs"
            variant={editor.isActive("bold") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-7 w-7 p-0"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="xs"
            variant={editor.isActive("italic") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-7 w-7 p-0"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="xs"
            variant={editor.isActive("strike") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className="h-7 w-7 p-0"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="xs"
            variant={editor.isActive("code") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleCode().run()}
            className="h-7 w-7 p-0"
          >
            <Code className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="xs"
            variant={editor.isActive("highlight") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className="h-7 w-7 p-0"
          >
            <Highlighter className="h-3.5 w-3.5 text-amber-500" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* AI Quick Transform */}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setAiMenuOpen(!aiMenuOpen)}
            className="h-7 px-2 text-xs gap-1 text-indigo-500 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Edit
          </Button>

          {aiMenuOpen && (
            <div className="absolute top-9 left-0 z-50 w-56 rounded-lg border border-border bg-popover p-1 shadow-xl space-y-0.5 text-xs">
              <button
                onClick={() => runToolbarAction("summarize")}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted"
              >
                📝 Summarize
              </button>
              <button
                onClick={() => runToolbarAction("fix_grammar")}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted"
              >
                ✨ Fix Spelling & Grammar
              </button>
              <button
                onClick={() => runToolbarAction("make_shorter")}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted"
              >
                ✂️ Make Shorter
              </button>
              <button
                onClick={() => runToolbarAction("make_longer")}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted"
              >
                📖 Make Longer
              </button>
              <button
                onClick={() => setTranslateMenuOpen(!translateMenuOpen)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted"
              >
                <span>🌐 Translate</span>
                <Languages className="h-3 w-3 text-muted-foreground" />
              </button>
              {translateMenuOpen && (
                <div className="pl-2 pb-1 flex flex-wrap gap-1">
                  {["Spanish", "French", "German", "Japanese", "Portuguese"].map(lang => (
                    <button
                      key={lang}
                      onClick={() => runToolbarAction("translate", lang)}
                      className="px-1.5 py-0.5 rounded-full bg-muted hover:bg-accent border border-border text-[10px]"
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => runToolbarAction("extract_tasks")}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted"
              >
                <ListChecks className="h-3 w-3" />
                Extract Tasks
              </button>
            </div>
          )}

        </BubbleMenu>
      )}

      <AiPanel state={ai.panel} onClose={ai.close} onApply={ai.apply} onRetry={ai.retry} onSubmitPrompt={ai.submitPrompt} />

      {/* Editor Main Canvas */}
      <div className="py-4" onClickCapture={event => {
        if (!event.ctrlKey && !event.metaKey) return;
        const target = event.target as HTMLElement;
        const link = target.closest("a[href^='/editor/']") as HTMLAnchorElement | null;
        if (link) { event.preventDefault(); router.push(link.getAttribute("href")!); }
      }}>
        <EditorContent editor={editor} />
      </div>
      <Dialog open={linkPickerOpen} onOpenChange={setLinkPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link to a page</DialogTitle></DialogHeader>
          <input autoFocus aria-label="Find page" value={linkQuery} onChange={event => setLinkQuery(event.target.value)} placeholder="Search pages" className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
          <div className="max-h-60 overflow-y-auto space-y-1">{linkChoices.filter(choice => choice.title.toLowerCase().includes(linkQuery.toLowerCase())).map(choice => <button key={choice.id} onClick={() => insertPageLink(choice)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted">{choice.icon || "📄"} {choice.title}</button>)}</div>
          <p className="text-xs text-muted-foreground">Ctrl+click a page link in the editor to open it.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
