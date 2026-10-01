import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSearchPage } from "@/lib/search";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, parentId, title, icon, cover, isDatabase, isTemplate } = body;

    let targetWorkspaceId = workspaceId;
    if (!targetWorkspaceId) {
      let defaultWs = await prisma.workspace.findFirst();
      if (!defaultWs) {
        defaultWs = await prisma.workspace.create({
          data: { name: "My Workspace", slug: "my-workspace", icon: "🚀" }
        });
      }
      targetWorkspaceId = defaultWs.id;
    }

    // Count pages in same parent to calculate order
    const count = await prisma.page.count({
      where: { workspaceId: targetWorkspaceId, parentId: parentId || null },
    });

    const newPage = await prisma.page.create({
      data: {
        workspaceId: targetWorkspaceId,
        parentId: parentId || null,
        title: title || (isDatabase ? "Untitled Database" : "Untitled"),
        icon: icon || (isDatabase ? "📊" : "📄"),
        cover: cover || null,
        isTemplate: Boolean(isTemplate),
        order: count,
        blocks: !isDatabase
          ? {
              create: [
                {
                  type: "paragraph",
                  content: JSON.stringify({ text: "" }),
                  order: 0,
                },
              ],
            }
          : undefined,
        database: isDatabase
          ? {
              create: {
                title: title || "Untitled Database",
                properties: {
                  create: [
                    { name: "Name", type: "title", order: 0 },
                    {
                      name: "Status",
                      type: "status",
                      config: JSON.stringify({
                        options: [
                          { id: "not_started", name: "Not started", color: "gray" },
                          { id: "in_progress", name: "In progress", color: "blue" },
                          { id: "done", name: "Done", color: "green" },
                        ],
                      }),
                      order: 1,
                    },
                    {
                      name: "Tags",
                      type: "multi_select",
                      config: JSON.stringify({
                        options: [
                          { id: "t1", name: "Frontend", color: "purple" },
                          { id: "t2", name: "Backend", color: "orange" },
                        ],
                      }),
                      order: 2,
                    },
                  ],
                },
                views: {
                  create: [
                    { name: "Table", type: "table", order: 0 },
                    { name: "Board", type: "board", order: 1, grouping: JSON.stringify({ propertyId: "Status" }) },
                  ],
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

    await refreshSearchPage(newPage.id);
    return NextResponse.json(newPage);
  } catch (error: any) {
    console.error("Create Page Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create page" },
      { status: 500 }
    );
  }
}
