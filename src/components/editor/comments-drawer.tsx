"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Clock,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CommentSchema } from "@/types";

interface CommentsDrawerProps {
  pageId: string;
}

export function CommentsDrawer({ pageId }: CommentsDrawerProps) {
  const { commentsDrawerOpen, setCommentsDrawerOpen } = useAppStore();
  const [comments, setComments] = useState<CommentSchema[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState("You");
  const [loading, setLoading] = useState(false);

  const fetchComments = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/pages/${pageId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  }, [pageId]);

  useEffect(() => {
    if (commentsDrawerOpen && pageId) {
      fetchComments();
    }
  }, [commentsDrawerOpen, pageId, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
          authorName: authorName.trim() || "You",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Failed to submit comment:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/pages/${pageId}/comments?commentId=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  if (!commentsDrawerOpen) return null;

  return (
    <div className="fixed top-0 right-0 z-50 h-screen w-80 bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold">Page Comments ({comments.length})</span>
        </div>
        <button
          onClick={() => setCommentsDrawerOpen(false)}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
          title="Close comments"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1 p-3">
        {comments.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <MessageSquare className="h-8 w-8 stroke-1 text-zinc-400" />
            <p className="text-sm font-medium">No comments yet</p>
            <p className="text-xs text-zinc-500">
              Leave feedback, notes, or collaborate with your team below.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 rounded-lg border border-border bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-[10px]">
                      {comment.authorName[0]?.toUpperCase() || "U"}
                    </div>
                    <span>{comment.authorName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-500 transition-all"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input Composer */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/50 space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment or thought..."
          className="w-full text-xs p-2 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-16"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Your name"
            className="text-[11px] px-2 py-1 rounded border border-border bg-background w-24 outline-none text-muted-foreground"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newComment.trim() || loading}
            className="h-7 text-xs px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Send className="h-3 w-3 mr-1" />
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
