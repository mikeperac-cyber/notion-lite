import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { databaseId: string } }) {
  const search = new URL(request.url).searchParams;
  const rowId = search.get("rowId") || "";
  const propertyId = search.get("propertyId") || "";
  const [row, property] = await Promise.all([prisma.row.findFirst({ where: { id: rowId, databaseId: params.databaseId } }), prisma.property.findFirst({ where: { id: propertyId, databaseId: params.databaseId, type: "rollup" } })]);
  if (!row || !property) return NextResponse.json({ error: "Rollup not found" }, { status: 404 });
  const config = JSON.parse(property.config || "{}");
  const relation = await prisma.property.findFirst({ where: { id: config.rollupRelationPropId, databaseId: params.databaseId, type: "relation" } });
  if (!relation) return NextResponse.json({ value: null });
  const targetDatabaseId = JSON.parse(relation.config || "{}").relationDatabaseId;
  const IDs = JSON.parse(row.properties || "{}")[relation.id];
  const relatedIds = Array.isArray(IDs) ? IDs.filter((id: any) => typeof id === "string") : [];
  if (!relatedIds.length) return NextResponse.json({ value: config.rollupFunction?.startsWith("count") ? 0 : null });
  const rows = await prisma.row.findMany({ where: { id: { in: relatedIds }, databaseId: targetDatabaseId } });
  const values = rows.map(item => JSON.parse(item.properties || "{}")[config.rollupTargetPropId]).filter(value => value !== null && value !== undefined && value !== "");
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
}
