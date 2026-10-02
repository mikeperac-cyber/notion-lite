import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const comments = await prisma.comment.findMany({
      where: { pageId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (error: any) {
    console.error("Get Comments Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const body = await _req.json();
    const { content, authorName = "You", authorAvatar } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Comment content cannot be empty" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        pageId,
        content: content.trim(),
        authorName,
        authorAvatar: authorAvatar || null,
      },
    });

    return NextResponse.json({ comment });
  } catch (error: any) {
    console.error("Create Comment Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create comment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Comment Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete comment" },
      { status: 500 }
    );
  }
}
