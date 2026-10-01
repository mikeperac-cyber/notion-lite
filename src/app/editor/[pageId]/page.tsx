"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { PageHeader } from "@/components/editor/page-header";
import { PageOrganizer } from "@/components/editor/page-organizer";
import { BlockEditor } from "@/components/editor/block-editor";
import { DatabaseContainer } from "@/components/database/database-container";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageSchema } from "@/types";
import { useAppStore } from "@/lib/store";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

// Code-split heavy modals and drawers for faster initial page render
const SearchModal = dynamic(() => import("@/components/search/search-modal").then(mod => mod.SearchModal), { ssr: false });
const TemplateModal = dynamic(() => import("@/components/templates/template-modal").then(mod => mod.TemplateModal), { ssr: false });
const AiChatDrawer = dynamic(() => import("@/components/ai/ai-chat-drawer").then(mod => mod.AiChatDrawer), { ssr: false });
const TableOfContents = dynamic(() => import("@/components/editor/table-of-contents").then(mod => mod.TableOfContents), { ssr: false });

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = params.pageId as string;
  const { setActivePageId } = useAppStore();

  const [page, setPage] = useState<PageSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/pages/${pageId}`);
      if (!res.ok) {
        throw new Error("Page not found");
      }
      const data = await res.json();
      setPage(data);
      setActivePageId(pageId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pageId, setActivePageId]);

  useEffect(() => {
    if (pageId) {
      loadPage();
    }
  }, [pageId, loadPage]);

  const handleUpdatePage = async (updates: Partial<PageSchema>) => {
    if (!page) return;
    const previous = page;
    setPage((prev) => (prev ? { ...prev, ...updates } : null));

    try {
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Could not save page changes");
    } catch (err) {
      console.error("Update page failed", err);
      setPage(previous);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto flex flex-col relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              Loading page...
            </div>
          </div>
        ) : error || !page ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold">Page not found</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              This page may have been moved or deleted.
            </p>
            <Button size="sm" onClick={() => router.push("/")}>
              Return to Workspace
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col pb-24">
            {/* Page Header (Cover, Icon, Title, Publish) */}
            <PageHeader page={page} onUpdate={handleUpdatePage} />
            <PageOrganizer key={page.id} pageId={page.id} initialParentId={page.parentId || null} />

            {/* Page Body Container with dynamic width and typography */}
            <div
              className={`w-full transition-all duration-200 ${
                page.fullWidth ? "max-w-7xl px-10 mx-auto" : "max-w-4xl mx-auto px-8"
              } ${
                page.fontStyle === "serif"
                  ? "font-serif"
                  : page.fontStyle === "mono"
                  ? "font-mono"
                  : "font-sans"
              }`}
            >
              {/* Full-Page Relational Database (if this page is a database) */}
              {page.database ? (
                <ErrorBoundary fallbackTitle="Error loading Database View">
                  <DatabaseContainer
                    database={page.database}
                    onRefresh={loadPage}
                  />
                </ErrorBoundary>
              ) : null}

              {/* Block Editor (Rich prose, tasks, callouts, code blocks) */}
              <div className="mt-4">
                <ErrorBoundary fallbackTitle="Error loading Block Editor">
                  <BlockEditor
                    key={page.id}
                    pageId={page.id}
                    initialBlocks={page.blocks}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        )}

        {/* Global Modals & Drawers (Lazy loaded) */}
        <SearchModal />
        <TemplateModal />
        <AiChatDrawer />
        <TableOfContents />
      </main>
    </div>
  );
}
