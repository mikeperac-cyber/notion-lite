import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  try {
    const { databaseId } = await params;
    const body = await req.json();
    const { name, type, config } = body;
    if (type === "person") return NextResponse.json({ error: "People are not configured for this local workspace" }, { status: 400 });
    if (type === "relation" && (!config?.relationDatabaseId || !await prisma.database.findUnique({ where: { id: config.relationDatabaseId } }))) return NextResponse.json({ error: "Choose a related database" }, { status: 400 });
    if (type === "rollup") {
      const relation = await prisma.property.findUnique({ where: { id: config?.rollupRelationPropId || "" } });
      if (!relation || relation.databaseId !== databaseId || relation.type !== "relation" || !config?.rollupTargetPropId) return NextResponse.json({ error: "Choose a valid relation and target property" }, { status: 400 });
      const targetDatabaseId = JSON.parse(relation.config || "{}").relationDatabaseId;
      const targetProperty = await prisma.property.findUnique({ where: { id: config.rollupTargetPropId } });
      if (!targetProperty || targetProperty.databaseId !== targetDatabaseId) return NextResponse.json({ error: "Choose a property in the related database" }, { status: 400 });
    }

    const count = await prisma.property.count({
      where: { databaseId },
    });

    const property = await prisma.property.create({
      data: {
        databaseId,
        name: name || "New Column",
        type: type || "text",
        config: JSON.stringify(config || {}),
        order: count,
      },
    });

    return NextResponse.json({
      ...property,
      config: typeof property.config === "string" ? JSON.parse(property.config || "{}") : property.config,
    });
  } catch (error: any) {
    console.error("Create Property Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create property" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  try {
    const body = await req.json();
    const { propertyId, name, type, config, order } = body;
    if (typeof propertyId !== "string") return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    const existing = await prisma.property.findFirst({ where: { id: propertyId, databaseId: (await params).databaseId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(config !== undefined && { config: JSON.stringify(config) }),
        ...(order !== undefined && { order }),
      },
    });

    return NextResponse.json({
      ...updated,
      config: typeof updated.config === "string" ? JSON.parse(updated.config || "{}") : updated.config,
    });
  } catch (error: any) {
    console.error("Update Property Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update property" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");
    if (!propertyId) {
      return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    }
    const existing = await prisma.property.findFirst({ where: { id: propertyId, databaseId: (await params).databaseId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    await prisma.property.delete({
      where: { id: propertyId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Property Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete property" },
      { status: 500 }
    );
  }
}
