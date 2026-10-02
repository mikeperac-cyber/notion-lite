/* eslint-disable @next/next/no-img-element */
import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BlockEditor } from "@/components/editor/block-editor";
import { DatabaseContainer } from "@/components/database/database-container";
import { Globe } from "lucide-react";

export const revalidate = 0;

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await prisma.page.findFirst({
    where: {
      slug,
      isPublished: true,
    },
    include: {
      blocks: {
        orderBy: { order: "asc" },
      },
      database: {
        include: {
          properties: {
            orderBy: { order: "asc" },
          },
          rows: {
            orderBy: { order: "asc" },
          },
          views: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!page) {
    notFound();
  }

  const parsedBlocks = page.blocks.map((b) => ({
    ...b,
    content: typeof b.content === "string" ? JSON.parse(b.content || "{}") : b.content,
  }));

  let parsedDatabase: any = null;
  if (page.database) {
    parsedDatabase = {
      ...page.database,
      properties: page.database.properties.map((p) => ({
        ...p,
        config: typeof p.config === "string" ? JSON.parse(p.config || "{}") : p.config,
      })),
      rows: page.database.rows.map((r) => ({
        ...r,
        properties: typeof r.properties === "string" ? JSON.parse(r.properties || "{}") : r.properties,
      })),
      views: page.database.views.map((v) => ({
        ...v,
        filters: typeof v.filters === "string" ? JSON.parse(v.filters || "[]") : v.filters,
        sorts: typeof v.sorts === "string" ? JSON.parse(v.sorts || "[]") : v.sorts,
        grouping: typeof v.grouping === "string" ? JSON.parse(v.grouping || "{}") : v.grouping,
        visibleProps: typeof v.visibleProps === "string" ? JSON.parse(v.visibleProps || "[]") : v.visibleProps,
      })),
    };
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Banner */}
      <header className="border-b border-border py-2.5 px-6 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-indigo-500" />
          <span className="font-medium text-foreground">Notion Lite Public Site</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Published with</span>
          <span className="font-semibold text-foreground">Notion Lite</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
        {page.cover && (
          <div className="w-full h-56 rounded-2xl overflow-hidden mb-6 shadow-sm">
            <img
              src={page.cover}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          {page.icon && <span className="text-4xl">{page.icon}</span>}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {page.title}
          </h1>
        </div>

        {/* Database View if present */}
        {parsedDatabase && (
          <div className="my-8">
            <DatabaseContainer database={parsedDatabase} />
          </div>
        )}

        {/* Blocks in read-only mode */}
        <div className="mt-6">
          <BlockEditor
            pageId={page.id}
            initialBlocks={parsedBlocks as any}
            readOnly={true}
          />
        </div>
      </main>
    </div>
  );
}
