import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSearchPage } from "@/lib/search";

export async function POST(
  req: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const { pageId } = params;

    const sourcePage = await prisma.page.findUnique({
      where: { id: pageId },
      include: {
        blocks: true,
        database: {
          include: {
            properties: true,
            rows: true,
            views: true,
          },
        },
      },
    });

    if (!sourcePage) {
      return NextResponse.json({ error: "Source page not found" }, { status: 404 });
    }

    const count = await prisma.page.count({
      where: { workspaceId: sourcePage.workspaceId, parentId: sourcePage.parentId },
    });

    // Create cloned Page
    const duplicatedPage = await prisma.page.create({
      data: {
        workspaceId: sourcePage.workspaceId,
        parentId: sourcePage.parentId,
        title: `${sourcePage.title} (Copy)`,
        icon: sourcePage.icon,
        cover: sourcePage.cover,
        order: count,
        blocks: {
          create: sourcePage.blocks.map((b) => ({
            type: b.type,
            content: b.content,
            order: b.order,
          })),
        },
        database: sourcePage.database
          ? {
              create: {
                title: `${sourcePage.database.title} (Copy)`,
                description: sourcePage.database.description,
                properties: {
                  create: sourcePage.database.properties.map((p) => ({
                    name: p.name,
                    type: p.type,
                    config: p.config,
                    order: p.order,
                  })),
                },
                views: {
                  create: sourcePage.database.views.map((v) => ({
                    name: v.name,
                    type: v.type,
                    filters: v.filters,
                    sorts: v.sorts,
                    grouping: v.grouping,
                    visibleProps: v.visibleProps,
                    order: v.order,
                  })),
                },
              },
            }
          : undefined,
      },
      include: {
        database: {
          include: {
            properties: true,
            views: true,
          },
        },
      },
    });

    // If source page had database rows, clone the rows too
    if (sourcePage.database && duplicatedPage.database) {
      for (const row of sourcePage.database.rows) {
        await prisma.row.create({
          data: {
            databaseId: duplicatedPage.database.id,
            properties: row.properties,
            order: row.order,
          },
        });
      }
    }

    await refreshSearchPage(duplicatedPage.id);
    return NextResponse.json(duplicatedPage);
  } catch (error: any) {
    console.error("Duplicate Page Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to duplicate page" },
      { status: 500 }
    );
  }
}
