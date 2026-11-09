import { expect as baseExpect, test, type Locator, type Page, type Route } from "@playwright/test";
import { en } from "../../src/messages/en";
import {
  SESSION_CHECK_FAILED_ACTION_REFUSAL,
  SIGNED_OUT_ACTION_REFUSAL,
} from "../../src/shared/presentation/signed-out-action-response";
import { findSessionCookieValue, interceptServerActionsOfPage } from "./support/account-form-support";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { signInThroughTheForm } from "./support/sign-in-through-the-form";
import { waitForElementHydration } from "./support/wait-for-element-hydration";

// The not-found page and the error page (FR-23, FR-24, FR-28, FR-33, NFR-1, NFR-2): a signed-in person
// asking for an address that does not exist, a signed-out one asking for the same address, and the
// unreachable-data server (its data store cannot be reached) with the cookie of a signed-in person.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const UNREACHABLE_DATA_SERVER_ADDRESS = "http://localhost:3101";
const UNKNOWN_ADDRESS = "/no-such-address";
const SAMPLE_UNIVERSE_NAME = "The Ember Concordat";
const WORKSPACE_ROOT_ACTION_PATTERN = /^http:\/\/localhost:3100\/(\?.*)?$/;
const OPERATION_CALL_HEADERS = { "next-action": "0123456789abcdef", "content-type": "text/plain;charset=UTF-8" };
// Text that only the workspace shows: none of it may appear on the error page or in a refusal.
const WORKSPACE_ONLY_TEXTS = [
  SAMPLE_UNIVERSE_NAME,
  "Tidewrack",
  en.workspace.mainLabel,
  en.workspace.sidebarLabel,
  en.workspace.inspectorLabel,
  en.sidebar.newUniverse,
  en.center.graphView,
  en.menus.label,
];
const signInMessages = en.accountForms.signIn;
const signOutMessages = en.accountForms.signOut;

function findMenuTrigger(page: Page): Locator {
  return page.getByRole("button", { name: en.userMenu.triggerLabel });
}

function findMenuPanel(page: Page): Locator {
  return page.getByRole("dialog", { name: en.userMenu.panelTitle });
}

function findSignOutButton(page: Page): Locator {
  return findMenuPanel(page).getByRole("button", { name: signOutMessages.submit, exact: true });
}

function findMenuMessage(page: Page): Locator {
  return findMenuPanel(page).getByRole("alert");
}

async function openUserMenu(page: Page): Promise<void> {
  await waitForElementHydration(findMenuTrigger(page));
  await findMenuTrigger(page).click();
  await expect(findMenuPanel(page)).toBeVisible();
}

async function expectWorkspaceIsShown(page: Page): Promise<void> {
  await expect(page.getByText(SAMPLE_UNIVERSE_NAME).first()).toBeVisible();
}

/** Sends the call to the sign-out operation of the page to the unreachable-data server, with the person's cookie. */
async function redirectServerActionsToUnreachableDataServer(page: Page): Promise<void> {
  await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, async (route: Route) => {
    const response = await route.fetch({ url: `${UNREACHABLE_DATA_SERVER_ADDRESS}/` });
    await route.fulfill({ response });
  });
}

async function expectGenericErrorPage(page: Page): Promise<void> {
  const messages = en.sessionCheckFailed;
  await expect(page.getByRole("heading", { level: 1, name: messages.title })).toBeVisible();
  await expect(page.getByText(messages.description)).toBeVisible();
  await expect(page.getByRole("button", { name: messages.tryAgain })).toBeVisible();
  // Nothing of the workspace, no user menu (the session is unknown) and not the sign-in form.
  for (const workspaceText of WORKSPACE_ONLY_TEXTS) {
    await expect(page.getByText(workspaceText, { exact: true })).toHaveCount(0);
  }
  await expect(findMenuTrigger(page)).toHaveCount(0);
  await expect(page.getByLabel(signInMessages.emailLabel)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: signInMessages.title })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: en.accountForms.signUp.title })).toHaveCount(0);
}

test.describe("the not-found page (FR-23)", () => {
  test("a signed-in person sees the designed page with the top bar, the user menu and a link to the workspace root", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);

    const response = await page.goto(UNKNOWN_ADDRESS);

    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(UNKNOWN_ADDRESS);
    await expect(page.getByRole("heading", { level: 1, name: en.notFound.title })).toBeVisible();
    await expect(page.getByText(en.notFound.description)).toBeVisible();
    await expect(page).toHaveTitle(`${en.notFound.metadataTitle} - ${en.app.name}`);
    // The reduced top bar: brand, accessibility control and the user menu with the account in use.
    const topBar = page.getByRole("banner");
    await expect(topBar.getByText(en.app.name, { exact: true })).toBeVisible();
    await expect(topBar.getByRole("button", { name: en.accessibility.triggerLabel })).toBeVisible();
    await expect(findMenuTrigger(page)).toContainText(account.displayName);
    await expect(page.getByRole("link", { name: en.notFound.backToWorkspace })).toHaveAttribute("href", "/");
    // No workspace chrome: the side panels and the sample data are not part of this page.
    for (const workspaceText of WORKSPACE_ONLY_TEXTS) {
      await expect(page.getByText(workspaceText, { exact: true })).toHaveCount(0);
    }
  });

  test("the user menu works from the page: it shows the account and the sign-out ends on the sign-in page", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await page.goto(UNKNOWN_ADDRESS);
    await expect(page.getByRole("heading", { level: 1, name: en.notFound.title })).toBeVisible();

    await openUserMenu(page);
    await expect(findMenuPanel(page).getByText(account.displayName, { exact: true })).toBeVisible();
    await expect(findMenuPanel(page).getByText(account.email, { exact: true })).toBeVisible();
    await findSignOutButton(page).click();

    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: signInMessages.title })).toBeVisible();
    expect(await findSessionCookieValue(page)).toBeUndefined();
  });

  test("the link takes the person to the workspace root, with the keyboard too (NFR-1)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await page.goto(UNKNOWN_ADDRESS);
    const backLink = page.getByRole("link", { name: en.notFound.backToWorkspace });
    await expect(backLink).toBeVisible();

    await backLink.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });

  test("a signed-out person asking for the same address is sent to sign in, not shown the page (FR-18)", async ({ page }) => {
    const response = await page.goto(UNKNOWN_ADDRESS);

    await expect(page).toHaveURL(`/sign-in?returnTo=${encodeURIComponent(UNKNOWN_ADDRESS)}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: signInMessages.title })).toBeVisible();
    await expect(page.getByText(en.notFound.title)).toHaveCount(0);
  });

  test("the stored accessibility preferences are applied on the page (FR-33)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "lorekeeper.accessibility",
        JSON.stringify({ background: "midnight", text: "ash", textScalePercent: 125 }),
      );
    });
    await signInThroughTheForm(page, account);

    await page.goto(UNKNOWN_ADDRESS);

    await expect(page.getByRole("heading", { level: 1, name: en.notFound.title })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-bg", "midnight");
    await expect(page.locator("html")).toHaveAttribute("data-text", "ash");
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--text-scale"))).toBe("1.25");
  });
});

test.describe("the error page when the session cannot be checked (FR-24)", () => {
  const addressesOfTheUnreachableDataServer = ["/", "/sign-in", "/sign-up"];

  for (const address of addressesOfTheUnreachableDataServer) {
    test(`${address} shows the error page, not workspace content or the sign-in form, with no user menu, and "Try again" reloads`, async ({ page }) => {
      const account = await seedAccountInDatabase();
      await signInThroughTheForm(page, account);
      const sessionCookieValue = await findSessionCookieValue(page);
      expect(sessionCookieValue).toBeTruthy();
      const pageAddress = `${UNREACHABLE_DATA_SERVER_ADDRESS}${address}`;

      await page.goto(pageAddress);

      await expectGenericErrorPage(page);
      // The address stays as requested and the person is not treated as signed out.
      await expect(page).toHaveURL(pageAddress);
      expect(await findSessionCookieValue(page)).toBe(sessionCookieValue);

      const tryAgainButton = page.getByRole("button", { name: en.sessionCheckFailed.tryAgain });
      await waitForElementHydration(tryAgainButton);
      const reloadRequest = page.waitForRequest(
        (request) => request.isNavigationRequest() && request.url() === pageAddress,
      );
      await tryAgainButton.click();
      await reloadRequest;

      // The data store is still unreachable, so the same page comes back, still not signed out.
      await expectGenericErrorPage(page);
      await expect(page).toHaveURL(pageAddress);
      expect(await findSessionCookieValue(page)).toBe(sessionCookieValue);

      // The session was never touched: the healthy server still admits the person.
      await page.goto("/");
      await expectWorkspaceIsShown(page);
    });
  }

  test("the action can be reached and activated with the keyboard only (NFR-1)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    const pageAddress = `${UNREACHABLE_DATA_SERVER_ADDRESS}/`;
    await page.goto(pageAddress);
    const tryAgainButton = page.getByRole("button", { name: en.sessionCheckFailed.tryAgain });
    await waitForElementHydration(tryAgainButton);

    await page.keyboard.press("Tab");
    await expect(tryAgainButton).toBeFocused();
    const reloadRequest = page.waitForRequest(
      (request) => request.isNavigationRequest() && request.url() === pageAddress,
    );
    await page.keyboard.press("Enter");

    await reloadRequest;
    await expectGenericErrorPage(page);
  });

  test("the stored accessibility preferences are applied on the page (FR-33)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "lorekeeper.accessibility",
        JSON.stringify({ background: "midnight", text: "ash", textScalePercent: 125 }),
      );
    });
    await signInThroughTheForm(page, account);

    await page.goto(`${UNREACHABLE_DATA_SERVER_ADDRESS}/`);

    await expectGenericErrorPage(page);
    await expect(page.locator("html")).toHaveAttribute("data-bg", "midnight");
    await expect(page.locator("html")).toHaveAttribute("data-text", "ash");
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--text-scale"))).toBe("1.25");
  });
});

test.describe("sign-out and operation calls when the session cannot be checked (FR-24, FR-28)", () => {
  test("a sign-out made there is not run: it shows the FR-28 message, leaves the person in the workspace and allows a retry", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await expectWorkspaceIsShown(page);
    await redirectServerActionsToUnreachableDataServer(page);
    // The answer is fulfilled by the test for the page's own address, so it is told apart by its status.
    const refusal = page.waitForResponse(
      (response) => response.request().headers()["next-action"] !== undefined && response.status() === 503,
    );

    await openUserMenu(page);
    await findSignOutButton(page).click();

    await refusal;
    await expect(findMenuMessage(page)).toHaveText(signOutMessages.resultUnknown);
    await expect(findMenuMessage(page)).toBeFocused();
    // Not treated as signed out: still in the workspace, with the session cookie and an active control.
    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(await findSessionCookieValue(page)).toBeTruthy();
    await expect(findSignOutButton(page)).toBeEnabled();

    // A retry while the data store is still unreachable gives the same answer and still does not sign out.
    await findSignOutButton(page).click();
    await expect(findMenuMessage(page)).toHaveText(signOutMessages.resultUnknown);
    await expect(page).toHaveURL("/");

    // The operation never ran, so the session is still valid on the healthy server; a retry that reaches it works.
    await page.unroute(WORKSPACE_ROOT_ACTION_PATTERN);
    await findSignOutButton(page).click();
    await expect(page).toHaveURL("/sign-in");
    expect(await findSessionCookieValue(page)).toBeUndefined();
  });

  test("a forged operation call gets the 503 text and no workspace text, and is not read as signed out", async ({ page, request }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

    const response = await request.post(`${UNREACHABLE_DATA_SERVER_ADDRESS}/`, {
      headers: { ...OPERATION_CALL_HEADERS, cookie: cookieHeader },
      data: "[]",
      maxRedirects: 0,
    });

    expect(response.status()).toBe(SESSION_CHECK_FAILED_ACTION_REFUSAL.status);
    expect(response.status()).toBe(503);
    expect(response.headers()["content-type"]).toBe("text/plain");
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["location"]).toBeUndefined();
    const body = await response.text();
    expect(body).toBe(SESSION_CHECK_FAILED_ACTION_REFUSAL.text);
    // It is not the "signed out" refusal, which the application's own pages read as a sign-out.
    expect(body).not.toBe(SIGNED_OUT_ACTION_REFUSAL.text);
    const headersText = JSON.stringify(response.headers());
    for (const workspaceText of WORKSPACE_ONLY_TEXTS) {
      expect(body, `body contains "${workspaceText}"`).not.toContain(workspaceText);
      expect(headersText, `headers contain "${workspaceText}"`).not.toContain(workspaceText);
    }
  });
});
