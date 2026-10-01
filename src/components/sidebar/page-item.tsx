"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Folder,
  MoreHorizontal,
  Plus,
  Trash2,
  Copy,
  Table as TableIcon,
  Star,
} from "lucide-react";
import { PageSchema } from "@/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
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
  const { activePageId, removePageFromTree, addPageToTree, updatePageInTree, trashCount, setTrashCount } = useAppStore();
  const isActive = activePageId === page.id;
  const hasChildren = page.children && page.children.length > 0;
  const isDatabase = Boolean(page.databaseId || page.database);

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
      const newPage = await res.json();
      setIsExpanded(true);
      router.push(`/editor/${newPage.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFav = !page.isFavorite;
    updatePageInTree(page.id, { isFavorite: newFav });
    try {
      await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: newFav }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/pages/${page.id}/duplicate`, { method: "POST" });
      if (res.ok) {
        const cloned = await res.json();
        addPageToTree(cloned);
        router.push(`/editor/${cloned.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
      removePageFromTree(page.id);
      setTrashCount(trashCount + 1);
      if (isActive) {
        router.push("/");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="select-none">
      <Link
        href={`/editor/${page.id}`}
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
          <span className="text-base leading-none">
            {page.icon || (isDatabase ? "📊" : "📄")}
          </span>
          <span className="truncate text-sm">{page.title || "Untitled"}</span>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
              <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Link>

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
