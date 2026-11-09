import { expect as baseExpect, type Locator, type Page } from "@playwright/test";
import { en } from "../../../src/messages/en";
import { waitForElementHydration } from "./wait-for-element-hydration";

const expect = baseExpect.configure({ timeout: 15_000 });

export function findMenuTrigger(page: Page): Locator {
  return page.getByRole("button", { name: en.userMenu.triggerLabel });
}

export function findMenuPanel(page: Page): Locator {
  return page.getByRole("dialog", { name: en.userMenu.panelTitle });
}

export function findSignOutButton(page: Page): Locator {
  return findMenuPanel(page).getByRole("button", { name: en.accountForms.signOut.submit, exact: true });
}

export function findMenuMessage(page: Page): Locator {
  return findMenuPanel(page).getByRole("alert");
}

/** Waits for the trigger to be hydrated (a click before that does nothing), clicks it and waits for the panel. */
export async function openUserMenu(page: Page): Promise<void> {
  await waitForElementHydration(findMenuTrigger(page));
  await findMenuTrigger(page).click();
  await expect(findMenuPanel(page)).toBeVisible();
}
