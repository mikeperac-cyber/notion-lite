import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePageMetaTable } from "@/lib/schema-upgrade";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensurePageMetaTable();
    const metadata = await prisma.pageMeta.findMany({ select: { pageId: true, tags: true } });
    const pages = await prisma.page.findMany({ where: { id: { in: metadata.map(item => item.pageId) }, isArchived: false }, select: { id: true, title: true, icon: true } });
    const pageMap = new Map(pages.map(page => [page.id, page]));
    const taggedPages = metadata.flatMap(item => {
      const page = pageMap.get(item.pageId);
      if (!page) return [];
      try { const tags = JSON.parse(item.tags); return Array.isArray(tags) ? [{ ...page, tags }] : []; }
      catch { return []; }
    });
    const tags = Array.from(new Set<string>(taggedPages.flatMap(page => page.tags))).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ tags, pages: taggedPages });
  } catch (error: any) {
    console.error("List Tags Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list tags" }, { status: 500 });
  }
}
