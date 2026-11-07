import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { getPrismaClient } from "@/shared/infrastructure/prisma-client";
import {
  createTestPrismaClient,
  emptyAuthenticationTables,
  requireTestDatabaseUrl,
} from "../../support/database/test-database";

const PRISMA_CLIENT_GLOBAL_KEY = Symbol.for("lorekeeper.prismaClient");
const EMAIL_CHECK_CONSTRAINT_NAME = "User_email_comparable_check";

let client: PrismaClient;

beforeAll(() => {
  client = createTestPrismaClient();
});

afterAll(async () => {
  await client.$disconnect();
});

beforeEach(async () => {
  await emptyAuthenticationTables(client);
});

async function insertUserWithEmail(email: string): Promise<void> {
  await client.user.create({ data: { name: "Test person", email } });
}

describe("the test database", () => {
  it("accepts a connection", async () => {
    const rows = await client.$queryRaw<{ value: number }[]>`SELECT 1 AS value`;
    expect(rows[0].value).toBe(1);
  });

  it("has the four authentication tables after the migration", async () => {
    const rows = await client.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('User', 'Session', 'Account', 'Verification')
      ORDER BY table_name`;
    expect(rows.map((row) => row.table_name)).toEqual(["Account", "Session", "User", "Verification"]);
  });

  it("generates a UUID for a user and stores timestamps with a time zone", async () => {
    const user = await client.user.create({ data: { name: "Test person", email: "ana@example.com" } });
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const columnTypes = await client.$queryRaw<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'User' AND column_name IN ('createdAt', 'updatedAt')`;
    expect(columnTypes.map((column) => column.data_type)).toEqual([
      "timestamp with time zone",
      "timestamp with time zone",
    ]);
  });

  it("rejects a second user with the same email", async () => {
    await insertUserWithEmail("ana@example.com");

    await expect(insertUserWithEmail("ana@example.com")).rejects.toMatchObject({ code: "P2002" });
    expect(await client.user.count()).toBe(1);
  });

  it.each([
    ["an upper-case letter", "Ana@x.com"],
    ["a leading space", " ana@x.com"],
    ["a trailing space", "ana@x.com "],
    ["more than 254 characters", `${"a".repeat(249)}@x.com`],
  ])("rejects an email with %s through the CHECK constraint", async (_description, rejectedEmail) => {
    await expect(insertUserWithEmail(rejectedEmail)).rejects.toThrow(EMAIL_CHECK_CONSTRAINT_NAME);
    expect(await client.user.count()).toBe(0);
  });

  it("accepts an email of exactly 254 characters", async () => {
    await insertUserWithEmail(`${"a".repeat(248)}@x.com`);
    expect(await client.user.count()).toBe(1);
  });

  it("is visible to a second client: rows written by the first are read by the other", async () => {
    await insertUserWithEmail("ana@example.com");

    const secondClient = createTestPrismaClient();
    try {
      const users = await secondClient.user.findMany();
      expect(users.map((user) => user.email)).toEqual(["ana@example.com"]);
    } finally {
      await secondClient.$disconnect();
    }
  });

  it("deletes sessions and accounts together with their user", async () => {
    const user = await client.user.create({ data: { name: "Test person", email: "ana@example.com" } });
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    await client.session.create({ data: { token: "token-1", expiresAt, userId: user.id } });
    await client.account.create({
      data: { accountId: user.id, providerId: "credential", userId: user.id },
    });

    await client.user.delete({ where: { id: user.id } });

    expect(await client.session.count()).toBe(0);
    expect(await client.account.count()).toBe(0);
  });
});

describe("getPrismaClient", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    const globalScope = globalThis as Record<symbol, PrismaClient | undefined>;
    await globalScope[PRISMA_CLIENT_GLOBAL_KEY]?.$disconnect();
    delete globalScope[PRISMA_CLIENT_GLOBAL_KEY];
  });

  it("fails with an infrastructure error when the environment is missing, never at import", () => {
    vi.stubEnv("DATABASE_URL", undefined);

    expect(() => getPrismaClient()).toThrow(InfrastructureError);
  });

  it("creates the client on first use and returns the same one afterwards", async () => {
    vi.stubEnv("DATABASE_URL", requireTestDatabaseUrl());
    vi.stubEnv("BETTER_AUTH_SECRET", "s".repeat(40));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

    const firstClient = getPrismaClient();
    const secondClient = getPrismaClient();

    expect(secondClient).toBe(firstClient);
    expect(await firstClient.user.count()).toBe(0);
  });
});
