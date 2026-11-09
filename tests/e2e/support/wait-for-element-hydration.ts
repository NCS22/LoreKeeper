import { expect, type Locator } from "@playwright/test";

/** Waits until React is attached to the element: a click before that does nothing. */
export async function waitForElementHydration(element: Locator): Promise<void> {
  await expect(element).toBeVisible();
  await expect
    .poll(() => element.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__reactProps$"))))
    .toBe(true);
}
