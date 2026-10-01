import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSearchPage } from "@/lib/search";
import { ensureSyncedTable } from "@/lib/schema-upgrade";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pageId, changedBlocks, deletedBlockIds } = body;

    if (!pageId) {
      return NextResponse.json({ error: "Invalid payload: missing pageId" }, { status: 400 });
    }

    await ensureSyncedTable();
    await prisma.$transaction(async (tx) => {
      const latest = await tx.pageSnapshot.findFirst({ where: { pageId }, orderBy: { createdAt: "desc" } });
      if (!latest || Date.now() - latest.createdAt.getTime() >= 5 * 60 * 1000) {
        const previous = await tx.page.findUnique({ where: { id: pageId }, include: { blocks: { orderBy: { order: "asc" } } } });
        if (previous) {
          await tx.pageSnapshot.create({ data: { pageId, title: previous.title, content: JSON.stringify(previous.blocks) } });
          const old = await tx.pageSnapshot.findMany({ where: { pageId }, orderBy: { createdAt: "desc" }, skip: 100, select: { id: true } });
          if (old.length) await tx.pageSnapshot.deleteMany({ where: { id: { in: old.map(snapshot => snapshot.id) } } });
        }
      }
      // 1. Delete removed blocks in a single batch
      if (deletedBlockIds && deletedBlockIds.length > 0) {
        await tx.block.deleteMany({
          where: { id: { in: deletedBlockIds }, pageId },
        });
      }

      // 2. Upsert changed blocks
      if (changedBlocks && changedBlocks.length > 0) {
        // Single batched lookup replaces N per-block findUnique calls.
        const knownIds = changedBlocks
          .filter((b: any) => b.id && !String(b.id).startsWith("temp-"))
          .map((b: any) => b.id);
        const known = knownIds.length
          ? await tx.block.findMany({ where: { id: { in: knownIds } }, select: { id: true, pageId: true } })
          : [];
        const knownPages = new Map(known.map(block => [block.id, block.pageId]));
        for (const b of changedBlocks) {
          const isTempId = b.id && b.id.startsWith("temp-");
          const blockId = isTempId ? undefined : b.id;
          const contentStr = typeof b.content === "object" ? JSON.stringify(b.content) : String(b.content || "{}");
          if (b.syncedBlockId && b.content?.node?.type === "syncedBlock") {
            await tx.syncedContent.upsert({ where: { id: b.syncedBlockId }, create: { id: b.syncedBlockId, content: JSON.stringify(b.content.node) }, update: { content: JSON.stringify(b.content.node) } });
          }

          if (blockId) {
            if (knownPages.has(blockId) && knownPages.get(blockId) !== pageId) throw new Error("Block belongs to another page");
            await tx.block.upsert({
              where: { id: blockId },
              update: {
                type: b.type || "paragraph",
                content: contentStr,
                order: b.order,
                syncedBlockId: b.syncedBlockId || null,
              },
              create: {
                id: blockId,
                pageId,
                type: b.type || "paragraph",
                content: contentStr,
                order: b.order,
                parentId: b.parentId || null,
                syncedBlockId: b.syncedBlockId || null,
              },
            });
          } else {
            await tx.block.create({
              data: {
                pageId,
                type: b.type || "paragraph",
                content: contentStr,
                order: b.order,
                parentId: b.parentId || null,
                syncedBlockId: b.syncedBlockId || null,
              },
            });
          }
        }
      }
    });

    await refreshSearchPage(pageId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Save Blocks Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save blocks" },
      { status: 500 }
    );
  }
}
