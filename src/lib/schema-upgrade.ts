import { prisma } from "@/lib/prisma";

let syncedTableReady: Promise<unknown> | undefined;

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
