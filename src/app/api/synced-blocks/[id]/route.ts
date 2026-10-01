import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSyncedTable } from "@/lib/schema-upgrade";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await ensureSyncedTable();
  const content = await prisma.syncedContent.findUnique({ where: { id: params.id } });
  if (!content) return NextResponse.json({ error: "Synced block not found" }, { status: 404 });
  return NextResponse.json({ node: JSON.parse(content.content) });
}
