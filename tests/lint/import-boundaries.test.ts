import { resolve } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Lints code snippets with the project's real ESLint configuration.
// Loading the full configuration takes a few seconds, hence the explicit timeout.
const LINT_TEST_TIMEOUT_IN_MILLISECONDS = 60_000;

const projectRoot = resolve(__dirname, "../..");
const eslint = new ESLint({ cwd: projectRoot });

async function findImportBoundaryViolations(
  relativeFilePath: string,
  importedPath: string,
): Promise<string[]> {
  const [lintResult] = await eslint.lintText(`import "${importedPath}";\n`, {
    filePath: resolve(projectRoot, relativeFilePath),
  });
  return lintResult.messages
    .filter((message) => message.ruleId === "no-restricted-imports")
    .map((message) => message.message);
}

const domainFile = "src/modules/universes/domain/universe.ts";
const applicationFile = "src/modules/universes/application/create-universe.ts";

describe("import boundaries", () => {
  describe("domain files", () => {
    it.each([
      "react",
      "next/navigation",
      "@prisma/client",
      "better-auth",
      "../infrastructure/in-memory-universe-repository",
      "@/shared/infrastructure/prisma-client",
      "../application/create-universe",
    ])(
      "report an import of %s",
      async (importedPath) => {
        const violations = await findImportBoundaryViolations(
          domainFile,
          importedPath,
        );
        expect(violations).toHaveLength(1);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );

    it(
      "allow an import of a sibling domain file",
      async () => {
        const violations = await findImportBoundaryViolations(
          domainFile,
          "./universe-mode",
        );
        expect(violations).toEqual([]);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );
  });

  describe("application files", () => {
    it.each([
      "react",
      "@prisma/client",
      "../infrastructure/in-memory-universe-repository",
    ])(
      "report an import of %s",
      async (importedPath) => {
        const violations = await findImportBoundaryViolations(
          applicationFile,
          importedPath,
        );
        expect(violations).toHaveLength(1);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );

    it(
      "allow a relative import of their own domain",
      async () => {
        const violations = await findImportBoundaryViolations(
          applicationFile,
          "../domain/universe",
        );
        expect(violations).toEqual([]);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );
  });

  describe("files outside a module", () => {
    it(
      "report an import of a module internal path",
      async () => {
        const violations = await findImportBoundaryViolations(
          "src/components/universes/universes-provider.tsx",
          "@/modules/universes/domain/universe",
        );
        expect(violations).toHaveLength(1);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );

    it(
      "allow an import of a module public interface",
      async () => {
        const violations = await findImportBoundaryViolations(
          "src/components/universes/universes-provider.tsx",
          "@/modules/universes",
        );
        expect(violations).toEqual([]);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );
  });

  describe("module files", () => {
    it(
      "report an import of another module internal path",
      async () => {
        const violations = await findImportBoundaryViolations(
          "src/modules/works/application/list-works.ts",
          "@/modules/universes/domain/universe",
        );
        expect(violations).toHaveLength(1);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );

    it(
      "allow an import of another module public interface",
      async () => {
        const violations = await findImportBoundaryViolations(
          "src/modules/works/application/list-works.ts",
          "@/modules/universes",
        );
        expect(violations).toEqual([]);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );
  });

  describe("test files", () => {
    it(
      "allow an import of a module internal path",
      async () => {
        const violations = await findImportBoundaryViolations(
          "tests/modules/universes/domain/universe.test.ts",
          "@/modules/universes/domain/universe",
        );
        expect(violations).toEqual([]);
      },
      LINT_TEST_TIMEOUT_IN_MILLISECONDS,
    );
  });
});
