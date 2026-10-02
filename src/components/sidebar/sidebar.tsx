"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  Sparkles,
  LayoutTemplate,
  Plus,
  Table as TableIcon,
  FilePlus,
  PanelLeftClose,
  PanelLeft,
  Moon,
  Sun,
  Laptop,
  Star,
  Trash2,
  Settings,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { PageItem } from "./page-item";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrashModal } from "@/components/modals/trash-modal";
import { SettingsModal } from "@/components/modals/settings-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageSchema } from "@/types";

export function Sidebar() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [taggedPages, setTaggedPages] = useState<Array<{ id: string; title: string; icon: string | null; tags: string[] }>>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const {
    currentWorkspace,
    setCurrentWorkspace,
    pagesTree,
    setPagesTree,
    sidebarOpen,
    toggleSidebar,
    setSearchModalOpen,
    setTemplateModalOpen,
    setAiChatOpen,
    setTrashModalOpen,
    trashCount,
    setTrashCount,
    setSettingsOpen,
  } = useAppStore();

  const loadWorkspace = React.useCallback(async () => {
    try {
      const res = await fetch("/api/workspace");
      if (res.ok) {
        const data = await res.json();
        setCurrentWorkspace(data.workspace);
        setPagesTree(data.pages);
        if (data.trashCount !== undefined) {
          setTrashCount(data.trashCount);
        }
      }
    } catch (err) {
      console.error("Failed to load workspace", err);
    }
  }, [setCurrentWorkspace, setPagesTree, setTrashCount]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) return;
        const data = await response.json();
        setAvailableTags(data.tags || []);
        setTaggedPages(data.pages || []);
      } catch {}
    };
    void loadTags();
    window.addEventListener("pages-meta-updated", loadTags);
    return () => window.removeEventListener("pages-meta-updated", loadTags);
  }, []);

  const handleCreatePage = async (isDatabase = false) => {
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isDatabase,
          workspaceId: currentWorkspace?.id,
          title: isDatabase ? "New Database" : "Untitled",
        }),
      });
      if (res.ok) {
        const newPage = await res.json();
        await loadWorkspace();
        router.push(`/editor/${newPage.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getFavoritePages = (pages: PageSchema[]): PageSchema[] => {
    let favs: PageSchema[] = [];
    for (const p of pages) {
      if (p.isFavorite) favs.push(p);
      if (p.children && p.children.length > 0) {
        favs = favs.concat(getFavoritePages(p.children));
      }
    }
    return favs;
  };

  const favoritePages = getFavoritePages(pagesTree);

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-3 left-3 z-40 p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 bg-background/80 backdrop-blur shadow-sm border border-border"
        title="Open sidebar"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      <aside className="w-64 h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900/90 border-r border-border select-none text-zinc-700 dark:text-zinc-300">
        {/* Workspace Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {currentWorkspace?.icon || "🚀"}
            </div>
            <span className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100">
              {currentWorkspace?.name || "Notion Lite"}
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            title="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="p-2 space-y-0.5">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <Search className="h-4 w-4 text-zinc-400" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-[10px] bg-zinc-200/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">
              ⌘K
            </kbd>
          </button>

          <button
            onClick={() => setAiChatOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span className="flex-1 text-left font-semibold">Workspace AI</span>
          </button>

          <button
            onClick={() => setTemplateModalOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <LayoutTemplate className="h-4 w-4 text-zinc-400" />
            <span className="flex-1 text-left">Templates</span>
          </button>

          <button
            onClick={() => setTrashModalOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors text-zinc-600 dark:text-zinc-400"
          >
            <Trash2 className="h-4 w-4 text-zinc-400" />
            <span className="flex-1 text-left">Trash</span>
            {trashCount > 0 && (
              <span className="text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold px-1.5 py-0.5 rounded-full">
                {trashCount}
              </span>
            )}
          </button>
        </div>

        {/* Pages Navigation Tree */}
        <div className="flex-1 overflow-hidden flex flex-col pt-2">
          {availableTags.length > 0 && <div className="px-3 pb-2 border-b border-border/50">
            <p className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase mb-1">Tags</p>
            <div className="flex flex-wrap gap-1">{availableTags.map(tag => <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} className={`rounded-full px-2 py-0.5 text-[11px] ${activeTag === tag ? "bg-indigo-600 text-white" : "bg-zinc-200 dark:bg-zinc-800"}`}>{tag}</button>)}</div>
          </div>}
          {activeTag ? <ScrollArea className="flex-1 px-2"><div className="py-2 space-y-1">
            <button onClick={() => setActiveTag(null)} className="text-xs text-indigo-600 px-2 py-1">Clear tag filter</button>
            {taggedPages.filter(page => page.tags.includes(activeTag)).map(page => <Link key={page.id} href={`/editor/${page.id}`} className="block rounded px-2 py-1 text-xs hover:bg-muted">{page.icon || "📄"} {page.title}</Link>)}
          </div></ScrollArea> : <>
          {/* Favorites Section */}
          {favoritePages.length > 0 && (
            <div className="mb-2">
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-amber-500 uppercase flex items-center gap-1.5">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span>Favorites</span>
              </div>
              <div className="space-y-0.5 px-1">
                {favoritePages.map((fav) => (
                  <Link
                    key={`fav-${fav.id}`}
                    href={`/editor/${fav.id}`}
                    className="flex items-center gap-2 py-1 px-2.5 rounded-md text-xs font-medium hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    <span className="text-sm leading-none">{fav.icon || "📄"}</span>
                    <span className="truncate">{fav.title || "Untitled"}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            <span>Pages & Documents</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCreatePage(false)}
                title="Add Page"
                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1 px-1">
            <div className="space-y-0.5 pr-2">
              {pagesTree.map((page) => (
                <PageItem key={page.id} page={page} />
              ))}

              {pagesTree.length === 0 && (
                <p className="text-xs text-zinc-400 px-3 py-4 italic">
                  No pages yet. Create one below!
                </p>
              )}
            </div>
          </ScrollArea>
          </>}
        </div>

        {/* Footer Actions */}
        <div className="p-2 border-t border-border/60 space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCreatePage(false)}
              className="w-full justify-start text-xs h-8 px-2 text-zinc-600 dark:text-zinc-400"
            >
              <FilePlus className="h-3.5 w-3.5 mr-1.5" />
              + Page
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCreatePage(true)}
              className="w-full justify-start text-xs h-8 px-2 text-zinc-600 dark:text-zinc-400"
            >
              <TableIcon className="h-3.5 w-3.5 mr-1.5" />
              + Database
            </Button>
          </div>

          <div className="flex items-center justify-between px-2 pt-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSettingsOpen(true)}
              title="AI Settings"
            >
              <Settings className="h-3.5 w-3.5 text-zinc-400" />
              <span className="sr-only">Settings</span>
            </Button>
            <span className="text-[11px] text-zinc-400">Theme</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="h-3.5 w-3.5 mr-2" /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="h-3.5 w-3.5 mr-2" /> Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Laptop className="h-3.5 w-3.5 mr-2" /> System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
      <TrashModal />
      <SettingsModal />
    </>
  );
}
