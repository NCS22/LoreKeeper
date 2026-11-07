import { inject } from "vitest";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { createPrismaClient } from "@/shared/infrastructure/prisma-client";
import "./provided-context";
import { readSafeTestDatabaseName } from "./test-database-guard";

/** The address of the prepared test database. Fails loudly, with the reason, when it is not ready. */
export function requireTestDatabaseUrl(): string {
  const setupError = inject("testDatabaseSetupError");
  if (setupError) {
    throw new Error(setupError);
  }
  const testDatabaseUrl = inject("testDatabaseUrl");
  if (!testDatabaseUrl) {
    throw new Error("Test database is not ready: TEST_DATABASE_URL is not set.");
  }
  // The setup already checked it; checking again here keeps the guard on every path that reads it.
  readSafeTestDatabaseName(testDatabaseUrl);
  return testDatabaseUrl;
}

/** A new client connected to the test database. The caller disconnects it. */
export function createTestPrismaClient(): PrismaClient {
  return createPrismaClient(requireTestDatabaseUrl());
}

/** Empties the four authentication tables. Cascades remove sessions and accounts with their user. */
export async function emptyAuthenticationTables(client: PrismaClient): Promise<void> {
  await client.verification.deleteMany();
  await client.user.deleteMany();
}
