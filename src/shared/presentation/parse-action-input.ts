import type { z } from "zod";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";

export const INVALID_INPUT_ISSUE_CODE = "INVALID_INPUT";

/** Field name used when the input is wrong as a whole (for example it is not an object). */
export const WHOLE_INPUT_FIELD = "input";

/**
 * Checks the shape of unknown input from the client with a Zod schema. Only the shape: business
 * rules belong to the domain. A failure becomes a `ValidationError` with one issue per field, all
 * with the code `INVALID_INPUT`. An unexpected key (for example a `userId`) is an issue on that key.
 */
export function parseActionInput<Output>(schema: z.ZodType<Output>, input: unknown): Output {
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    return parsed.data;
  }

  throw new ValidationError(collectIssuesByField(parsed.error.issues));
}

// The field names come from the client (an unknown key is reported under its own name), and they
// travel back in the response and into the logs. These limits keep a hostile body from turning
// the answer into a megabyte-sized echo. The real forms have at most four fields, so twelve names
// of sixty-four characters leave room for nested paths and never cut a real field name.
export const MAXIMUM_REPORTED_FIELDS = 12;
export const MAXIMUM_REPORTED_FIELD_NAME_LENGTH = 64;

/** The first fields that failed, in the order Zod reported them, each one once and with a bounded name. */
function collectIssuesByField(zodIssues: readonly z.core.$ZodIssue[]): ValidationIssue[] {
  const reportedFields = new Set<string>();
  for (const zodIssue of zodIssues) {
    for (const fieldName of findFieldNames(zodIssue)) {
      reportedFields.add(truncateFieldName(fieldName));
      if (reportedFields.size >= MAXIMUM_REPORTED_FIELDS) {
        return toIssues(reportedFields);
      }
    }
  }
  return toIssues(reportedFields);
}

function toIssues(fields: ReadonlySet<string>): ValidationIssue[] {
  return [...fields].map((field) => ({ field, code: INVALID_INPUT_ISSUE_CODE }));
}

// Cuts by code points, so a character made of two UTF-16 units is never split in half.
function truncateFieldName(fieldName: string): string {
  if (fieldName.length <= MAXIMUM_REPORTED_FIELD_NAME_LENGTH) {
    return fieldName;
  }
  let truncatedName = "";
  let codePointCount = 0;
  for (const codePoint of fieldName) {
    if (codePointCount === MAXIMUM_REPORTED_FIELD_NAME_LENGTH) {
      break;
    }
    truncatedName += codePoint;
    codePointCount += 1;
  }
  return truncatedName;
}

function findFieldNames(zodIssue: z.core.$ZodIssue): string[] {
  if (zodIssue.code === "unrecognized_keys") {
    return zodIssue.keys;
  }
  if (zodIssue.path.length === 0) {
    return [WHOLE_INPUT_FIELD];
  }
  return [zodIssue.path.map(String).join(".")];
}
