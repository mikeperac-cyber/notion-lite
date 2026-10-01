import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET() {
  const databases = await prisma.database.findMany({ include: { page: { select: { title: true } }, properties: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ databases: databases.map(database => ({ id: database.id, title: database.page?.title || database.title, properties: database.properties.map(property => ({ ...property, config: JSON.parse(property.config || "{}") })) })) });
}
