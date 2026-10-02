import { prisma } from "@/lib/prisma";

let ready: Promise<void> | null = null;
export function ensureSearch() {
  if (!ready) ready = prisma.$executeRawUnsafe("CREATE VIRTUAL TABLE IF NOT EXISTS page_search USING fts5(pageId UNINDEXED, title, body, tokenize='unicode61')").then(() => undefined).catch(error => { ready = null; throw error; });
  return ready;
}

export function plainText(content: string) {
  try {
    const parsed = JSON.parse(content);
    const collect = (node: any): string => [node?.text || "", ...(node?.content || []).map(collect)].join(" ");
    return [parsed.text || "", collect(parsed.node), parsed.node?.attrs?.source || "", parsed.node?.attrs?.title || "", parsed.node?.attrs?.url || ""].join(" ");
  } catch { return ""; }
}

export async function refreshSearchPage(pageId: string) {
  await ensureSearch();
  const page = await prisma.page.findUnique({ where: { id: pageId }, include: { blocks: true } });
  await prisma.$executeRawUnsafe("DELETE FROM page_search WHERE pageId = ?", pageId);
  if (page && !page.isArchived) {
    await prisma.$executeRawUnsafe("INSERT INTO page_search(pageId, title, body) VALUES (?, ?, ?)", pageId, page.title, page.blocks.map(block => plainText(block.content)).join("\n"));
  }
}

export async function rebuildSearch() {
  await ensureSearch();
  await prisma.$executeRawUnsafe("DELETE FROM page_search");
  const pages = await prisma.page.findMany({ where: { isArchived: false }, include: { blocks: true } });
  for (const page of pages) await prisma.$executeRawUnsafe("INSERT INTO page_search(pageId, title, body) VALUES (?, ?, ?)", page.id, page.title, page.blocks.map(block => plainText(block.content)).join("\n"));
}

export async function findRelevantPages(query: string, limit = 5) {
  await ensureSearch();
  const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>("SELECT count(*) AS count FROM page_search");
  if (Number(count[0]?.count || 0) === 0) await rebuildSearch();
  const tokens = query.match(/[A-Za-z0-9À-ž]+/g)?.filter(token => token.length > 2).slice(0, 8) || [];
  if (!tokens.length) return [];
  const expression = tokens.map(token => `"${token.replace(/"/g, "")}"*`).join(" OR ");
  return prisma.$queryRawUnsafe<Array<{ pageId: string; title: string }>>(
    "SELECT pageId, title FROM page_search WHERE page_search MATCH ? ORDER BY bm25(page_search) LIMIT ?", expression, limit
  );
}
