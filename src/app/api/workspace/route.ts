import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspaceSchema } from "@/lib/schema-upgrade";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureWorkspaceSchema();
    let workspace = await prisma.workspace.findFirst({
      include: {
        pages: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!workspace) {
      // Seed initial default workspace & sample pages
      workspace = await prisma.workspace.create({
        data: {
          name: "My Workspace",
          slug: "my-workspace",
          icon: "🚀",
          pages: {
            create: [
              {
                title: "Welcome to Notion Lite",
                icon: "👋",
                cover: null,
                order: 0,
                blocks: {
                  create: [
                    {
                      type: "heading_1",
                      content: JSON.stringify({ text: "Welcome to Notion Lite 👋" }),
                      order: 0,
                    },
                    {
                      type: "callout",
                      content: JSON.stringify({
                        icon: "💡",
                        text: "Notion Lite keeps pages and databases on this computer. Use Settings to back up your workspace and configure optional AI.",
                      }),
                      order: 1,
                    },
                    {
                      type: "heading_2",
                      content: JSON.stringify({ text: "Features at a Glance" }),
                      order: 2,
                    },
                    {
                      type: "todo",
                      content: JSON.stringify({ text: "Try the block editor with '/' slash commands", checked: true }),
                      order: 3,
                    },
                    {
                      type: "todo",
                      content: JSON.stringify({ text: "Explore Database Views: Table, Board, Calendar, Gallery, List, Timeline", checked: true }),
                      order: 4,
                    },
                    {
                      type: "todo",
                      content: JSON.stringify({ text: "Open any database row as its own full page", checked: false }),
                      order: 5,
                    },
                    {
                      type: "todo",
                      content: JSON.stringify({ text: "Ask AI with /ai or open the Workspace AI Assistant", checked: false }),
                      order: 6,
                    },
                  ],
                },
              },
            ],
          },
        },
        include: {
          pages: {
            orderBy: { order: "asc" },
          },
        },
      });

      // Create a sample Project Tracker Database
      const projectDbPage = await prisma.page.create({
        data: {
          workspaceId: workspace.id,
          title: "Tasks & Projects Tracker",
          icon: "🎯",
          cover: null,
          order: 1,
          database: {
            create: {
              title: "Tasks & Projects",
              properties: {
                create: [
                  { name: "Task Name", type: "title", order: 0 },
                  {
                    name: "Status",
                    type: "status",
                    config: JSON.stringify({
                      options: [
                        { id: "todo", name: "To Do", color: "gray" },
                        { id: "in_progress", name: "In Progress", color: "blue" },
                        { id: "done", name: "Done", color: "green" },
                      ],
                    }),
                    order: 1,
                  },
                  {
                    name: "Priority",
                    type: "select",
                    config: JSON.stringify({
                      options: [
                        { id: "p1", name: "High", color: "red" },
                        { id: "p2", name: "Medium", color: "yellow" },
                        { id: "p3", name: "Low", color: "blue" },
                      ],
                    }),
                    order: 2,
                  },
                  { name: "Due Date", type: "date", order: 3 },
                  { name: "Completed", type: "checkbox", order: 4 },
                  { name: "Estimate (hrs)", type: "number", order: 5 },
                ],
              },
              views: {
                create: [
                  { name: "All Tasks", type: "table", order: 0 },
                  { name: "Board View", type: "board", order: 1, grouping: JSON.stringify({ propertyId: "Status" }) },
                  { name: "Calendar View", type: "calendar", order: 2 },
                  { name: "Gallery View", type: "gallery", order: 3 },
                  { name: "List View", type: "list", order: 4 },
                  { name: "Timeline View", type: "timeline", order: 5 },
                ],
              },
            },
          },
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

      if (projectDbPage.database) {
        const properties = projectDbPage.database.properties;
        const titleProp = properties.find((p) => p.name === "Task Name");
        const statusProp = properties.find((p) => p.name === "Status");
        const priorityProp = properties.find((p) => p.name === "Priority");
        const dateProp = properties.find((p) => p.name === "Due Date");
        const checkboxProp = properties.find((p) => p.name === "Completed");
        const numberProp = properties.find((p) => p.name === "Estimate (hrs)");

        const sampleRows = [
          {
            title: "Build TipTap Block Editor",
            status: "Done",
            priority: "High",
            date: new Date().toISOString().split("T")[0],
            completed: true,
            estimate: 8,
          },
          {
            title: "Implement 6 Database Views",
            status: "In Progress",
            priority: "High",
            date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
            completed: false,
            estimate: 12,
          },
          {
            title: "Connect Gemini AI Assistant",
            status: "To Do",
            priority: "Medium",
            date: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
            completed: false,
            estimate: 6,
          },
        ];

        for (let i = 0; i < sampleRows.length; i++) {
          const item = sampleRows[i];
          const rowPage = await prisma.page.create({
            data: {
              workspaceId: workspace.id,
              title: item.title,
              icon: "📝",
              order: i,
            },
          });

          const propValues: Record<string, any> = {};
          if (titleProp) propValues[titleProp.id] = item.title;
          if (statusProp) propValues[statusProp.id] = item.status;
          if (priorityProp) propValues[priorityProp.id] = item.priority;
          if (dateProp) propValues[dateProp.id] = item.date;
          if (checkboxProp) propValues[checkboxProp.id] = item.completed;
          if (numberProp) propValues[numberProp.id] = item.estimate;

          await prisma.row.create({
            data: {
              databaseId: projectDbPage.database.id,
              pageId: rowPage.id,
              properties: JSON.stringify(propValues),
              order: i,
            },
          });
        }
      }
    }

    // Build hierarchical page tree
    const allPages = await prisma.page.findMany({
      where: { workspaceId: workspace.id, isArchived: false },
      orderBy: { order: "asc" },
      include: {
        database: {
          select: { id: true, title: true },
        },
      },
    });

    const trashCount = await prisma.page.count({
      where: { workspaceId: workspace.id, isArchived: true },
    });

    const pageMap = new Map<string, any>();
    const rootPages: any[] = [];

    allPages.forEach((p) => {
      pageMap.set(p.id, { ...p, children: [] });
    });

    allPages.forEach((p) => {
      const pageNode = pageMap.get(p.id);
      if (p.parentId && pageMap.has(p.parentId)) {
        pageMap.get(p.parentId).children.push(pageNode);
      } else {
        rootPages.push(pageNode);
      }
    });

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        icon: workspace.icon,
      },
      pages: rootPages,
      trashCount,
    });
  } catch (error: any) {
    console.error("Workspace API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load workspace" },
      { status: 500 }
    );
  }
}
