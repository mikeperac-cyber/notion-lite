"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Table as TableIcon, ArrowRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { PageSchema } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SearchModal() {
  const router = useRouter();
  const { searchModalOpen, setSearchModalOpen, pagesTree } = useAppStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [matches, setMatches] = useState<Array<{ pageId: string; title: string; snippet: string }>>([]);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    if (!query.trim()) { setMatches([]); setSearchError(""); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        setMatches((await response.json()).results || []);
        setSearchError("");
      } catch (error: any) { if (error.name !== "AbortError") setSearchError("Search unavailable"); }
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K) — subscribed once, reads
  // fresh state via getState instead of a stale closure.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen(!useAppStore.getState().searchModalOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSearchModalOpen]);

  // Reset selectedIndex on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Flatten page tree (memoized: tree only changes on workspace updates)
  const allPages = useMemo(() => {
    const flatten = (pages: PageSchema[]): PageSchema[] => {
      let list: PageSchema[] = [];
      for (const p of pages) {
        list.push(p);
        if (p.children && p.children.length > 0) {
          list = list.concat(flatten(p.children));
        }
      }
      return list;
    };
    return flatten(pagesTree);
  }, [pagesTree]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allPages;
    const byId = new Map(allPages.map(page => [page.id, page]));
    return matches.map(match => byId.get(match.pageId) || ({ id: match.pageId, title: match.title } as PageSchema));
  }, [query, allPages, matches]);

  const handleSelect = (pageId: string) => {
    setSearchModalOpen(false);
    router.push(`/editor/${pageId}`);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex].id);
    }
  };

  return (
    <Dialog open={searchModalOpen} onOpenChange={setSearchModalOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-border shadow-2xl">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownInput}
            placeholder="Search pages, notes, databases... (↑↓ to navigate, Enter to open)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <ScrollArea className="max-h-80 p-2">
          {searchError && <p role="alert" className="p-2 text-sm text-destructive">{searchError}</p>}
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((page, index) => {
                const isDb = Boolean(page.databaseId || page.database);
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={page.id}
                    onClick={() => handleSelect(page.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors group ${
                      isSelected
                        ? "bg-zinc-200 dark:bg-zinc-800 text-foreground font-semibold shadow-xs"
                        : "hover:bg-accent hover:text-accent-foreground text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base">{page.icon || (isDb ? "📊" : "📄")}</span>
                      <span className="min-w-0"><span className="block truncate">{page.title || "Untitled"}</span>{query.trim() && matches[index]?.snippet && <span className="block truncate text-xs font-normal text-muted-foreground">{matches[index].snippet}</span>}</span>
                    </div>
                    <ArrowRight className={`h-4 w-4 text-muted-foreground transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
