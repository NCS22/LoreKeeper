import { expect as baseExpect, type Page } from "@playwright/test";
import { en } from "../../../src/messages/en";
import type { E2eAccount } from "./unique-account";
import { waitForFormHydration } from "./wait-for-form-hydration";

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const signInMessages = en.accountForms.signIn;

/**
 * Opens the sign-in page (`signInAddress`, with or without a return destination), fills the real form
 * of the healthy server and presses the button, without waiting for the answer.
 */
export async function submitSignInForm(page: Page, account: E2eAccount, signInAddress = "/sign-in"): Promise<void> {
  await page.goto(signInAddress);
  await waitForFormHydration(page);
  await page.getByLabel(signInMessages.emailLabel).fill(account.email);
  await page.getByLabel(signInMessages.passwordLabel).fill(account.password);
  await page.getByRole("button", { name: signInMessages.submit, exact: true }).click();
}

/** Signs in through the real sign-in form of the healthy server and waits for the workspace root. */
export async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await submitSignInForm(page, account);
  await expect(page).toHaveURL("/");
}
