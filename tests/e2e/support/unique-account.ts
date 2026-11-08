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
