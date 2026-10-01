"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  MoreHorizontal,
  Plus,
  Trash2,
  Copy,
  Star,
} from "lucide-react";
import { PageSchema } from "@/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PageItemProps {
  page: PageSchema;
  depth?: number;
}

export function PageItem({ page, depth = 0 }: PageItemProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { activePageId, removePageFromTree, setPagesTree, updatePageInTree, setTrashCount } = useAppStore();
  const isActive = activePageId === page.id;
  const hasChildren = page.children && page.children.length > 0;
  const isDatabase = Boolean(page.databaseId || page.database);
  const refreshWorkspace = async () => {
    const response = await fetch("/api/workspace");
    if (!response.ok) throw new Error("Could not refresh pages");
    const workspace = await response.json();
    setPagesTree(workspace.pages || []);
    setTrashCount(workspace.trashCount || 0);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsExpanded(!isExpanded);
  };

  const handleCreateSubpage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: page.id,
          title: "Untitled",
          workspaceId: page.workspaceId,
        }),
      });
      if (!res.ok) throw new Error("Could not create a subpage");
      const newPage = await res.json();
      setIsExpanded(true);
      await refreshWorkspace();
      router.push(`/editor/${newPage.id}`);
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : "Could not create a subpage");
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFav = !page.isFavorite;
    updatePageInTree(page.id, { isFavorite: newFav });
    try {
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: newFav }),
      });
      if (!response.ok) throw new Error("Could not update favorite");
    } catch (err) {
      console.error(err);
      updatePageInTree(page.id, { isFavorite: !newFav });
      window.alert(err instanceof Error ? err.message : "Could not update favorite");
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/pages/${page.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Could not duplicate page");
      const cloned = await res.json();
      await refreshWorkspace();
      router.push(`/editor/${cloned.id}`);
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : "Could not duplicate page");
    }
  };

  const openDeleteDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not move the page to Trash");
      removePageFromTree(page.id);
      await refreshWorkspace();
      window.dispatchEvent(new Event("pages-meta-updated"));
      if (isActive) {
        router.push("/");
      }
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : "Could not move the page to Trash");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center justify-between py-1 px-2 rounded-md text-sm font-medium transition-colors hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300",
          isActive && "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={handleToggle}
            className={cn(
              "p-0.5 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-500 transition-transform",
              isExpanded && "rotate-90",
              !hasChildren && "opacity-0 group-hover:opacity-40"
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <Link href={`/editor/${page.id}`} className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-base leading-none">{page.icon || (isDatabase ? "📊" : "📄")}</span>
            <span className="truncate text-sm">{page.title || "Untitled"}</span>
          </Link>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={openDeleteDialog} aria-label={`Move ${page.title || "Untitled"} to Trash`} title="Move to Trash" className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleToggleFavorite}
            title={page.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            className={cn(
              "p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-400 hover:text-amber-500",
              page.isFavorite && "text-amber-500 opacity-100"
            )}
          >
            <Star className={cn("h-3.5 w-3.5", page.isFavorite && "fill-amber-500")} />
          </button>

          <button
            onClick={handleCreateSubpage}
            title="Add sub-page"
            className="p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-500"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-500"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={handleToggleFavorite}>
                <Star className={cn("h-4 w-4 mr-2", page.isFavorite ? "fill-amber-500 text-amber-500" : "")} />
                {page.isFavorite ? "Remove Favorite" : "Add to Favorites"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openDeleteDialog} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Move page to Trash?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{page.title || "Untitled"} can be restored from Trash.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>{deleting ? "Moving..." : "Move to Trash"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {isExpanded && hasChildren && (
        <div className="flex flex-col">
          {page.children!.map((child) => (
            <PageItem key={child.id} page={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
