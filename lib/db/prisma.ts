import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In dev, Next.js hot-reloads modules, which would otherwise create a new
 * PrismaClient (and a new connection pool) on every edit. We cache the
 * instance on `globalThis` to avoid exhausting Postgres connections.
 */
declare global {
  var __pltPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__pltPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__pltPrisma = prisma;
}
