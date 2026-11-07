import { z } from "zod";
import { InfrastructureError } from "@/shared/domain/error-kinds";

const MINIMUM_AUTH_SECRET_LENGTH = 32;
// `.env.example` marks every value to fill in with text that starts like this.
const UNFILLED_PLACEHOLDER_PREFIX = "replace-with";

function isUnfilledPlaceholder(value: string): boolean {
  return value.toLowerCase().startsWith(UNFILLED_PLACEHOLDER_PREFIX);
}

/** The password as written in the URL, then percent-decoded when the text allows it. */
function listPasswordSpellings(passwordText: string): string[] {
  try {
    return [passwordText, decodeURIComponent(passwordText)];
  } catch {
    // A malformed percent sequence (`%zz`) cannot be decoded: the text as written is still checked.
    return [passwordText];
  }
}

/**
 * Looks at the password of the URL and at a `password` query parameter, both as written and
 * percent-decoded, so a malformed escape elsewhere in the text cannot hide the placeholder.
 */
function hasUnfilledPlaceholderPassword(databaseUrl: string): boolean {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    // Not a readable URL: the URL check reports it, and there is no password to inspect.
    return false;
  }
  const passwordTexts = [parsedUrl.password, ...parsedUrl.searchParams.getAll("password")];
  return passwordTexts.flatMap(listPasswordSpellings).some(isUnfilledPlaceholder);
}

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine((databaseUrl) => !hasUnfilledPlaceholderPassword(databaseUrl)),
  BETTER_AUTH_SECRET: z
    .string()
    .min(MINIMUM_AUTH_SECRET_LENGTH)
    .refine((authSecret) => !isUnfilledPlaceholder(authSecret)),
  BETTER_AUTH_URL: z.url(),
});

export type ServerEnvironment = {
  readonly databaseUrl: string;
  readonly authSecret: string;
  readonly authBaseUrl: string;
};

/**
 * Reads and validates the server environment. Nothing is read at import time:
 * the application must start and build without a `.env` file.
 *
 * A missing or invalid value, including a placeholder copied from `.env.example` and never
 * replaced, fails with a generic `InfrastructureError` that names the variables, never their values.
 */
export function readServerEnvironment(
  environmentVariables: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnvironment {
  const parsedEnvironment = serverEnvironmentSchema.safeParse(environmentVariables);

  if (!parsedEnvironment.success) {
    const invalidVariableNames = [
      ...new Set(parsedEnvironment.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new InfrastructureError(
      `Server environment is missing or invalid: ${invalidVariableNames.join(", ")}`,
    );
  }

  return {
    databaseUrl: parsedEnvironment.data.DATABASE_URL,
    authSecret: parsedEnvironment.data.BETTER_AUTH_SECRET,
    authBaseUrl: parsedEnvironment.data.BETTER_AUTH_URL,
  };
}
