import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonObject } from "@/lib/safe-json";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const databases = await prisma.database.findMany({ include: { page: { select: { title: true } }, properties: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ databases: databases.map(database => ({ id: database.id, title: database.page?.title || database.title, properties: database.properties.map(property => ({ ...property, config: parseJsonObject(property.config) })) })) });
  } catch (error: any) {
    console.error("List Database Choices Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list databases" }, { status: 500 });
  }
}
