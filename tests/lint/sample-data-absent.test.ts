import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SAMPLE_DATA_MARKER_TEXTS } from "../support/sample-data-markers";

// FR-37: no file under `src/` imports the prototype sample data (`@/mocks`) or contains one of its
// unique markers, so no served page, answer or static file can carry it. This test fails the moment
// a marker or a `@/mocks` import is added to `src/` again (specs/004-stored-universes/plan.md,
// section 5, "Sample data and `src/mocks`").

const sourceRoot = resolve(__dirname, "../../src");

const MOCKS_IMPORT_PATTERN = /@\/mocks(?:\/|["'`]|$)/m;
const MOCKS_FOLDER_PREFIX = "mocks/";

function listFilesUnder(rootFolder: string): string[] {
  return readdirSync(rootFolder, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.split(sep).join("/"))
    // The Prisma client is generated code (git-ignored), not authored source.
    .filter((entry) => !entry.split("/").includes("generated"))
    .filter((entry) => statSync(join(rootFolder, entry)).isFile());
}

/** Every violation found under `rootFolder`, as `<file>: <rule>`. Empty when the folder is clean. */
function findSampleDataViolations(rootFolder: string): string[] {
  const violations: string[] = [];
  for (const sourceFile of listFilesUnder(rootFolder)) {
    if (sourceFile.startsWith(MOCKS_FOLDER_PREFIX)) {
      violations.push(`${sourceFile}: lives in the sample data folder`);
    }
    const fileText = readFileSync(join(rootFolder, sourceFile), "utf8");
    if (MOCKS_IMPORT_PATTERN.test(fileText)) {
      violations.push(`${sourceFile}: refers to @/mocks`);
    }
    for (const markerText of SAMPLE_DATA_MARKER_TEXTS) {
      if (fileText.includes(markerText)) {
        violations.push(`${sourceFile}: contains the sample marker "${markerText}"`);
      }
    }
  }
  return violations;
}

describe("sample data is absent from src/", () => {
  it("has no @/mocks import, no sample folder and no sample marker in the real source", () => {
    expect(findSampleDataViolations(sourceRoot)).toEqual([]);
  });
});

describe("the sample data check itself", () => {
  const temporaryFolders: string[] = [];

  afterEach(() => {
    for (const folder of temporaryFolders.splice(0)) {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  function buildSourceFolder(files: Record<string, string>): string {
    const folder = mkdtempSync(join(tmpdir(), "sample-data-absent-"));
    temporaryFolders.push(folder);
    for (const [relativePath, fileText] of Object.entries(files)) {
      const filePath = join(folder, relativePath);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, fileText);
    }
    return folder;
  }

  it("passes for a folder without sample data", () => {
    const folder = buildSourceFolder({ "components/clean.ts": 'export const label = "Universes";\n' });
    expect(findSampleDataViolations(folder)).toEqual([]);
  });

  it("fails for a @/mocks import", () => {
    const folder = buildSourceFolder({
      "components/leftover.tsx": 'import type { UniverseDto } from "@/mocks/dto/universe";\n',
    });
    expect(findSampleDataViolations(folder)).toEqual(["components/leftover.tsx: refers to @/mocks"]);
  });

  it("fails for every sample marker", () => {
    for (const markerText of SAMPLE_DATA_MARKER_TEXTS) {
      const folder = buildSourceFolder({
        "messages/leftover.ts": `export const text = ${JSON.stringify(markerText)};\n`,
      });
      expect(findSampleDataViolations(folder)).toContain(
        `messages/leftover.ts: contains the sample marker "${markerText}"`,
      );
    }
  });

  it("fails for a file in a sample data folder", () => {
    const folder = buildSourceFolder({ "mocks/data/anything.ts": "export const value = 1;\n" });
    expect(findSampleDataViolations(folder)).toEqual(["mocks/data/anything.ts: lives in the sample data folder"]);
  });

  it("does not flag a plain name a person could type", () => {
    const folder = buildSourceFolder({ "components/plain.ts": 'export const name = "The Ember Concordat";\n' });
    expect(findSampleDataViolations(folder)).toEqual([]);
  });
});
