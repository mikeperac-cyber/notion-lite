import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSearchPage } from "@/lib/search";

export async function GET(_request: Request, { params }: { params: { pageId: string } }) {
  const snapshots = await prisma.pageSnapshot.findMany({ where: { pageId: params.pageId }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ snapshots: snapshots.map(snapshot => ({ id: snapshot.id, title: snapshot.title, createdAt: snapshot.createdAt, blocks: JSON.parse(snapshot.content).length })) });
}

export async function POST(request: Request, { params }: { params: { pageId: string } }) {
  const { snapshotId } = await request.json();
  const snapshot = await prisma.pageSnapshot.findFirst({ where: { id: snapshotId, pageId: params.pageId } });
  if (!snapshot) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  const blocks = JSON.parse(snapshot.content);
  if (!Array.isArray(blocks)) return NextResponse.json({ error: "Snapshot is invalid" }, { status: 400 });
  await prisma.$transaction(async tx => {
    const current = await tx.page.findUniqueOrThrow({ where: { id: params.pageId }, include: { blocks: true } });
    await tx.pageSnapshot.create({ data: { pageId: params.pageId, title: current.title, content: JSON.stringify(current.blocks) } });
    await tx.block.deleteMany({ where: { pageId: params.pageId } });
    await tx.page.update({ where: { id: params.pageId }, data: { title: snapshot.title } });
    for (const block of blocks) await tx.block.create({ data: { id: block.id, pageId: params.pageId, type: block.type, content: block.content, order: block.order, syncedBlockId: block.syncedBlockId || null } });
  });
  await refreshSearchPage(params.pageId);
  return NextResponse.json({ success: true });
}
