import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const pages = await prisma.page.findMany({
    where: { isArchived: false, row: null },
    select: { id: true, title: true, icon: true, parentId: true },
    orderBy: { title: "asc" },
  });
  return NextResponse.json({ pages });
}
