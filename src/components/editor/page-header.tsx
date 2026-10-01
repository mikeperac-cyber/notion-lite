/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Smile,
  Image as ImageIcon,
  Globe,
  Share2,
  Trash2,
  Check,
  Copy,
  ExternalLink,
  Download,
  CopyPlus,
  HelpCircle,
  Clock,
  Star,
  MessageSquare,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { PageSchema } from "@/types";
import { parseJsonObject } from "@/lib/safe-json";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageExportModal } from "./page-export-modal";
import { ShortcutsModal } from "./shortcuts-modal";
import { PageHistoryModal } from "./page-history-modal";
import { CommentsDrawer } from "./comments-drawer";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  page: PageSchema;
  onUpdate: (updates: Partial<PageSchema>) => void;
}

const EMOJI_PRESETS = [
  "📄", "📝", "🚀", "💡", "🎯", "⚡", "✨", "🔥", "📌", "📐",
  "📊", "📈", "📚", "🎨", "💼", "🛠️", "⭐", "🏆", "🌟", "💻",
  "🧠", "🤖", "🌐", "🔒", "🔑", "🔍", "📅", "🏷️", "📦", "🔮"
];

export function PageHeader({ page, onUpdate }: PageHeaderProps) {
  const router = useRouter();
  const { updatePageInTree, addPageToTree, removePageFromTree, setTrashCount, setCommentsDrawerOpen } = useAppStore();
  const [title, setTitle] = useState(page.title);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  useEffect(() => {
    const openDesktopExport = () => setExportModalOpen(true);
    window.addEventListener("desktop-export", openDesktopExport);
    return () => window.removeEventListener("desktop-export", openDesktopExport);
  }, []);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const handleMoveToTrash = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not move the page to Trash");
      removePageFromTree(page.id);
      setTrashCount(useAppStore.getState().trashCount + 1);
      window.dispatchEvent(new Event("pages-meta-updated"));
      router.push("/");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not move the page to Trash");
      setDeleting(false);
    }
  };
  const chooseCover = async () => {
    const picked = await window.electronAPI?.pickAttachment();
    if (picked) handleSetCover(picked.url);
  };

  // Sync title when page prop changes
  React.useEffect(() => {
    setTitle(page.title);
  }, [page.title]);

  const handleToggleFavorite = () => {
    const nextState = !page.isFavorite;
    onUpdate({ isFavorite: nextState });
    updatePageInTree(page.id, { isFavorite: nextState });
  };

  const handleSetFont = (fontStyle: "sans" | "serif" | "mono") => {
    onUpdate({ fontStyle });
    updatePageInTree(page.id, { fontStyle });
  };

  const handleToggleFullWidth = () => {
    const nextState = !page.fullWidth;
    onUpdate({ fullWidth: nextState });
    updatePageInTree(page.id, { fullWidth: nextState });
  };

  // Compute live task progress (memoized: scans blocks only when they change;
  // safe-parse guards a corrupt block from crashing the whole header)
  const taskProgress = React.useMemo(() => {
    if (!page.blocks || page.blocks.length === 0) return null;
    let total = 0;
    let completed = 0;
    page.blocks.forEach((b) => {
      if (b.type === "todo") {
        total++;
        const c = typeof b.content === "string" ? parseJsonObject(b.content) : b.content;
        if (c.checked) completed++;
      }
    });
    if (total === 0) return null;
    const percent = Math.round((completed / total) * 100);
    return { total, completed, percent };
  }, [page.blocks]);

  // Compute live word count & reading time (memoized)
  const wordCount = React.useMemo(() => {
    if (!page.blocks || page.blocks.length === 0) return 0;
    let words = 0;
    page.blocks.forEach((b) => {
      const c = typeof b.content === "string" ? parseJsonObject(b.content) : b.content;
      const text = c.text || c.code || "";
      if (text) {
        words += text.trim().split(/\s+/).filter(Boolean).length;
      }
    });
    return words;
  }, [page.blocks]);
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    if (title !== page.title) {
      onUpdate({ title: title.trim() || "Untitled" });
      updatePageInTree(page.id, { title: title.trim() || "Untitled" });
    }
  };

  const handleSetIcon = (icon: string) => {
    onUpdate({ icon });
    updatePageInTree(page.id, { icon });
  };

  const handleSetCover = (cover: string | null) => {
    onUpdate({ cover });
    updatePageInTree(page.id, { cover });
  };

  const handleTogglePublish = () => {
    const nextState = !page.isPublished;
    const slug = nextState
      ? page.slug || `${page.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${page.id.slice(-6)}`
      : page.slug;
    onUpdate({ isPublished: nextState, slug });
    updatePageInTree(page.id, { isPublished: nextState, slug });
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/pages/${page.id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Could not duplicate page");
      const duplicated = await res.json();
      if (!duplicated?.id) throw new Error("Could not duplicate page");
      addPageToTree(duplicated);
      router.push(`/editor/${duplicated.id}`);
    } catch (err) {
      console.error(err);
      window.alert("Could not duplicate this page. Try again.");
    } finally {
      setDuplicating(false);
    }
  };

  const publicUrl = typeof window !== "undefined" && page.slug
    ? `${window.location.origin}/site/${page.slug}`
    : "";

  const copyPublishLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full relative group/header">
      {/* Cover Image Container */}
      {page.cover ? (
        <div className="relative w-full h-48 md:h-60 overflow-hidden group/cover">
          <img
            src={page.cover}
            alt="Page cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-4 flex items-center gap-1.5 opacity-0 group-hover/cover:opacity-100 transition-opacity bg-background/80 backdrop-blur rounded-lg p-1 border border-border">
            <Button size="xs" variant="ghost" className="text-xs h-6" onClick={chooseCover}>Change cover</Button>

            <Button
              size="xs"
              variant="ghost"
              onClick={() => handleSetCover(null)}
              className="text-xs h-6 text-destructive hover:text-destructive"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : null}

      {/* Main Content Area Container */}
      <div className="max-w-4xl mx-auto px-8 pt-4">
        {/* Top Actions Bar (Publish, Add Cover, Add Icon, Export, Duplicate) */}
        <div className="flex items-center justify-between py-2 text-xs text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {!page.icon && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="xs" className="h-6 gap-1">
                    <Smile className="h-3.5 w-3.5" />
                    Add icon
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2">
                  <div className="grid grid-cols-6 gap-1">
                    {EMOJI_PRESETS.map((e, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSetIcon(e)}
                        className="text-xl p-1.5 hover:bg-muted rounded"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {!page.cover && (
              <Button variant="ghost" size="xs" className="h-6 gap-1" onClick={chooseCover} disabled={typeof window === "undefined" || !window.electronAPI}>
                <ImageIcon className="h-3.5 w-3.5" /> Add cover
              </Button>
            )}

            {wordCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-0.5 rounded bg-muted/30">
                <Clock className="h-3 w-3" />
                {wordCount} words ({readingTimeMinutes} min read)
              </span>
            )}

            {taskProgress && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>{taskProgress.completed}/{taskProgress.total} ({taskProgress.percent}%)</span>
                <div className="w-10 h-1.5 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${taskProgress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              title={page.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              className="h-7 w-7"
            >
              <Star className={cn("h-4 w-4", page.isFavorite ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
            </Button>

            <Button
              variant="ghost"
              size="xs"
              onClick={() => setCommentsDrawerOpen(true)}
              title="Page Comments & Discussion"
              className="h-7 text-xs gap-1"
            >
              <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
              Comments
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Typography & layout">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Typography</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleSetFont("sans")}>
                  <span className="font-sans text-xs">Default (Sans)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetFont("serif")}>
                  <span className="font-serif text-xs">Serif (Editorial)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetFont("mono")}>
                  <span className="font-mono text-xs">Mono (Technical)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleToggleFullWidth}>
                  <span className="text-xs">{page.fullWidth ? "Standard Width" : "Full Width"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="xs"
              onClick={handleDuplicate}
              disabled={duplicating}
              title="Duplicate page with blocks & database"
              className="h-7 text-xs gap-1"
            >
              <CopyPlus className="h-3.5 w-3.5" />
              Duplicate
            </Button>

            <Button
              variant="ghost"
              size="xs"
              onClick={() => setExportModalOpen(true)}
              title="Export as Markdown, HTML or JSON"
              className="h-7 text-xs gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setHistoryOpen(true)} className="h-7 text-xs">History</Button>
            <Button variant="ghost" size="xs" onClick={() => setDeleteDialogOpen(true)} disabled={deleting} title="Move this page to Trash" className="h-7 text-xs gap-1 text-red-600 hover:text-red-700">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShortcutsModalOpen(true)}
              title="Keyboard Shortcuts"
              className="h-7 w-7 text-muted-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>

            {page.isPublished && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full font-medium">
                <Globe className="h-3 w-3" />
                Live on Web
              </span>
            )}

            <Button
              variant="outline"
              size="xs"
              onClick={() => setPublishModalOpen(true)}
              className="h-7 text-xs gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          </div>
        </div>

        {/* Page Icon (Positioned relative to cover or inline) */}
        {page.icon && (
          <div className={`${page.cover ? "-mt-10 mb-2" : "mt-2 mb-2"}`}>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-4xl p-1 rounded-lg hover:bg-muted transition-transform active:scale-95">
                  {page.icon}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <div className="grid grid-cols-6 gap-1">
                  {EMOJI_PRESETS.map((e, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSetIcon(e)}
                      className="text-xl p-1.5 hover:bg-muted rounded"
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="pt-2 mt-2 border-t border-border flex justify-end">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleSetIcon("")}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    Remove Icon
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Title Input */}
        <input
          value={title}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          placeholder="Untitled"
          className="w-full text-3xl md:text-4xl font-bold bg-transparent outline-none border-none placeholder:text-muted-foreground/40 text-foreground py-2 transition-all"
        />
      </div>

      {/* Share / Publish Modal */}
      <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-500" />
              Publish to Web
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Publishing will make this page viewable by anyone with the link. They cannot edit your content.
            </p>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold">Publish to web</span>
                <p className="text-xs text-muted-foreground">
                  {page.isPublished ? "Page is currently public" : "Page is currently private"}
                </p>
              </div>
              <Button
                size="sm"
                variant={page.isPublished ? "destructive" : "default"}
                onClick={handleTogglePublish}
              >
                {page.isPublished ? "Unpublish" : "Publish"}
              </Button>
            </div>

            {page.isPublished && publicUrl && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Public Web Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={publicUrl}
                    className="flex-1 text-xs bg-muted p-2 rounded-md border border-border outline-none font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={copyPublishLink}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(publicUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Move page to Trash?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{page.title || "Untitled"} can be restored from Trash.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleMoveToTrash()} disabled={deleting}>{deleting ? "Moving..." : "Move to Trash"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <PageExportModal
        page={page}
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
      />
      <PageHistoryModal pageId={page.id} open={historyOpen} onOpenChange={setHistoryOpen} />

      {/* Shortcuts Modal */}
      <ShortcutsModal
        open={shortcutsModalOpen}
        onOpenChange={setShortcutsModalOpen}
      />

      {/* Comments Drawer */}
      <CommentsDrawer pageId={page.id} />
    </div>
  );
}
