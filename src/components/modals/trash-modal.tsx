"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  RotateCcw,
  Search,
  AlertTriangle,
  FolderX,
  RefreshCw,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TrashPageItem {
  id: string;
  title: string;
  icon?: string | null;
  updatedAt: string;
  databaseId?: string | null;
}

export function TrashModal() {
  const router = useRouter();
  const { trashModalOpen, setTrashModalOpen, setTrashCount } = useAppStore();
  const [pages, setPages] = useState<TrashPageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);

  const fetchTrashPages = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trash");
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
        setTrashCount(data.pages?.length || 0);
      }
    } catch (err) {
      console.error("Failed to load trash:", err);
    } finally {
      setLoading(false);
    }
  }, [setTrashCount]);

  useEffect(() => {
    if (trashModalOpen) {
      fetchTrashPages();
    }
  }, [trashModalOpen, fetchTrashPages]);

  const handleRestore = async (pageId: string) => {
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", pageId }),
      });
      if (res.ok) {
        setPages((prev) => prev.filter((p) => p.id !== pageId));
        setTrashCount(pages.length - 1);
        // Refresh page tree in workspace
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to restore page:", err);
    }
  };

  const handlePermanentDelete = async (pageId: string) => {
    try {
      const res = await fetch(`/api/pages/${pageId}?permanent=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPages((prev) => prev.filter((p) => p.id !== pageId));
        setTrashCount(pages.length - 1);
      }
    } catch (err) {
      console.error("Failed to permanently delete page:", err);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "empty" }),
      });
      if (res.ok) {
        setPages([]);
        setTrashCount(0);
        setConfirmEmptyOpen(false);
      }
    } catch (err) {
      console.error("Failed to empty trash:", err);
    }
  };

  const filteredPages = pages.filter((p) =>
    (p.title || "Untitled").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={trashModalOpen} onOpenChange={setTrashModalOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-border shadow-2xl">
        <DialogHeader className="p-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-500" />
              <DialogTitle className="text-base font-semibold">
                Trash & Archived Pages
              </DialogTitle>
            </div>
            {pages.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={() => setConfirmEmptyOpen(true)}
              >
                Empty Trash
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Pages in trash can be restored at any time or permanently purged.
          </DialogDescription>
        </DialogHeader>

        {/* Search filter in trash */}
        <div className="flex items-center px-4 py-2 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter trash..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Trash Item List */}
        <ScrollArea className="max-h-96 p-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Loading trash...</span>
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
              <FolderX className="h-8 w-8 stroke-1 text-zinc-400" />
              <p className="font-medium">Trash is empty</p>
              <p className="text-xs text-zinc-500">Deleted pages will appear here.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPages.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <span className="text-base">{item.icon || (item.databaseId ? "📊" : "📄")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-foreground">
                        {item.title || "Untitled"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Archived {new Date(item.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      onClick={() => handleRestore(item.id)}
                      title="Restore page"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      onClick={() => handlePermanentDelete(item.id)}
                      title="Delete permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Confirmation Modal to Empty Trash */}
        {confirmEmptyOpen && (
          <div className="p-4 border-t border-border bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Permanently delete all {pages.length} pages in trash?</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setConfirmEmptyOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={handleEmptyTrash}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
