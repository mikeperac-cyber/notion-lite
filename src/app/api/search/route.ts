import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSearch, rebuildSearch } from "@/lib/search";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 200);
    if (!query) return NextResponse.json({ results: [] });
    await ensureSearch();
    const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>("SELECT count(*) AS count FROM page_search");
    if (Number(count[0]?.count || 0) === 0) await rebuildSearch();
    const tokens = query.match(/[A-Za-z0-9À-ž]+/g)?.slice(0, 8) || [];
    if (!tokens.length) return NextResponse.json({ results: [] });
    const expression = tokens.map(token => `"${token.replace(/"/g, "")}"*`).join(" AND ");
    const rows = await prisma.$queryRawUnsafe<Array<{ pageId: string; title: string; snippet: string }>>(
      "SELECT pageId, title, snippet(page_search, 2, '[', ']', '…', 12) AS snippet FROM page_search WHERE page_search MATCH ? ORDER BY bm25(page_search) LIMIT 40", expression
    );
    return NextResponse.json({ results: rows });
  } catch (error) {
    console.error("Search failed", error);
    return NextResponse.json({ error: "Search unavailable" }, { status: 500 });
  }
}
