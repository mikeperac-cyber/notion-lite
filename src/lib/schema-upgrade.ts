import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const SCHEMA_VERSION = 1;
let migration: Promise<void> | undefined;

async function migrate() {
  const rows = await prisma.$queryRawUnsafe<Array<{ user_version: bigint | number }>>("PRAGMA user_version");
  const version = Number(rows[0]?.user_version || 0);
  if (version > SCHEMA_VERSION) throw new Error("This workspace was created by a newer Notion Lite version.");
  if (version === SCHEMA_VERSION) return;

  // VACUUM INTO includes committed WAL changes. Keep the snapshot beside installed user data.
  const dataDir = process.env.NOTIONLITE_DATA_DIR;
  if (dataDir) {
    const backupDir = path.join(dataDir, "pre-migration");
    await fs.mkdir(backupDir, { recursive: true });
    const backup = path.join(backupDir, `workspace-v${version}-${Date.now()}.db`);
    await prisma.$executeRawUnsafe("VACUUM INTO ?", backup);
  }

  if (version < 1) {
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "SyncedContent" ("id" TEXT NOT NULL PRIMARY KEY, "content" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL)');
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "PageMeta" ("pageId" TEXT NOT NULL PRIMARY KEY, "tags" TEXT NOT NULL DEFAULT \'[]\', "tasks" TEXT NOT NULL DEFAULT \'[]\', "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE)');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Page_workspaceId_parentId_order_idx" ON "Page"("workspaceId", "parentId", "order")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Page_workspaceId_isArchived_isFavorite_idx" ON "Page"("workspaceId", "isArchived", "isFavorite")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Block_pageId_parentId_order_idx" ON "Block"("pageId", "parentId", "order")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Property_databaseId_order_idx" ON "Property"("databaseId", "order")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Row_databaseId_order_idx" ON "Row"("databaseId", "order")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DatabaseView_databaseId_order_idx" ON "DatabaseView"("databaseId", "order")');
    await prisma.$executeRawUnsafe("PRAGMA user_version = 1");
  }
}

export function ensureWorkspaceSchema() {
  migration ??= migrate().catch(error => { migration = undefined; throw error; });
  return migration;
}

export const ensureSyncedTable = ensureWorkspaceSchema;
export const ensurePageMetaTable = ensureWorkspaceSchema;
