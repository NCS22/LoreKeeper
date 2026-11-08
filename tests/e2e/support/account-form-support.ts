import type { Page, Request, Route } from "@playwright/test";
import { isServerActionRequest } from "./server-action-requests";

// Helpers shared by the browser tests of the sign-up and sign-in forms.

/** Looks for the Better Auth session cookie in the browser context; `undefined` when there is none. */
export async function findSessionCookieValue(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name.endsWith("session_token"))?.value;
}

/**
 * Runs `handleServerAction` for every Server Action call made to a page address that matches
 * `pageAddressPattern`; everything else goes through. Server Actions are POSTs to the page address.
 */
export async function interceptServerActionsOfPage(
  page: Page,
  pageAddressPattern: RegExp,
  handleServerAction: (route: Route, request: Request) => Promise<void>,
): Promise<void> {
  await page.route(pageAddressPattern, async (route) => {
    const request = route.request();
    if (isServerActionRequest(request)) {
      await handleServerAction(route, request);
    } else {
      await route.continue();
    }
  });
}

/** A promise a test can hold open (to keep an answer waiting) and open when it wants the answer to go on. */
export function createGate(): { wait: Promise<void>; open: () => void } {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}
