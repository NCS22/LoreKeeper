import { expect, type Page } from "@playwright/test";
import { en } from "../../../src/messages/en";
import type { E2eAccount } from "./unique-account";
import { waitForFormHydration } from "./wait-for-form-hydration";

const signInMessages = en.accountForms.signIn;

/** Fills and submits the real sign-in form of the healthy server and waits for the workspace root. */
export async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await page.goto("/sign-in");
  await waitForFormHydration(page);
  await page.getByLabel(signInMessages.emailLabel).fill(account.email);
  await page.getByLabel(signInMessages.passwordLabel).fill(account.password);
  await page.getByRole("button", { name: signInMessages.submit, exact: true }).click();
  await expect(page).toHaveURL("/");
}
