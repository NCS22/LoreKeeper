import { expect as baseExpect, type Locator } from "@playwright/test";

// Under the load of parallel tests, the first render of the production build can take a while.
const expect = baseExpect.configure({ timeout: 15_000 });

/** Waits until React is attached to the element: a click before that does nothing. */
export async function waitForElementHydration(element: Locator): Promise<void> {
  await expect(element).toBeVisible();
  await expect
    .poll(() => element.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__reactProps$"))))
    .toBe(true);
}
