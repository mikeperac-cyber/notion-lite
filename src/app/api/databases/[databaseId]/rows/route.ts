import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSearchPage } from "@/lib/search";
import { parseJsonObject } from "@/lib/safe-json";

export async function GET(_req: Request, { params }: { params: { databaseId: string } }) {
  try {
    const rows = await prisma.row.findMany({ where: { databaseId: params.databaseId }, take: 500, orderBy: { order: "asc" }, include: { page: { select: { title: true } } } });
    return NextResponse.json({ rows: rows.map(row => ({ id: row.id, title: row.page?.title || "Untitled", properties: parseJsonObject(row.properties) })) });
  } catch (error: any) {
    console.error("List Rows Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list rows" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { databaseId: string } }
) {
  try {
    const { databaseId } = params;
    const body = await req.json();
    const { properties } = body;

    const db = await prisma.database.findUnique({
      where: { id: databaseId },
      include: {
        page: true,
        properties: true,
      },
    });

    if (!db) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const titleProp = db.properties.find((p) => p.type === "title");
    const initialTitle = (titleProp && properties && properties[titleProp.id]) || "Untitled";

    let targetWorkspaceId = db.page?.workspaceId;
    if (!targetWorkspaceId) {
      let defaultWs = await prisma.workspace.findFirst();
      if (!defaultWs) {
        defaultWs = await prisma.workspace.create({
          data: { name: "My Workspace", slug: "my-workspace", icon: "🚀" },
        });
      }
      targetWorkspaceId = defaultWs.id;
    }

    // Create the companion page for this row
    const rowPage = await prisma.page.create({
      data: {
        workspaceId: targetWorkspaceId,
        title: initialTitle,
        icon: "📝",
        blocks: {
          create: [
            {
              type: "paragraph",
              content: JSON.stringify({ text: "" }),
              order: 0,
            },
          ],
        },
      },
    });

    const count = await prisma.row.count({
      where: { databaseId },
    });

    const row = await prisma.row.create({
      data: {
        databaseId,
        pageId: rowPage.id,
        properties: JSON.stringify(properties || {}),
        order: count,
      },
      include: {
        page: {
          select: {
            id: true,
            title: true,
            icon: true,
            cover: true,
          },
        },
      },
    });

    await refreshSearchPage(rowPage.id);
    return NextResponse.json({
      ...row,
      properties: typeof row.properties === "string" ? JSON.parse(row.properties || "{}") : row.properties,
    });
  } catch (error: any) {
    console.error("Create Row Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create row" },
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
    const { rowId, properties, order } = body;

    const existingRow = await prisma.row.findUnique({
      where: { id: rowId },
      include: {
        database: {
          include: {
            properties: true,
          },
        },
      },
    });

    if (!existingRow) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    let currentProps: Record<string, any> = {};
    try {
      currentProps = typeof existingRow.properties === "string" ? JSON.parse(existingRow.properties || "{}") : existingRow.properties || {};
    } catch {
      currentProps = {};
    }

    const mergedProps = { ...currentProps, ...properties };
    for (const property of existingRow.database.properties.filter(property => property.type === "relation" && properties && property.id in properties)) {
      const ids = properties[property.id];
      const targetDatabaseId = parseJsonObject(property.config).relationDatabaseId;
      if (!Array.isArray(ids) || !ids.every((id: unknown) => typeof id === "string")) return NextResponse.json({ error: "Relation must be a list of row IDs" }, { status: 400 });
      const count = await prisma.row.count({ where: { id: { in: ids }, databaseId: targetDatabaseId } });
      if (count !== new Set(ids).size) return NextResponse.json({ error: "Relation contains an unknown row" }, { status: 400 });
    }

    const updated = await prisma.row.update({
      where: { id: rowId },
      data: {
        ...(properties !== undefined && {
          properties: JSON.stringify(mergedProps),
        }),
        ...(order !== undefined && { order }),
      },
      include: {
        page: {
          select: {
            id: true,
            title: true,
            icon: true,
            cover: true,
          },
        },
      },
    });

    // If title property was updated and row has a companion page, update page title
    const titleProp = existingRow.database.properties.find((p) => p.type === "title");
    if (titleProp && properties && properties[titleProp.id] !== undefined && existingRow.pageId) {
      await prisma.page.update({
        where: { id: existingRow.pageId },
        data: { title: properties[titleProp.id] || "Untitled" },
      });
      await refreshSearchPage(existingRow.pageId);
    }

    return NextResponse.json({
      ...updated,
      properties: mergedProps,
    });
  } catch (error: any) {
    console.error("Update Row Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update row" },
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
    const rowId = searchParams.get("rowId");
    if (!rowId) {
      return NextResponse.json({ error: "Missing rowId" }, { status: 400 });
    }

    const row = await prisma.row.findUnique({
      where: { id: rowId },
    });

    if (row && row.pageId) {
      // Delete companion page
      await prisma.page.delete({
        where: { id: row.pageId },
      }).catch(() => {});
      await refreshSearchPage(row.pageId);
    }

    await prisma.row.delete({
      where: { id: rowId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Row Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete row" },
      { status: 500 }
    );
  }
}
