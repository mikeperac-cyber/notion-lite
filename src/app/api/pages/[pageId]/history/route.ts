import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSearchPage } from "@/lib/search";
import { parseJsonArray } from "@/lib/safe-json";

export async function GET(_request: Request, { params }: { params: { pageId: string } }) {
  try {
    const snapshots = await prisma.pageSnapshot.findMany({ where: { pageId: params.pageId }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ snapshots: snapshots.map(snapshot => ({ id: snapshot.id, title: snapshot.title, createdAt: snapshot.createdAt, blocks: parseJsonArray(snapshot.content).length })) });
  } catch (error: any) {
    console.error("List History Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list history" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { pageId: string } }) {
  try {
    const { snapshotId } = await request.json();
    if (typeof snapshotId !== "string") return NextResponse.json({ error: "Missing snapshotId" }, { status: 400 });
    const snapshot = await prisma.pageSnapshot.findFirst({ where: { id: snapshotId, pageId: params.pageId } });
    if (!snapshot) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    const blocks = parseJsonArray(snapshot.content);
    if (!blocks.length && snapshot.content !== "[]") return NextResponse.json({ error: "Snapshot is invalid" }, { status: 400 });
  await prisma.$transaction(async tx => {
    const current = await tx.page.findUniqueOrThrow({ where: { id: params.pageId }, include: { blocks: true } });
    await tx.pageSnapshot.create({ data: { pageId: params.pageId, title: current.title, content: JSON.stringify(current.blocks) } });
    await tx.block.deleteMany({ where: { pageId: params.pageId } });
    await tx.page.update({ where: { id: params.pageId }, data: { title: snapshot.title } });
    for (const block of blocks) await tx.block.create({ data: { id: block.id, pageId: params.pageId, type: block.type, content: block.content, order: block.order, syncedBlockId: block.syncedBlockId || null } });
  });
  await refreshSearchPage(params.pageId);
  return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Restore History Error:", error);
    return NextResponse.json({ error: error.message || "Failed to restore snapshot" }, { status: 500 });
  }
}
