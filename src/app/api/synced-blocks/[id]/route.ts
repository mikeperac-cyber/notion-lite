import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSyncedTable } from "@/lib/schema-upgrade";
import { parseJson } from "@/lib/safe-json";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSyncedTable();
    const content = await prisma.syncedContent.findUnique({ where: { id: (await params).id } });
    if (!content) return NextResponse.json({ error: "Synced block not found" }, { status: 404 });
    const node = parseJson(content.content, null);
    if (!node) return NextResponse.json({ error: "Synced block content is invalid" }, { status: 500 });
    return NextResponse.json({ node });
  } catch (error: any) {
    console.error("Get Synced Block Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load synced block" }, { status: 500 });
  }
}
