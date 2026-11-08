import { expect, type Page } from "@playwright/test";

/**
 * Waits until React has attached to the form of the page. A form submitted earlier is submitted by
 * the browser itself (a full page request), not by the application's code, so tests must not type
 * and press the button before this point.
 */
export async function waitForFormHydration(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page
        .locator("form")
        .first()
        .evaluate((form) => Object.keys(form).some((key) => key.startsWith("__reactProps$"))),
    )
    .toBe(true);
}
