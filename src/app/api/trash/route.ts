import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSearchPage, rebuildSearch } from "@/lib/search";

// GET /api/trash - list all archived pages
export async function GET() {
  try {
    const pages = await prisma.page.findMany({
      where: { isArchived: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        icon: true,
        updatedAt: true,
        databaseId: true,
      },
    });

    return NextResponse.json({ pages });
  } catch (error: any) {
    console.error("Trash API GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch trash" },
      { status: 500 }
    );
  }
}

// POST /api/trash - actions: restore or empty
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, pageId } = body;

    if (action === "restore" && pageId) {
      const restored = await prisma.page.update({
        where: { id: pageId },
        data: { isArchived: false },
      });
      await refreshSearchPage(pageId);
      return NextResponse.json({ success: true, restored });
    }

    if (action === "empty") {
      await prisma.page.deleteMany({
        where: { isArchived: true },
      });
      await rebuildSearch();
      return NextResponse.json({ success: true, emptied: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Trash API POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process trash action" },
      { status: 500 }
    );
  }
}
