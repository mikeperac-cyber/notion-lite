import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSearchPage } from "@/lib/search";
import { ensureSyncedTable } from "@/lib/schema-upgrade";

export async function GET(
  req: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const { pageId } = params;

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: {
        blocks: {
          orderBy: { order: "asc" },
        },
        database: {
          include: {
            properties: {
              orderBy: { order: "asc" },
            },
            rows: {
              orderBy: { order: "asc" },
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
            },
            views: {
              orderBy: { order: "asc" },
            },
          },
        },
        row: {
          include: {
            database: {
              include: {
                properties: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
        parent: {
          select: { id: true, title: true, icon: true },
        },
      },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Parse JSON fields
    const syncedIds = page.blocks.map(block => block.syncedBlockId).filter((id): id is string => Boolean(id));
    if (syncedIds.length) await ensureSyncedTable();
    const synced = syncedIds.length ? await prisma.syncedContent.findMany({ where: { id: { in: syncedIds } } }) : [];
    const syncedMap = new Map(synced.map(content => [content.id, JSON.parse(content.content)]));
    const parsedBlocks = page.blocks.map((block) => {
      const content = typeof block.content === "string" ? JSON.parse(block.content || "{}") : block.content;
      const canonical = block.syncedBlockId ? syncedMap.get(block.syncedBlockId) : null;
      return { ...block, content: canonical ? { ...content, node: { ...canonical, attrs: { ...(canonical.attrs || {}), id: block.id, syncId: block.syncedBlockId } } } : content };
    });

    let parsedDatabase: any = null;
    if (page.database) {
      parsedDatabase = {
        ...page.database,
        properties: page.database.properties.map((p) => ({
          ...p,
          config: typeof p.config === "string" ? JSON.parse(p.config || "{}") : p.config,
        })),
        rows: page.database.rows.map((r) => ({
          ...r,
          properties: typeof r.properties === "string" ? JSON.parse(r.properties || "{}") : r.properties,
        })),
        views: page.database.views.map((v) => ({
          ...v,
          filters: typeof v.filters === "string" ? JSON.parse(v.filters || "[]") : v.filters,
          sorts: typeof v.sorts === "string" ? JSON.parse(v.sorts || "[]") : v.sorts,
          grouping: typeof v.grouping === "string" ? JSON.parse(v.grouping || "{}") : v.grouping,
          visibleProps: typeof v.visibleProps === "string" ? JSON.parse(v.visibleProps || "[]") : v.visibleProps,
        })),
      };
    }

    let parsedRow: any = null;
    if (page.row) {
      parsedRow = {
        ...page.row,
        properties: typeof page.row.properties === "string" ? JSON.parse(page.row.properties || "{}") : page.row.properties,
        database: {
          ...page.row.database,
          properties: page.row.database.properties.map((p) => ({
            ...p,
            config: typeof p.config === "string" ? JSON.parse(p.config || "{}") : p.config,
          })),
        },
      };
    }

    return NextResponse.json({
      ...page,
      blocks: parsedBlocks,
      database: parsedDatabase,
      row: parsedRow,
    });
  } catch (error: any) {
    console.error("Get Page Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch page" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const { pageId } = params;
    const body = await req.json();
    const {
      title,
      icon,
      cover,
      isPublished,
      isTemplate,
      isFavorite,
      isArchived,
      fontStyle,
      fullWidth,
      slug,
      order,
      parentId,
    } = body;

    if (title !== undefined) {
      const previous = await prisma.page.findUnique({ where: { id: pageId }, include: { blocks: { orderBy: { order: "asc" } } } });
      if (previous && previous.title !== title) {
        const latest = await prisma.pageSnapshot.findFirst({ where: { pageId }, orderBy: { createdAt: "desc" } });
        if (!latest || Date.now() - latest.createdAt.getTime() >= 5 * 60 * 1000) await prisma.pageSnapshot.create({ data: { pageId, title: previous.title, content: JSON.stringify(previous.blocks) } });
      }
    }
    const updated = await prisma.page.update({
      where: { id: pageId },
      data: {
        ...(title !== undefined && { title }),
        ...(icon !== undefined && { icon }),
        ...(cover !== undefined && { cover }),
        ...(isPublished !== undefined && { isPublished }),
        ...(isTemplate !== undefined && { isTemplate }),
        ...(isFavorite !== undefined && { isFavorite }),
        ...(isArchived !== undefined && { isArchived }),
        ...(fontStyle !== undefined && { fontStyle }),
        ...(fullWidth !== undefined && { fullWidth }),
        ...(slug !== undefined && { slug: slug || null }),
        ...(order !== undefined && { order }),
        ...(parentId !== undefined && { parentId: parentId || null }),
      },
    });

    // If this page is a row in a database, update the Title property in row.properties as well
    const row = await prisma.row.findUnique({
      where: { pageId },
      include: {
        database: {
          include: {
            properties: true,
          },
        },
      },
    });

    if (row && title !== undefined) {
      const titleProp = row.database.properties.find((p) => p.type === "title");
      if (titleProp) {
        const props = typeof row.properties === "string" ? JSON.parse(row.properties || "{}") : row.properties;
        props[titleProp.id] = title;
        await prisma.row.update({
          where: { id: row.id },
          data: { properties: JSON.stringify(props) },
        });
      }
    }

    await refreshSearchPage(pageId);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Update Page Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update page" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const { pageId } = params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      await prisma.page.delete({
        where: { id: pageId },
      });
    } else {
      // Soft-delete to Trash
      await prisma.page.update({
        where: { id: pageId },
        data: { isArchived: true, isFavorite: false },
      });
    }

    await refreshSearchPage(pageId);
    return NextResponse.json({ success: true, permanent });
  } catch (error: any) {
    console.error("Delete Page Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete page" },
      { status: 500 }
    );
  }
}
