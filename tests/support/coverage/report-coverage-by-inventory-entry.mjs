// Prints line and branch coverage per entry of the criticality inventory and enforces its targets
// (spec 005a, plan 2.2; thresholds turned on by spec 005b, plan 7.4).
//
// `pnpm test:coverage` runs the Vitest projects one at a time, each writing its own
// `coverage/<test type>/coverage-final.json`, and then runs this script. It reads those reports and
// the `Files`, `Level` and `Exceptions and floors` columns of `docs/criticality-inventory.md`, and
// prints for every entry the lines and branches covered by each test type and combined, the level,
// the required figure of each metric and the distance to it. The required figure is the override of
// the entry, else its floor, else the target of its level (CORE 100 %, IMPORTANT 80 %, TIER 0 none);
// it is compared with the combined figure as printed, with one decimal. It prints a notice for every
// override and floor in use and for every figure above its floor or override (raise or remove the
// record, spec 005b D-7). It prints everything first and then ends with a non-zero exit code when a
// CORE or IMPORTANT entry is below its required figure, when an override or floor is not in its
// written form, when a CORE entry records a floor (floors are for IMPORTANT entries only, spec 005b
// D-I5), or when a production file matches no entry or more than one. A pattern that matches
// no file is only a warning. `pnpm test` does not run this script and never fails on coverage.
//
// Tooling, not a production component: it carries no permanent test (spec 005a FR-14, spec 005b
// decision P12); it is checked by the temporary checks of spec 005b plan 7.4.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const INVENTORY_PATH = path.join(REPOSITORY_ROOT, "docs", "criticality-inventory.md");
const MEASURED_TEST_TYPES = ["unit", "database", "component"];
const METRIC_NAMES = ["lines", "branches"];
const TARGET_PERCENT_BY_LEVEL = { CORE: 100, IMPORTANT: 80, "TIER 0": null };
const NOT_PRODUCTION_HEADING_PREFIX = "Not production";
const GENERATED_SOURCE_PREFIX = "src/shared/infrastructure/generated/";
const EXCEPTIONS_COLUMN_NAME = "Exceptions and floors";

// Written forms of the `Exceptions and floors` cell (spec 005b, plan 7.4). A figure has one
// decimal at most. An override names both metrics; a floor names at least one.
const RECORD_FIGURE = String.raw`(\d+(?:\.\d)?)`;
const OVERRIDE_FORM = new RegExp(
  String.raw`^override: lines ${RECORD_FIGURE}, branches ${RECORD_FIGURE}, reason:(?: (.*))?$`,
);
const FLOOR_FORM = new RegExp(
  String.raw`^floor: (?:lines ${RECORD_FIGURE}(?:, branches ${RECORD_FIGURE})?|branches ${RECORD_FIGURE}), plan:(?: (.*))?$`,
);
const OVERRIDE_TOKEN = /\boverride:/i;
const FLOOR_TOKEN = /\bfloor:/i;
const OVERRIDE_WRITTEN_FORM = "override: lines <n>, branches <n>, reason: <text>";
const FLOOR_WRITTEN_FORM = "floor: lines <n>, branches <n>, plan: <text>";

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

function malformedRecord(problemText) {
  return { kind: "malformed", problemText };
}

function figuresAboveOneHundred(recordFigures) {
  return Object.entries(recordFigures).filter(([, recordFigure]) => recordFigure > 100);
}

// Builds a valid record, or a malformed one when a figure is above 100 % or the text is empty.
function buildRecord(recordKind, recordFigures, recordText) {
  const textLabel = recordKind === "override" ? "reason" : "plan";
  if ((recordText ?? "").trim() === "") {
    return malformedRecord(`the ${recordKind} has no ${textLabel}`);
  }
  const impossibleFigures = figuresAboveOneHundred(recordFigures);
  if (impossibleFigures.length > 0) {
    const impossibleText = impossibleFigures
      .map(([metricName, recordFigure]) => `${metricName} ${recordFigure}`)
      .join(", ");
    return malformedRecord(`the ${recordKind} has a figure above 100 (${impossibleText})`);
  }
  return { kind: recordKind, figures: recordFigures };
}

function readOverrideRecord(exceptionsCell) {
  const overrideMatch = OVERRIDE_FORM.exec(exceptionsCell);
  if (!overrideMatch) {
    return malformedRecord(`the override is not written as "${OVERRIDE_WRITTEN_FORM}"`);
  }
  const [, linesFigure, branchesFigure, reasonText] = overrideMatch;
  return buildRecord(
    "override",
    { lines: Number(linesFigure), branches: Number(branchesFigure) },
    reasonText,
  );
}

function readFloorRecord(exceptionsCell) {
  const floorMatch = FLOOR_FORM.exec(exceptionsCell);
  if (!floorMatch) {
    return malformedRecord(
      `the floor is not written as "${FLOOR_WRITTEN_FORM}" (at least one of the two metrics)`,
    );
  }
  const [, linesFigure, branchesAfterLinesFigure, branchesOnlyFigure, planText] = floorMatch;
  const branchesFigure = branchesAfterLinesFigure ?? branchesOnlyFigure;
  const floorFigures = {};
  if (linesFigure !== undefined) {
    floorFigures.lines = Number(linesFigure);
  }
  if (branchesFigure !== undefined) {
    floorFigures.branches = Number(branchesFigure);
  }
  return buildRecord("floor", floorFigures, planText);
}

// Reads the `Exceptions and floors` cell. Text with neither token (`-`, `Not measured: ...`) is no
// record; a cell with a token that is not exactly in its written form is a malformed record.
function readCoverageRecord(exceptionsCell) {
  const hasOverrideToken = OVERRIDE_TOKEN.test(exceptionsCell);
  const hasFloorToken = FLOOR_TOKEN.test(exceptionsCell);
  if (hasOverrideToken && hasFloorToken) {
    return malformedRecord("the cell holds both an override and a floor (at most one per entry)");
  }
  if (hasOverrideToken) {
    return readOverrideRecord(exceptionsCell);
  }
  if (hasFloorToken) {
    return readFloorRecord(exceptionsCell);
  }
  return { kind: "none" };
}

// A floor is allowed only on IMPORTANT entries: a CORE entry reaches its target or records an
// override (spec 005b D-I5). A floor on a CORE entry is a malformed record and is not applied.
function rejectFloorOnCoreEntry(entryLevel, coverageRecord) {
  if (entryLevel === "CORE" && coverageRecord.kind === "floor") {
    return malformedRecord(
      "a CORE entry cannot record a floor (floors are for IMPORTANT entries only; reach the target or record an override)",
    );
  }
  return coverageRecord;
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
    const entryLevel = normalizeLevel(cellByColumnName("Level"));
    inventoryEntries.push({
      entryId: cellByColumnName("Id").replaceAll("`", "") || "(no id)",
      area: currentHeading,
      isProduction: !currentHeading.startsWith(NOT_PRODUCTION_HEADING_PREFIX),
      filePatterns: readFilePatternsFromCell(cellByColumnName("Files")),
      level: entryLevel,
      coverageRecord: rejectFloorOnCoreEntry(
        entryLevel,
        readCoverageRecord(cellByColumnName(EXCEPTIONS_COLUMN_NAME)),
      ),
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

// The figure as printed, with one decimal (spec 005b FR-10): a record written as printed never
// fails at once, and a drop of at least one decimal does.
function printedPercentOf({ coveredCount, totalCount }) {
  return totalCount === 0 ? null : Number(((coveredCount / totalCount) * 100).toFixed(1));
}

function requiredFigureOf(metricName, levelTarget, coverageRecord) {
  const recordFigure = coverageRecord.figures?.[metricName];
  if (recordFigure !== undefined) {
    return { requiredPercent: recordFigure, source: coverageRecord.kind };
  }
  return { requiredPercent: levelTarget, source: "level target" };
}

// Compares one metric of an entry with its required figure. A metric with nothing to measure is
// not applicable and never fails.
function checkMetric(inventoryEntry, metricName, requiredFigure, measuredCounts) {
  const measuredPercent = printedPercentOf(measuredCounts);
  const { requiredPercent, source } = requiredFigure;
  if (measuredPercent === null) {
    return { distanceText: `${metricName} nothing to measure` };
  }
  if (measuredPercent < requiredPercent) {
    const missingPoints = (requiredPercent - measuredPercent).toFixed(1);
    return {
      distanceText: `${metricName} ${missingPoints} points below`,
      failureText: `${inventoryEntry.entryId} [${inventoryEntry.level}] ${metricName}: measured ${measuredPercent}%, required ${requiredPercent}% (${source})`,
    };
  }
  if (measuredPercent > requiredPercent && source !== "level target") {
    return {
      distanceText: `${metricName} met, above the ${source}`,
      noticeText: `${inventoryEntry.entryId} ${metricName}: measured ${measuredPercent}%, above its ${source} of ${requiredPercent}%; raise the ${source} to the new figure, or remove it when the target is reached`,
    };
  }
  return { distanceText: `${metricName} met` };
}

function describeCoverageRecord(coverageRecord) {
  const figureTexts = METRIC_NAMES.filter(
    (metricName) => coverageRecord.figures[metricName] !== undefined,
  ).map((metricName) => `${metricName} ${coverageRecord.figures[metricName]}`);
  return `${coverageRecord.kind}: ${figureTexts.join(", ")}`;
}

function measureEntryByTestType(entryFiles, coverageByTestType) {
  const typeNamesWithCombined = [...MEASURED_TEST_TYPES, "combined"];
  const countsByMetric = { lines: {}, branches: {} };
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
    countsByMetric.lines[typeName] = countHits(
      measuredCoverages.map((coverage) => coverage.lineHitByNumber),
    );
    countsByMetric.branches[typeName] = countHits(
      measuredCoverages.map((coverage) => coverage.branchHitByKey),
    );
  }
  return countsByMetric;
}

function describeMeasuredFigures(countsByMetric, coverageByTestType) {
  const typeNamesWithCombined = [...MEASURED_TEST_TYPES, "combined"];
  return METRIC_NAMES.map((metricName) => {
    const typeColumns = typeNamesWithCombined
      .map((typeName) =>
        coverageByTestType[typeName] === null
          ? `${typeName} not run`
          : `${typeName} ${formatPercent(countsByMetric[metricName][typeName])}`,
      )
      .join(" | ");
    return `  ${metricName.padEnd(8)} ${typeColumns} | e2e not measured`;
  });
}

// Returns the printed lines of an entry plus its failures, notices and the record it applies.
function checkEntryCoverage(inventoryEntry, entryFiles, coverageByTestType) {
  const entryResult = { outputLines: [], failureTexts: [], noticeTexts: [], recordInUseText: null };
  const { coverageRecord } = inventoryEntry;
  if (coverageRecord.kind === "malformed") {
    entryResult.failureTexts.push(
      `${inventoryEntry.entryId}: malformed record in "${EXCEPTIONS_COLUMN_NAME}": ${coverageRecord.problemText}`,
    );
  }

  const countsByMetric = measureEntryByTestType(entryFiles, coverageByTestType);
  const measuredFileCount = entryFiles.filter((entryFile) =>
    MEASURED_TEST_TYPES.some((testType) => coverageByTestType[testType]?.has(entryFile)),
  ).length;

  const levelLabel = inventoryEntry.level === "" ? "no level" : inventoryEntry.level;
  entryResult.outputLines.push(
    `${inventoryEntry.entryId}  [${levelLabel}]  ${entryFiles.length} file(s), ${measuredFileCount} with coverage data`,
  );
  if (measuredFileCount === 0) {
    entryResult.outputLines.push(
      "  lines and branches: not measured (no file of this entry is in a coverage report)",
    );
  } else {
    entryResult.outputLines.push(...describeMeasuredFigures(countsByMetric, coverageByTestType));
  }

  if (!(inventoryEntry.level in TARGET_PERCENT_BY_LEVEL)) {
    entryResult.outputLines.push(
      `  target: unknown level "${inventoryEntry.level}", expected CORE, IMPORTANT or TIER 0`,
    );
    return entryResult;
  }
  const levelTarget = TARGET_PERCENT_BY_LEVEL[inventoryEntry.level];
  if (levelTarget === null) {
    entryResult.outputLines.push("  target: none (TIER 0)");
    return entryResult;
  }

  const appliedRecord = coverageRecord.kind === "malformed" ? { kind: "none" } : coverageRecord;
  if (appliedRecord.kind !== "none") {
    entryResult.recordInUseText = `${inventoryEntry.entryId} ${describeCoverageRecord(appliedRecord)}`;
  }
  const requiredFigures = METRIC_NAMES.map((metricName) =>
    requiredFigureOf(metricName, levelTarget, appliedRecord),
  );
  const requiredText = METRIC_NAMES.map((metricName, metricIndex) => {
    const { requiredPercent, source } = requiredFigures[metricIndex];
    const sourceNote = source === "level target" ? "" : ` (${source})`;
    return `${metricName} ${requiredPercent}%${sourceNote}`;
  }).join(", ");
  const malformedNote =
    coverageRecord.kind === "malformed" ? " [malformed record not applied]" : "";

  if (measuredFileCount === 0) {
    entryResult.outputLines.push(`  target: ${requiredText}${malformedNote}; not measured`);
    return entryResult;
  }
  const metricChecks = METRIC_NAMES.map((metricName, metricIndex) =>
    checkMetric(
      inventoryEntry,
      metricName,
      requiredFigures[metricIndex],
      countsByMetric[metricName].combined,
    ),
  );
  for (const metricCheck of metricChecks) {
    if (metricCheck.failureText) {
      entryResult.failureTexts.push(metricCheck.failureText);
    }
    if (metricCheck.noticeText) {
      entryResult.noticeTexts.push(metricCheck.noticeText);
    }
  }
  const distanceText = metricChecks.map((metricCheck) => metricCheck.distanceText).join(", ");
  entryResult.outputLines.push(`  target: ${requiredText}${malformedNote}; ${distanceText}`);
  return entryResult;
}

function printList(listTitle, listedItems) {
  console.log(`\n${listTitle}: ${listedItems.length}`);
  for (const listedItem of listedItems) {
    console.log(`  ${listedItem}`);
  }
}

function matchFilesToEntries(inventoryEntries, candidateFiles) {
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
        patternsWithoutFiles.push(`${inventoryEntry.entryId}: ${filePattern}`);
      }
      matchedFiles.forEach((matchedFile) => entryFiles.add(matchedFile));
    }
    for (const entryFile of entryFiles) {
      matchingEntriesByFile.get(entryFile).push(inventoryEntry.entryId);
    }
    filesByEntry.set(inventoryEntry, [...entryFiles].sort());
  }
  const unmatchedFiles = [...matchingEntriesByFile]
    .filter(([, matchingEntryIds]) => matchingEntryIds.length === 0)
    .map(([candidateFile]) => candidateFile);
  const duplicatedFiles = [...matchingEntriesByFile]
    .filter(([, matchingEntryIds]) => matchingEntryIds.length > 1)
    .map(([candidateFile, matchingEntryIds]) => `${candidateFile}  (${matchingEntryIds.join(", ")})`);
  return { filesByEntry, unmatchedFiles, duplicatedFiles, patternsWithoutFiles };
}

function reportCoverageByInventoryEntry() {
  const inventoryEntries = readInventoryEntries(readFileSync(INVENTORY_PATH, "utf8"));
  const candidateFiles = listProductionCandidateFiles();
  const coverageByTestType = Object.fromEntries(
    MEASURED_TEST_TYPES.map((testType) => [testType, readCoverageByFile(testType)]),
  );
  const { filesByEntry, unmatchedFiles, duplicatedFiles, patternsWithoutFiles } =
    matchFilesToEntries(inventoryEntries, candidateFiles);

  console.log("\nCoverage by criticality inventory entry (docs/criticality-inventory.md)");
  console.log(
    "Lines and branches per test type and combined. Thresholds are active: each CORE and IMPORTANT entry must reach, in combined coverage as printed, its override, else its floor, else the target of its level (CORE 100 %, IMPORTANT 80 %); TIER 0 has none.",
  );
  console.log(
    "End-to-end (Playwright): not measured; the behaviors only browser tests protect are named in each entry.",
  );
  for (const testType of MEASURED_TEST_TYPES) {
    if (coverageByTestType[testType] === null) {
      console.log(`Note: no report for "${testType}" (coverage/${testType}/coverage-final.json is missing).`);
    }
  }

  const failureTexts = [];
  const noticeTexts = [];
  const recordsInUse = [];
  let currentArea = null;
  for (const inventoryEntry of inventoryEntries.filter((entry) => entry.isProduction)) {
    if (inventoryEntry.area !== currentArea) {
      currentArea = inventoryEntry.area;
      console.log(`\n## ${currentArea}`);
    }
    const entryResult = checkEntryCoverage(
      inventoryEntry,
      filesByEntry.get(inventoryEntry),
      coverageByTestType,
    );
    console.log(entryResult.outputLines.join("\n"));
    failureTexts.push(...entryResult.failureTexts);
    noticeTexts.push(...entryResult.noticeTexts);
    if (entryResult.recordInUseText) {
      recordsInUse.push(entryResult.recordInUseText);
    }
  }
  const productionEntryCount = inventoryEntries.filter((entry) => entry.isProduction).length;
  if (productionEntryCount === 0) {
    console.log("\nThe inventory has no production entries yet.");
  }

  printList("Notice: overrides and floors in use", recordsInUse);
  printList(
    "Notice: figures above their floor or override (raise the record to the new figure, or remove it when the target is reached)",
    noticeTexts,
  );
  printList("Files that match no inventory entry (failure)", unmatchedFiles);
  printList("Files that match more than one inventory entry (failure)", duplicatedFiles);
  printList("Inventory patterns that match no file (warning)", patternsWithoutFiles);

  failureTexts.push(
    ...unmatchedFiles.map((unmatchedFile) => `${unmatchedFile}: matches no inventory entry`),
    ...duplicatedFiles.map((duplicatedFile) => `${duplicatedFile}: matches more than one inventory entry`),
  );
  if (failureTexts.length === 0) {
    console.log("\nCoverage check passed.");
    return;
  }
  printList("Coverage check failed", failureTexts);
  process.exitCode = 1;
}

reportCoverageByInventoryEntry();
