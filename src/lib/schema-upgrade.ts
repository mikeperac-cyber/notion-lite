import { prisma } from "@/lib/prisma";

let syncedTableReady: Promise<unknown> | undefined;
let pageMetaTableReady: Promise<unknown> | undefined;

/** Existing local workspaces predate synced blocks; keep their data in place. */
export function ensureSyncedTable() {
  syncedTableReady ??= prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "SyncedContent" ("id" TEXT NOT NULL PRIMARY KEY, "content" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL)'
  ).catch(error => {
    syncedTableReady = undefined;
    throw error;
  });
  return syncedTableReady;
}

export function ensurePageMetaTable() {
  pageMetaTableReady ??= prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "PageMeta" ("pageId" TEXT NOT NULL PRIMARY KEY, "tags" TEXT NOT NULL DEFAULT \'[]\', "tasks" TEXT NOT NULL DEFAULT \'[]\', "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE)'
  ).catch(error => {
    pageMetaTableReady = undefined;
    throw error;
  });
  return pageMetaTableReady;
}
