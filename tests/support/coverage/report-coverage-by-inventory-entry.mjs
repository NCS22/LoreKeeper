// Prints line and branch coverage per entry of the criticality inventory (spec 005a, plan 2.2).
//
// `pnpm test:coverage` runs the Vitest projects one at a time, each writing its own
// `coverage/<test type>/coverage-final.json`, and then runs this script. It reads those reports and
// the `Files` column of `docs/criticality-inventory.md`, and prints for every entry the lines and
// branches covered by each test type and combined, the level, the target and the distance to it.
// It also lists the production files that match no entry or more than one, and the patterns that
// match no file. It never fails on a gap: coverage thresholds are not active until spec 005b.
//
// Tooling, not a production component: it carries no test (spec 005a, FR-14).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const INVENTORY_PATH = path.join(REPOSITORY_ROOT, "docs", "criticality-inventory.md");
const MEASURED_TEST_TYPES = ["unit", "database", "component"];
const TARGET_PERCENT_BY_LEVEL = { CORE: 100, IMPORTANT: 80, "TIER 0": null };
const NOT_PRODUCTION_HEADING_PREFIX = "Not production";
const GENERATED_SOURCE_PREFIX = "src/shared/infrastructure/generated/";

function toRepositoryPath(absoluteOrRelativePath) {
  const relativePath = path.isAbsolute(absoluteOrRelativePath)
    ? path.relative(REPOSITORY_ROOT, absoluteOrRelativePath)
    : absoluteOrRelativePath;
  return relativePath.split(path.sep).join("/");
}

// Production candidates (plan 2.1): every file under `src/` except the generated Prisma client,
// everything under `prisma/`, and every file at the repository root. Root files that are tooling
// are listed in the "Not production" table of the inventory, so they do not show up as unmatched.
// Git lists them so that ignored files (`.env`, build output) never appear.
function listProductionCandidateFiles() {
  const gitOutput = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
  const listedFiles = gitOutput.split("\0").filter((listedFile) => listedFile !== "");
  const existingFiles = listedFiles.filter((listedFile) =>
    existsSync(path.join(REPOSITORY_ROOT, listedFile)),
  );
  return [...new Set(existingFiles)]
    .filter(
      (repositoryFile) =>
        (repositoryFile.startsWith("src/") && !repositoryFile.startsWith(GENERATED_SOURCE_PREFIX)) ||
        repositoryFile.startsWith("prisma/") ||
        !repositoryFile.includes("/"),
    )
    .sort();
}

function splitTableRowIntoCells(tableLine) {
  const innerText = tableLine.trim().replace(/^\|/, "").replace(/\|$/, "");
  return innerText.split(/(?<!\\)\|/).map((cellText) => cellText.trim());
}

function isTableSeparatorLine(tableLine) {
  return /^\|(\s*:?-+:?\s*\|)+\s*$/.test(tableLine.trim());
}

function readFilePatternsFromCell(filesCell) {
  return filesCell
    .split(/<br\s*\/?>/i)
    .map((patternText) => patternText.replaceAll("`", "").trim())
    .filter((patternText) => patternText !== "");
}

function normalizeLevel(levelCell) {
  return levelCell.replace(/[`*]/g, "").trim().toUpperCase();
}

function readTargetOverride(exceptionsCell) {
  const overrideMatch = /override:\s*lines\s*(\d+(?:\.\d+)?)\s*,\s*branches\s*(\d+(?:\.\d+)?)/i.exec(
    exceptionsCell,
  );
  if (!overrideMatch) {
    return null;
  }
  return { lines: Number(overrideMatch[1]), branches: Number(overrideMatch[2]) };
}

// Reads every markdown table that has `Id` and `Files` columns. Rows under the "Not production"
// heading are kept apart: they only take files out of the unmatched list.
function readInventoryEntries(inventoryText) {
  const inventoryLines = inventoryText.split(/\r?\n/);
  const inventoryEntries = [];
  let currentHeading = "";
  let currentColumnNames = null;

  inventoryLines.forEach((inventoryLine, lineIndex) => {
    if (inventoryLine.startsWith("## ")) {
      currentHeading = inventoryLine.slice(3).trim();
      currentColumnNames = null;
      return;
    }
    if (!inventoryLine.trim().startsWith("|")) {
      currentColumnNames = null;
      return;
    }
    if (isTableSeparatorLine(inventoryLine)) {
      return;
    }
    const nextLine = inventoryLines[lineIndex + 1] ?? "";
    if (currentColumnNames === null && isTableSeparatorLine(nextLine)) {
      currentColumnNames = splitTableRowIntoCells(inventoryLine);
      return;
    }
    if (currentColumnNames === null || !currentColumnNames.includes("Files")) {
      return;
    }
    const cells = splitTableRowIntoCells(inventoryLine);
    const cellByColumnName = (columnName) => cells[currentColumnNames.indexOf(columnName)] ?? "";
    inventoryEntries.push({
      entryId: cellByColumnName("Id").replaceAll("`", ""),
      area: currentHeading,
      isProduction: !currentHeading.startsWith(NOT_PRODUCTION_HEADING_PREFIX),
      filePatterns: readFilePatternsFromCell(cellByColumnName("Files")),
      level: normalizeLevel(cellByColumnName("Level")),
      targetOverride: readTargetOverride(cellByColumnName("Exceptions and floors")),
    });
  });
  return inventoryEntries;
}

// Istanbul-format report as written by the V8 provider. A line counts as covered when any
// statement that starts on it ran; branches are keyed by position, so the reports of different
// test types can be merged even if their branch numbering differs.
function readCoverageByFile(testType) {
  const reportPath = path.join(REPOSITORY_ROOT, "coverage", testType, "coverage-final.json");
  if (!existsSync(reportPath)) {
    return null;
  }
  const coverageReport = JSON.parse(readFileSync(reportPath, "utf8"));
  const coverageByFile = new Map();
  for (const [reportedPath, fileCoverage] of Object.entries(coverageReport)) {
    const lineHitByNumber = new Map();
    for (const [statementId, statementLocation] of Object.entries(fileCoverage.statementMap)) {
      const lineNumber = statementLocation.start.line;
      const wasHit = fileCoverage.s[statementId] > 0;
      lineHitByNumber.set(lineNumber, (lineHitByNumber.get(lineNumber) ?? false) || wasHit);
    }
    const branchHitByKey = new Map();
    for (const [branchId, branchDescription] of Object.entries(fileCoverage.branchMap)) {
      const branchStart = branchDescription.loc?.start ?? branchDescription.locations[0].start;
      fileCoverage.b[branchId].forEach((pathHitCount, pathIndex) => {
        const branchKey = `${branchStart.line}:${branchStart.column}:${pathIndex}`;
        branchHitByKey.set(branchKey, (branchHitByKey.get(branchKey) ?? false) || pathHitCount > 0);
      });
    }
    coverageByFile.set(toRepositoryPath(reportedPath), { lineHitByNumber, branchHitByKey });
  }
  return coverageByFile;
}

function mergeHitMaps(hitMaps) {
  const mergedHits = new Map();
  for (const hitMap of hitMaps) {
    for (const [hitKey, wasHit] of hitMap) {
      mergedHits.set(hitKey, (mergedHits.get(hitKey) ?? false) || wasHit);
    }
  }
  return mergedHits;
}

function countHits(hitMaps) {
  let coveredCount = 0;
  let totalCount = 0;
  for (const hitMap of hitMaps) {
    for (const wasHit of hitMap.values()) {
      totalCount += 1;
      if (wasHit) {
        coveredCount += 1;
      }
    }
  }
  return { coveredCount, totalCount };
}

function formatPercent({ coveredCount, totalCount }) {
  if (totalCount === 0) {
    return "-";
  }
  return `${((coveredCount / totalCount) * 100).toFixed(1)}% (${coveredCount}/${totalCount})`;
}

function percentOf({ coveredCount, totalCount }) {
  return totalCount === 0 ? null : (coveredCount / totalCount) * 100;
}

function formatDistance(metricName, targetPercent, measuredCounts) {
  const measuredPercent = percentOf(measuredCounts);
  if (measuredPercent === null) {
    return `${metricName} nothing to measure`;
  }
  const missingPoints = targetPercent - measuredPercent;
  return missingPoints <= 0
    ? `${metricName} met`
    : `${metricName} ${missingPoints.toFixed(1)} points below`;
}

function describeEntryCoverage(inventoryEntry, entryFiles, coverageByTestType) {
  const typeNamesWithCombined = [...MEASURED_TEST_TYPES, "combined"];
  const linesByType = {};
  const branchesByType = {};
  for (const typeName of typeNamesWithCombined) {
    const fileCoverages = entryFiles.map((entryFile) => {
      if (typeName !== "combined") {
        return coverageByTestType[typeName]?.get(entryFile);
      }
      const coveragesOfFile = MEASURED_TEST_TYPES.map((testType) =>
        coverageByTestType[testType]?.get(entryFile),
      ).filter(Boolean);
      return coveragesOfFile.length === 0
        ? undefined
        : {
            lineHitByNumber: mergeHitMaps(coveragesOfFile.map((coverage) => coverage.lineHitByNumber)),
            branchHitByKey: mergeHitMaps(coveragesOfFile.map((coverage) => coverage.branchHitByKey)),
          };
    });
    const measuredCoverages = fileCoverages.filter(Boolean);
    linesByType[typeName] = countHits(measuredCoverages.map((coverage) => coverage.lineHitByNumber));
    branchesByType[typeName] = countHits(measuredCoverages.map((coverage) => coverage.branchHitByKey));
  }

  const measuredFileCount = entryFiles.filter((entryFile) =>
    MEASURED_TEST_TYPES.some((testType) => coverageByTestType[testType]?.has(entryFile)),
  ).length;

  const outputLines = [];
  const levelLabel = inventoryEntry.level === "" ? "no level" : inventoryEntry.level;
  outputLines.push(
    `${inventoryEntry.entryId || "(no id)"}  [${levelLabel}]  ${entryFiles.length} file(s), ${measuredFileCount} with coverage data`,
  );
  if (measuredFileCount === 0) {
    outputLines.push("  lines and branches: not measured (no file of this entry is in a coverage report)");
  } else {
    for (const [metricName, countsByType] of [
      ["lines", linesByType],
      ["branches", branchesByType],
    ]) {
      const typeColumns = typeNamesWithCombined
        .map((typeName) =>
          coverageByTestType[typeName] === null
            ? `${typeName} not run`
            : `${typeName} ${formatPercent(countsByType[typeName])}`,
        )
        .join(" | ");
      outputLines.push(`  ${metricName.padEnd(8)} ${typeColumns} | e2e not measured`);
    }
  }

  if (!(inventoryEntry.level in TARGET_PERCENT_BY_LEVEL)) {
    outputLines.push(`  target: unknown level "${inventoryEntry.level}", expected CORE, IMPORTANT or TIER 0`);
    return outputLines;
  }
  const levelTarget = TARGET_PERCENT_BY_LEVEL[inventoryEntry.level];
  if (levelTarget === null) {
    outputLines.push("  target: none (TIER 0)");
    return outputLines;
  }
  const linesTarget = inventoryEntry.targetOverride?.lines ?? levelTarget;
  const branchesTarget = inventoryEntry.targetOverride?.branches ?? levelTarget;
  const overrideNote = inventoryEntry.targetOverride ? " (override)" : "";
  const distanceText =
    measuredFileCount === 0
      ? "distance not measured"
      : `${formatDistance("lines", linesTarget, linesByType.combined)}, ${formatDistance("branches", branchesTarget, branchesByType.combined)}`;
  outputLines.push(
    `  target: lines ${linesTarget}%, branches ${branchesTarget}%${overrideNote}; ${distanceText}`,
  );
  return outputLines;
}

function printFileList(listTitle, listedFiles) {
  console.log(`\n${listTitle}: ${listedFiles.length}`);
  for (const listedFile of listedFiles) {
    console.log(`  ${listedFile}`);
  }
}

function reportCoverageByInventoryEntry() {
  const inventoryEntries = readInventoryEntries(readFileSync(INVENTORY_PATH, "utf8"));
  const candidateFiles = listProductionCandidateFiles();
  const coverageByTestType = Object.fromEntries(
    MEASURED_TEST_TYPES.map((testType) => [testType, readCoverageByFile(testType)]),
  );

  const matchingEntriesByFile = new Map(candidateFiles.map((candidateFile) => [candidateFile, []]));
  const patternsWithoutFiles = [];
  const filesByEntry = new Map();
  for (const inventoryEntry of inventoryEntries) {
    const entryFiles = new Set();
    for (const filePattern of inventoryEntry.filePatterns) {
      const matchedFiles = candidateFiles.filter((candidateFile) =>
        path.posix.matchesGlob(candidateFile, filePattern),
      );
      if (matchedFiles.length === 0) {
        patternsWithoutFiles.push(`${inventoryEntry.entryId || "(no id)"}: ${filePattern}`);
      }
      matchedFiles.forEach((matchedFile) => entryFiles.add(matchedFile));
    }
    for (const entryFile of entryFiles) {
      matchingEntriesByFile.get(entryFile).push(inventoryEntry.entryId || "(no id)");
    }
    filesByEntry.set(inventoryEntry, [...entryFiles].sort());
  }

  console.log("\nCoverage by criticality inventory entry (docs/criticality-inventory.md)");
  console.log("Lines and branches per test type and combined; thresholds are not active (spec 005b).");
  console.log(
    "End-to-end (Playwright): not measured; the behaviors only browser tests protect are named in each entry.",
  );
  for (const testType of MEASURED_TEST_TYPES) {
    if (coverageByTestType[testType] === null) {
      console.log(`Note: no report for "${testType}" (coverage/${testType}/coverage-final.json is missing).`);
    }
  }

  let currentArea = null;
  for (const inventoryEntry of inventoryEntries.filter((entry) => entry.isProduction)) {
    if (inventoryEntry.area !== currentArea) {
      currentArea = inventoryEntry.area;
      console.log(`\n## ${currentArea}`);
    }
    const entryLines = describeEntryCoverage(
      inventoryEntry,
      filesByEntry.get(inventoryEntry),
      coverageByTestType,
    );
    console.log(entryLines.join("\n"));
  }
  const productionEntryCount = inventoryEntries.filter((entry) => entry.isProduction).length;
  if (productionEntryCount === 0) {
    console.log("\nThe inventory has no production entries yet.");
  }

  const unmatchedFiles = [...matchingEntriesByFile]
    .filter(([, matchingEntryIds]) => matchingEntryIds.length === 0)
    .map(([candidateFile]) => candidateFile);
  const duplicatedFiles = [...matchingEntriesByFile]
    .filter(([, matchingEntryIds]) => matchingEntryIds.length > 1)
    .map(([candidateFile, matchingEntryIds]) => `${candidateFile}  (${matchingEntryIds.join(", ")})`);
  printFileList("Files that match no inventory entry", unmatchedFiles);
  printFileList("Files that match more than one inventory entry", duplicatedFiles);
  printFileList("Inventory patterns that match no file", patternsWithoutFiles);
}

reportCoverageByInventoryEntry();
