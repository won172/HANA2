import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string | undefined;
};
const PRISMA_SCHEMA_VERSION = "2026-04-05-policy-exception-v1";

function createPrismaClient() {
  const dbPath = path.join(process.cwd(), "dev.db");
  const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`,
  });
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (
    !globalForPrisma.prisma ||
    globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION
  ) {
    void globalForPrisma.prisma?.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
}
