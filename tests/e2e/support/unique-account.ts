import { randomUUID } from "node:crypto";

// A valid password and display name for every account the end-to-end tests create. Only the email
// changes, so tests never collide.
export const E2E_ACCOUNT_PASSWORD = "correct horse battery";
export const E2E_ACCOUNT_DISPLAY_NAME = "E2E Reader";

export type E2eAccount = {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
};

/** A new account description with a unique email (`e2e-<random>@example.com`). Stores nothing. */
export function buildUniqueAccount(): E2eAccount {
  return {
    email: `e2e-${randomUUID()}@example.com`,
    password: E2E_ACCOUNT_PASSWORD,
    displayName: E2E_ACCOUNT_DISPLAY_NAME,
  };
}

/** A display name of exactly 120 characters, the longest the account rules accept. */
export const LONGEST_DISPLAY_NAME = "n".repeat(120);

/**
 * A unique, valid email of exactly 254 characters, the longest the account rules accept, with no
 * space or hyphen where a line could be broken (64 + 1 + 189 = 254; labels of at most 63 characters).
 */
export function buildLongestEmail(): string {
  const uniqueLocalPart = `e2e${randomUUID().replaceAll("-", "")}`.padEnd(64, "x");
  const domain = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(57)}.com`;
  return `${uniqueLocalPart}@${domain}`;
}
