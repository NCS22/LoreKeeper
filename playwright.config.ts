import { defineConfig, devices } from "@playwright/test";
import { readTestDatabaseUrl } from "./tests/support/database/prepare-test-database";

// Two production servers share the build made by `pnpm test:e2e` (`next build && playwright test`):
// - healthy: connected to the test database;
// - unreachable data: its database address points to a closed port, so every data access fails.
//   Tests use it to prove how the application behaves when the data store cannot be reached.
// Test-only controls live here, outside the application (specs/003-account-screens/plan.md, D10).
const HEALTHY_SERVER_PORT = 3100;
const UNREACHABLE_DATA_SERVER_PORT = 3101;
const CLOSED_DATABASE_ADDRESS = "postgresql://nobody:nothing@127.0.0.1:1/lorekeeper_unreachable";
// Fixed and test-only: at least 32 characters and not a placeholder. Both servers share it, so a
// cookie signed by one is accepted by the other.
const TEST_ONLY_AUTH_SECRET = "e2e-test-only-secret-not-used-anywhere-else-0123456789";

const testDatabaseUrl = readTestDatabaseUrl();
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Copy .env.example to .env and fill it in, or set it in the shell (end-to-end tests need the test database).",
  );
}

function buildServer(port: number, databaseUrl: string) {
  return {
    command: `pnpm exec next start --port ${port}`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: TEST_ONLY_AUTH_SECRET,
      BETTER_AUTH_URL: `http://localhost:${port}`,
    },
  };
}

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/support/global-setup.ts",
  fullyParallel: true,
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${HEALTHY_SERVER_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    buildServer(HEALTHY_SERVER_PORT, testDatabaseUrl),
    buildServer(UNREACHABLE_DATA_SERVER_PORT, CLOSED_DATABASE_ADDRESS),
  ],
});
