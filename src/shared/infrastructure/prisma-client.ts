import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { readServerEnvironment } from "./server-environment";

/** Creates a client connected to the given database. Used directly only by tests that need a second client. */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

// Hot reloads in development re-evaluate modules; the client lives on `globalThis`
// so every reload reuses one connection pool instead of opening a new one.
const PRISMA_CLIENT_GLOBAL_KEY = Symbol.for("lorekeeper.prismaClient");

type GlobalWithPrismaClient = typeof globalThis & {
  [PRISMA_CLIENT_GLOBAL_KEY]?: PrismaClient;
};

/**
 * The single Prisma client of the application, created on first use (never at import,
 * so the application starts and builds without a database or a `.env`).
 */
export function getPrismaClient(): PrismaClient {
  const globalScope = globalThis as GlobalWithPrismaClient;
  globalScope[PRISMA_CLIENT_GLOBAL_KEY] ??= createPrismaClient(
    readServerEnvironment().databaseUrl,
  );
  return globalScope[PRISMA_CLIENT_GLOBAL_KEY];
}
