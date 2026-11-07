import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 does not read `.env` by itself. Node loads it here, as tool configuration,
// and never overrides a variable that is already set (the test setup relies on that).
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
