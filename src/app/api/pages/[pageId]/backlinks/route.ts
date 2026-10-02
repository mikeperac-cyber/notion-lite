import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function linksTo(value: unknown, target: string): boolean {
  if (!value || typeof value !== "object") return false;
  const node = value as Record<string, unknown>;
  if (Array.isArray(node.marks) && node.marks.some(mark => {
    const entry = mark as { type?: string; attrs?: { href?: string } };
    return entry.type === "link" && entry.attrs?.href === target;
  })) return true;
  return Array.isArray(node.content) && node.content.some(child => linksTo(child, target));
}

export async function GET(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const target = `/editor/${(await params).pageId}`;
    const candidates = await prisma.block.findMany({
      where: { content: { contains: target }, page: { isArchived: false } },
      select: { content: true, page: { select: { id: true, title: true, icon: true } } },
    });
    const pages = new Map<string, { id: string; title: string; icon: string | null }>();
    for (const block of candidates) {
      if (block.page.id === (await params).pageId) continue;
      try {
        if (linksTo(JSON.parse(block.content).node, target)) pages.set(block.page.id, block.page);
      } catch {}
    }
    return NextResponse.json({ pages: Array.from(pages.values()) });
  } catch (error: any) {
    console.error("List Backlinks Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list backlinks" }, { status: 500 });
  }
}
