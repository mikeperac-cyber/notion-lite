import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VIEW_TYPES = ["table", "board", "calendar", "gallery", "list", "timeline"];

export async function POST(
  req: Request,
  { params }: { params: { databaseId: string } }
) {
  try {
    const { databaseId } = params;
    const body = await req.json();
    const { name, type, filters, sorts, grouping, visibleProps } = body;
    const viewType = type || "table";
    if (typeof viewType !== "string" || !VIEW_TYPES.includes(viewType)) return NextResponse.json({ error: "Invalid view type" }, { status: 400 });

    const count = await prisma.databaseView.count({
      where: { databaseId },
    });

    const view = await prisma.databaseView.create({
      data: {
        databaseId,
        name: name || `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`,
        type: viewType,
        filters: JSON.stringify(filters || []),
        sorts: JSON.stringify(sorts || []),
        grouping: JSON.stringify(grouping || {}),
        visibleProps: JSON.stringify(visibleProps || []),
        order: count,
      },
    });

    return NextResponse.json({
      ...view,
      filters: typeof view.filters === "string" ? JSON.parse(view.filters || "[]") : view.filters,
      sorts: typeof view.sorts === "string" ? JSON.parse(view.sorts || "[]") : view.sorts,
      grouping: typeof view.grouping === "string" ? JSON.parse(view.grouping || "{}") : view.grouping,
      visibleProps: typeof view.visibleProps === "string" ? JSON.parse(view.visibleProps || "[]") : view.visibleProps,
    });
  } catch (error: any) {
    console.error("Create View Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create view" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { databaseId: string } }
) {
  try {
    const body = await req.json();
    const { viewId, name, type, filters, sorts, grouping, visibleProps, order } = body;
    if (typeof viewId !== "string") return NextResponse.json({ error: "Missing viewId" }, { status: 400 });
    if (type !== undefined && (typeof type !== "string" || !VIEW_TYPES.includes(type))) return NextResponse.json({ error: "Invalid view type" }, { status: 400 });
    const existing = await prisma.databaseView.findFirst({ where: { id: viewId, databaseId: params.databaseId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "View not found" }, { status: 404 });

    const updated = await prisma.databaseView.update({
      where: { id: viewId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(filters !== undefined && { filters: JSON.stringify(filters) }),
        ...(sorts !== undefined && { sorts: JSON.stringify(sorts) }),
        ...(grouping !== undefined && { grouping: JSON.stringify(grouping) }),
        ...(visibleProps !== undefined && { visibleProps: JSON.stringify(visibleProps) }),
        ...(order !== undefined && { order }),
      },
    });

    return NextResponse.json({
      ...updated,
      filters: typeof updated.filters === "string" ? JSON.parse(updated.filters || "[]") : updated.filters,
      sorts: typeof updated.sorts === "string" ? JSON.parse(updated.sorts || "[]") : updated.sorts,
      grouping: typeof updated.grouping === "string" ? JSON.parse(updated.grouping || "{}") : updated.grouping,
      visibleProps: typeof updated.visibleProps === "string" ? JSON.parse(updated.visibleProps || "[]") : updated.visibleProps,
    });
  } catch (error: any) {
    console.error("Update View Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update view" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { databaseId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const viewId = searchParams.get("viewId");
    if (!viewId) {
      return NextResponse.json({ error: "Missing viewId" }, { status: 400 });
    }
    const existing = await prisma.databaseView.findFirst({ where: { id: viewId, databaseId: params.databaseId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "View not found" }, { status: 404 });

    await prisma.databaseView.delete({
      where: { id: viewId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete View Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete view" },
      { status: 500 }
    );
  }
}
