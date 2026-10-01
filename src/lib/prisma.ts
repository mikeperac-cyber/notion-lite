import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Optimize SQLite Pragmas for High Performance (WAL mode, fast sync, memory cache)
if (typeof window === "undefined") {
  prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`)
    .then(() => prisma.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`))
    .then(() => prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`))
    .then(() => prisma.$queryRawUnsafe(`PRAGMA cache_size = 20000;`))
    .catch((err) => {
      // Non-fatal if DB not yet initialized
    });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
