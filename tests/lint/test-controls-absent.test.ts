import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// NFR-8: the application contains no test-only control. Failures are provoked from outside it
// (a second server with an unreachable database, route interception, the Playwright clock, direct
// edits of the test database), so nothing in `src/` can switch a failure on, and this test fails if
// a switch, an environment read or a test import appears (specs/003-account-screens/plan.md, D10).

const sourceRoot = resolve(__dirname, "../../src");

// The only file of `src/` allowed to read `process.env`, relative to `src/`.
const SERVER_ENVIRONMENT_READER = "shared/infrastructure/server-environment.ts";

// Identifiers that only the end-to-end harness uses to provoke failures or to reach the test
// database. A task that adds another such identifier to `tests/e2e/` or `playwright.config.ts` adds it here.
const END_TO_END_FAILURE_IDENTIFIERS = [
  "TEST_DATABASE_URL",
  "TEST_ONLY_AUTH_SECRET",
  "CLOSED_DATABASE_ADDRESS",
  "UNREACHABLE_DATA_SERVER",
  "seedAccountInDatabase",
  "withTestDatabaseClient",
  "buildUniqueAccount",
  "E2E_ACCOUNT",
  "interceptServerActionsOfPage",
];

const SOURCE_FILE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const IMPORT_SPECIFIER_PATTERN =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;
const TESTS_FOLDER_PATTERN = /(?:^|\/)tests(?:\/|$)/;
const PLAYWRIGHT_PACKAGE_PATTERN = /^(?:@playwright\/|playwright(?:-core)?(?:\/|$))/;

function listSourceFiles(rootFolder: string): string[] {
  return readdirSync(rootFolder, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.split(sep).join("/"))
    // The Prisma client is generated code (git-ignored) and its comments mention `process.env`.
    .filter((entry) => !entry.split("/").includes("generated"))
    .filter((entry) => SOURCE_FILE_PATTERN.test(entry));
}

function readImportedPaths(fileText: string): string[] {
  return [...fileText.matchAll(IMPORT_SPECIFIER_PATTERN)].map((match) => match[1]);
}

/** Every violation found under `rootFolder`, as `<file>: <rule>`. Empty when the folder is clean. */
function findTestControlViolations(rootFolder: string): string[] {
  const violations: string[] = [];
  for (const sourceFile of listSourceFiles(rootFolder)) {
    const fileText = readFileSync(join(rootFolder, sourceFile), "utf8");

    if (fileText.includes("process.env") && sourceFile !== SERVER_ENVIRONMENT_READER) {
      violations.push(`${sourceFile}: reads process.env outside the server-environment reader`);
    }
    for (const importedPath of readImportedPaths(fileText)) {
      if (TESTS_FOLDER_PATTERN.test(importedPath)) {
        violations.push(`${sourceFile}: imports from the tests folder (${importedPath})`);
      }
      if (PLAYWRIGHT_PACKAGE_PATTERN.test(importedPath)) {
        violations.push(`${sourceFile}: imports Playwright (${importedPath})`);
      }
    }
    for (const identifier of END_TO_END_FAILURE_IDENTIFIERS) {
      if (fileText.includes(identifier)) {
        violations.push(`${sourceFile}: contains the end-to-end identifier ${identifier}`);
      }
    }
  }
  return violations;
}

const fixtureFolders: string[] = [];

function buildFixtureSource(files: Readonly<Record<string, string>>): string {
  const fixtureFolder = mkdtempSync(join(tmpdir(), "lorekeeper-source-fixture-"));
  fixtureFolders.push(fixtureFolder);
  for (const [relativePath, fileText] of Object.entries(files)) {
    const filePath = join(fixtureFolder, relativePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, fileText);
  }
  return fixtureFolder;
}

afterEach(() => {
  for (const fixtureFolder of fixtureFolders.splice(0)) {
    rmSync(fixtureFolder, { recursive: true, force: true });
  }
});

describe("test-only controls are absent from the application", () => {
  it("finds no violation in src/", () => {
    expect(relative(resolve(__dirname, "../.."), sourceRoot)).toBe("src");

    expect(findTestControlViolations(sourceRoot)).toEqual([]);
  });

  describe("the check fails on a planted violation", () => {
    it("reports a process.env read in any file but the server-environment reader", () => {
      const fixtureFolder = buildFixtureSource({
        [SERVER_ENVIRONMENT_READER]: "export const read = () => process.env;\n",
        "app/page.tsx": "export const flag = process.env.FAIL_ON_PURPOSE;\n",
      });

      expect(findTestControlViolations(fixtureFolder)).toEqual([
        "app/page.tsx: reads process.env outside the server-environment reader",
      ]);
    });

    it.each([
      ['import { x } from "../../tests/support/fake";', "imports from the tests folder"],
      ['import { y } from "@/../tests/support/fake";', "imports from the tests folder"],
      ['const z = await import("../tests/e2e/support/helper");', "imports from the tests folder"],
      ['import { test } from "@playwright/test";', "imports Playwright"],
      ['import { chromium } from "playwright";', "imports Playwright"],
      ['export { x } from "playwright-core";', "imports Playwright"],
    ])("reports %s", (importLine, expectedRule) => {
      const fixtureFolder = buildFixtureSource({ "shared/presentation/leak.ts": `${importLine}\n` });

      const violations = findTestControlViolations(fixtureFolder);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain(expectedRule);
    });

    it.each(END_TO_END_FAILURE_IDENTIFIERS)("reports the end-to-end identifier %s", (identifier) => {
      const fixtureFolder = buildFixtureSource({
        "modules/accounts/switch.ts": `export const hook = "${identifier}";\n`,
      });

      expect(findTestControlViolations(fixtureFolder)).toEqual([
        `modules/accounts/switch.ts: contains the end-to-end identifier ${identifier}`,
      ]);
    });

    it("ignores generated code, which is not application source", () => {
      const fixtureFolder = buildFixtureSource({
        "shared/infrastructure/generated/prisma/client.ts": "// new PrismaPg({ url: process.env.DATABASE_URL })\n",
      });

      expect(findTestControlViolations(fixtureFolder)).toEqual([]);
    });

    it("accepts a clean file", () => {
      const fixtureFolder = buildFixtureSource({
        "modules/accounts/domain/clean.ts": 'import { other } from "./other";\nexport const value = other;\n',
      });

      expect(findTestControlViolations(fixtureFolder)).toEqual([]);
    });
  });
});
