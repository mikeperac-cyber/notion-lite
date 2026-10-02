import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonObject } from "@/lib/safe-json";

export async function GET(request: Request, { params }: { params: Promise<{ databaseId: string }> }) {
  try {
    const search = new URL(request.url).searchParams;
    const rowId = search.get("rowId") || "";
    const propertyId = search.get("propertyId") || "";
    if (!rowId || !propertyId) return NextResponse.json({ error: "Missing rowId or propertyId" }, { status: 400 });
    const [row, property] = await Promise.all([prisma.row.findFirst({ where: { id: rowId, databaseId: (await params).databaseId } }), prisma.property.findFirst({ where: { id: propertyId, databaseId: (await params).databaseId, type: "rollup" } })]);
    if (!row || !property) return NextResponse.json({ error: "Rollup not found" }, { status: 404 });
    const config = parseJsonObject(property.config);
    const relation = await prisma.property.findFirst({ where: { id: config.rollupRelationPropId, databaseId: (await params).databaseId, type: "relation" } });
    if (!relation) return NextResponse.json({ value: null });
    const targetDatabaseId = parseJsonObject(relation.config).relationDatabaseId;
    const IDs = parseJsonObject(row.properties)[relation.id];
    const relatedIds = Array.isArray(IDs) ? IDs.filter((id: any) => typeof id === "string") : [];
    if (!relatedIds.length) return NextResponse.json({ value: config.rollupFunction?.startsWith("count") ? 0 : null });
    const rows = await prisma.row.findMany({ where: { id: { in: relatedIds }, databaseId: targetDatabaseId } });
    const values = rows.map(item => parseJsonObject(item.properties)[config.rollupTargetPropId]).filter(value => value !== null && value !== undefined && value !== "");
    const numbers = values.map(Number).filter(Number.isFinite);
    let value: number | null = null;
    switch (config.rollupFunction) {
      case "count_all": value = rows.length; break;
      case "count_values": value = values.length; break;
      case "count_unique": value = new Set(values.map(String)).size; break;
      case "sum": value = numbers.reduce((total, number) => total + number, 0); break;
      case "avg": value = numbers.length ? numbers.reduce((total, number) => total + number, 0) / numbers.length : null; break;
      case "min": value = numbers.length ? Math.min(...numbers) : null; break;
      case "max": value = numbers.length ? Math.max(...numbers) : null; break;
      case "percent_checked": value = values.length ? Math.round(values.filter(Boolean).length / values.length * 100) : null; break;
    }
    return NextResponse.json({ value });
  } catch (error: any) {
    console.error("Rollup Error:", error);
    return NextResponse.json({ error: error.message || "Failed to compute rollup" }, { status: 500 });
  }
}
