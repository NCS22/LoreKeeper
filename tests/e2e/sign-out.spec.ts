import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Locator, type Page, type Request } from "@playwright/test";
import { en } from "../../src/messages/en";
import { SESSION_CHECK_FAILED_ACTION_REFUSAL } from "../../src/shared/presentation/signed-out-action-response";
import { createGate, findSessionCookieValue, interceptServerActionsOfPage } from "./support/account-form-support";
import { isServerActionRequest } from "./support/server-action-requests";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { signInThroughTheForm as signInThroughTheFormAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import { deleteSessionRowsInDatabase, expireSessionRowsInDatabase } from "./support/session-rows-in-database";
import { buildLongestEmail, buildUniqueAccount, LONGEST_DISPLAY_NAME, type E2eAccount } from "./support/unique-account";
import { HEALTHY_SERVER_ADDRESS, WORKSPACE_ROOT_ACTION_PATTERN } from "./support/test-servers";
import { findMenuMessage, findMenuPanel, findMenuTrigger, findSignOutButton, openUserMenu } from "./support/user-menu-locators";
import { waitForElementHydration } from "./support/wait-for-element-hydration";
import { waitForFormHydration } from "./support/wait-for-form-hydration";
import { expectWorkspaceIsShown, SAMPLE_UNIVERSE_NAME } from "./support/workspace-content";

// The user menu, sign-out, the back action and the clean start of the workspace (FR-25 to FR-32,
// NFR-1, NFR-2, NFR-5). Accounts are created directly in the test database; every test has its own.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const signInMessages = en.accountForms.signIn;
const signOutMessages = en.accountForms.signOut;

/** Signs in through the real form and waits until the workspace is shown. */
async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInThroughTheFormAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

/** The general message of the sign-in page's form, where a sign-out must leave no error. */
function findSignInFormMessage(page: Page): Locator {
  return page.locator("form").getByRole("alert");
}

function waitForMenuTriggerHydration(page: Page): Promise<void> {
  return waitForElementHydration(findMenuTrigger(page));
}

async function signOutFromTheMenu(page: Page): Promise<void> {
  await openUserMenu(page);
  await findSignOutButton(page).click();
}

async function expectSignedOutOnTheSignInPage(page: Page): Promise<void> {
  // Exactly the sign-in page: no return destination (FR-27).
  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: signInMessages.title })).toBeVisible();
  await expect(findSignInFormMessage(page)).toHaveText("");
}

function readTextContent(element: Locator): Promise<string | null> {
  return element.evaluate((node) => node.textContent);
}

function isSignOutCall(request: Request): boolean {
  return isServerActionRequest(request) && new URL(request.url()).pathname === "/";
}

async function createInMemoryUniverse(page: Page, universeName: string): Promise<void> {
  const newUniverseButton = page.getByRole("button", { name: en.sidebar.newUniverse });
  await waitForElementHydration(newUniverseButton);
  await newUniverseButton.click();
  await page.getByRole("textbox", { name: en.universeCreation.nameLabel, exact: true }).fill(universeName);
  await page.getByRole("button", { name: en.universeCreation.create, exact: true }).click();
  await expect(page.getByText(en.universeEmptyState.noContentYet)).toBeVisible();
}

test.describe("user menu: the name and the email (FR-25, FR-26)", () => {
  test("shows the display name and the email in full next to the sign-out action, and the name on the trigger (FR-25)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);

    await waitForMenuTriggerHydration(page);
    await expect(findMenuTrigger(page)).toContainText(account.displayName);
    await openUserMenu(page);

    const panel = findMenuPanel(page);
    await expect(panel.getByRole("heading", { level: 2, name: en.userMenu.panelTitle })).toBeVisible();
    await expect(panel.getByText(account.displayName, { exact: true })).toBeVisible();
    await expect(panel.getByText(account.email, { exact: true })).toBeVisible();
    await expect(findSignOutButton(page)).toBeVisible();
  });

  const unusualAccounts: ReadonlyArray<{ name: string; build: () => E2eAccount }> = [
    {
      name: "a display name of 120 characters and an email of 254 characters, with nothing to split them on",
      build: () => ({ ...buildUniqueAccount(), displayName: LONGEST_DISPLAY_NAME, email: buildLongestEmail() }),
    },
    {
      name: "markup in the display name",
      build: () => ({ ...buildUniqueAccount(), displayName: '<b>x</b><img src="x" onerror="alert(1)">' }),
    },
    {
      name: "direction-control and invisible characters in the display name",
      build: () => ({ ...buildUniqueAccount(), displayName: "Ann \u202Eevil\u2066 end\u2069 \u200F\u200Bz" }),
    },
  ];

  for (const unusualAccount of unusualAccounts) {
    test(`shows ${unusualAccount.name} in full, as plain text, isolated from the text around it (FR-26)`, async ({ page }) => {
      const account = await seedAccountInDatabase(unusualAccount.build());
      await signInThroughTheForm(page, account);
      await openUserMenu(page);

      const panel = findMenuPanel(page);
      const displayNameValue = panel.locator("dd").nth(0);
      const emailValue = panel.locator("dd").nth(1);
      expect(await readTextContent(displayNameValue)).toBe(account.displayName);
      expect(await readTextContent(emailValue)).toBe(account.email);
      // Plain text: nothing in the panel was parsed as an element.
      await expect(panel.locator("b, img")).toHaveCount(0);
      // Isolation: each value is inside its own isolated run, so it cannot reorder what is around it.
      for (const value of [displayNameValue, emailValue]) {
        const isolation = await value.locator("bdi").evaluate((bdi) => getComputedStyle(bdi).unicodeBidi);
        expect(isolation).toBe("isolate");
      }
      // The trigger carries the same name, also isolated, and never as markup.
      await expect(findMenuTrigger(page).locator("b, img")).toHaveCount(0);
      const triggerIsolation = await findMenuTrigger(page)
        .locator("bdi")
        .evaluate((bdi) => getComputedStyle(bdi).unicodeBidi);
      expect(triggerIsolation).toBe("isolate");
    });
  }

  test("two accounts with the same display name are told apart by their email (US-5)", async ({ page, browser }) => {
    const firstAccount = await seedAccountInDatabase();
    const secondAccount = await seedAccountInDatabase();
    expect(secondAccount.displayName).toBe(firstAccount.displayName);
    const secondContext = await browser.newContext({ baseURL: HEALTHY_SERVER_ADDRESS });
    const secondPage = await secondContext.newPage();
    try {
      await signInThroughTheForm(page, firstAccount);
      await signInThroughTheForm(secondPage, secondAccount);
      await openUserMenu(page);
      await openUserMenu(secondPage);

      await expect(findMenuPanel(page).getByText(firstAccount.email, { exact: true })).toBeVisible();
      await expect(findMenuPanel(page).getByText(secondAccount.email, { exact: true })).toHaveCount(0);
      await expect(findMenuPanel(secondPage).getByText(secondAccount.email, { exact: true })).toBeVisible();
      await expect(findMenuPanel(secondPage).getByText(firstAccount.email, { exact: true })).toHaveCount(0);
    } finally {
      await secondContext.close();
    }
  });

  test("at 320 px the menu keeps working with a 120-character name and a 254-character email and nothing scrolls sideways (FR-25, FR-26, NFR-6)", async ({ page }) => {
    const account = await seedAccountInDatabase({
      ...buildUniqueAccount(),
      displayName: LONGEST_DISPLAY_NAME,
      email: buildLongestEmail(),
    });
    await page.setViewportSize({ width: 320, height: 700 });
    await signInThroughTheForm(page, account);
    await openUserMenu(page);

    const panel = findMenuPanel(page);
    await expect(panel.getByText(account.displayName, { exact: true })).toBeVisible();
    await expect(panel.getByText(account.email, { exact: true })).toBeVisible();
    await expect(findSignOutButton(page)).toBeVisible();
    const widths = await panel.evaluate((panelElement) => ({
      panelScrollWidth: panelElement.scrollWidth,
      panelClientWidth: panelElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
    }));
    expect(widths.panelScrollWidth).toBeLessThanOrEqual(widths.panelClientWidth);
    expect(widths.documentScrollWidth).toBeLessThanOrEqual(widths.documentClientWidth);
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(320);
  });
});

test.describe("sign-out: the way out (FR-27)", () => {
  test("lands on the sign-in page with no destination and no error, and the workspace needs a new sign-in (FR-27)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);

    await signOutFromTheMenu(page);

    await expectSignedOutOnTheSignInPage(page);
    expect(await findSessionCookieValue(page)).toBeUndefined();
    await page.goto("/");
    await expect(page).toHaveURL("/sign-in?returnTo=%2F");
  });

  test("the old session is rejected afterwards and the session of another device stays valid", async ({ page, browser }) => {
    const account = await seedAccountInDatabase();
    const otherDeviceContext = await browser.newContext({ baseURL: HEALTHY_SERVER_ADDRESS });
    const otherDevicePage = await otherDeviceContext.newPage();
    const replayContext = await browser.newContext({ baseURL: HEALTHY_SERVER_ADDRESS });
    try {
      await signInThroughTheForm(page, account);
      await signInThroughTheForm(otherDevicePage, account);
      const endedSessionCookies = await page.context().cookies();

      await signOutFromTheMenu(page);
      await expectSignedOutOnTheSignInPage(page);

      // The ended session, presented again by someone who kept its cookie, is not accepted.
      await replayContext.addCookies(endedSessionCookies);
      const replayPage = await replayContext.newPage();
      await replayPage.goto("/");
      await expect(replayPage).toHaveURL("/sign-in?returnTo=%2F");
      await expect(replayPage.getByText(SAMPLE_UNIVERSE_NAME)).toHaveCount(0);

      // The other device's session was not touched.
      await otherDevicePage.reload();
      await expect(otherDevicePage).toHaveURL("/");
      await expectWorkspaceIsShown(otherDevicePage);
    } finally {
      await otherDeviceContext.close();
      await replayContext.close();
    }
  });

  const sessionsWithoutAValidRow: ReadonlyArray<{
    name: string;
    endSession: (page: Page, account: E2eAccount) => Promise<void>;
  }> = [
    {
      name: "the session row was deleted",
      endSession: (_page, account) => deleteSessionRowsInDatabase(account.email),
    },
    {
      name: "the session had already expired",
      endSession: (_page, account) => expireSessionRowsInDatabase(account.email),
    },
    {
      name: "the session was ended from another tab (and so it is signed out twice)",
      endSession: async (page) => {
        const otherTab = await page.context().newPage();
        await otherTab.goto("/");
        await expectWorkspaceIsShown(otherTab);
        await signOutFromTheMenu(otherTab);
        await expectSignedOutOnTheSignInPage(otherTab);
        await otherTab.close();
      },
    },
  ];

  for (const sessionWithoutAValidRow of sessionsWithoutAValidRow) {
    test(`still ends on the sign-in page with no error when ${sessionWithoutAValidRow.name} (FR-27)`, async ({ page }) => {
      const account = await seedAccountInDatabase();
      await signInThroughTheForm(page, account);
      await waitForMenuTriggerHydration(page);
      await sessionWithoutAValidRow.endSession(page, account);
      const refusal = page.waitForResponse(
        (response) => isSignOutCall(response.request()) && response.status() === 401,
      );

      await signOutFromTheMenu(page);

      // The guard refused the call because there is no session, and the menu read that as "signed out".
      await refusal;
      await expectSignedOutOnTheSignInPage(page);
    });
  }

  test("a double click sends one sign-out (FR-12)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    const signOutCalls: Request[] = [];
    page.on("request", (request) => {
      if (isSignOutCall(request)) signOutCalls.push(request);
    });
    await openUserMenu(page);

    await findSignOutButton(page).dblclick();

    await expectSignedOutOnTheSignInPage(page);
    expect(signOutCalls).toHaveLength(1);
  });

  test("while waiting, the control is disabled, shows the in-progress label and the panel is busy (NFR-5)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    const answerGate = createGate();
    await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, async (route) => {
      await answerGate.wait;
      await route.continue();
    });

    await signOutFromTheMenu(page);

    await expect(findMenuPanel(page).getByRole("button", { name: signOutMessages.submitting, exact: true })).toBeDisabled();
    await expect(findMenuPanel(page).locator("[aria-busy='true']")).toHaveCount(1);
    answerGate.open();
    await expectSignedOutOnTheSignInPage(page);
  });

  test("the menu can be used with the keyboard only (NFR-1)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await waitForMenuTriggerHydration(page);
    await findMenuTrigger(page).focus();

    await page.keyboard.press("Enter");
    await expect(findMenuPanel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(findMenuPanel(page)).toBeHidden();
    await expect(findMenuTrigger(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(findSignOutButton(page)).toBeFocused();
    await page.keyboard.press("Enter");

    await expectSignedOutOnTheSignInPage(page);
  });
});

test.describe("sign-out: no usable answer (FR-28)", () => {
  test("a lost connection tells the person the sign-out could not be confirmed, leaves them in the workspace and allows a retry", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, (route) => route.abort());

    await signOutFromTheMenu(page);

    await expect(findMenuMessage(page)).toHaveText(signOutMessages.resultUnknown);
    await expect(findMenuMessage(page)).toBeFocused();
    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    await expect(findSignOutButton(page)).toBeEnabled();
    expect(await findSessionCookieValue(page)).toBeTruthy();

    await page.unroute(WORKSPACE_ROOT_ACTION_PATTERN);
    await findSignOutButton(page).click();

    await expectSignedOutOnTheSignInPage(page);
  });

  test("no answer in 30 seconds gives the same message and allows a retry (FR-11)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    const neverAnsweredGate = createGate();
    let isFirstServerAction = true;
    await page.clock.install();
    await page.reload();
    await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, async (route) => {
      if (!isFirstServerAction) {
        await route.continue();
        return;
      }
      isFirstServerAction = false;
      await neverAnsweredGate.wait;
      await route.abort();
    });

    await signOutFromTheMenu(page);
    const waitingButton = findMenuPanel(page).getByRole("button", { name: signOutMessages.submitting, exact: true });
    await expect(waitingButton).toBeDisabled();
    await page.clock.fastForward(29_000);
    await expect(waitingButton).toBeDisabled();
    await expect(findMenuMessage(page)).toHaveText("");
    await page.clock.fastForward(2_000);

    await expect(findMenuMessage(page)).toHaveText(signOutMessages.resultUnknown);
    await expect(findSignOutButton(page)).toBeEnabled();
    await expect(page).toHaveURL("/");

    // The framework queues Server Action calls, so the stuck call has to end before a retry can go out.
    neverAnsweredGate.open();
    await findSignOutButton(page).click();

    await expectSignedOutOnTheSignInPage(page);
  });

  test("a refusal that says the session could not be checked is not read as signed out (FR-24, FR-28)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, (route) =>
      route.fulfill({
        status: SESSION_CHECK_FAILED_ACTION_REFUSAL.status,
        contentType: "text/plain",
        body: SESSION_CHECK_FAILED_ACTION_REFUSAL.text,
      }),
    );

    await signOutFromTheMenu(page);

    await expect(findMenuMessage(page)).toHaveText(signOutMessages.resultUnknown);
    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(await findSessionCookieValue(page)).toBeTruthy();
  });
});

test.describe("sign-out: the browser back action (FR-29, FR-30)", () => {
  test("after signing out, going back shows no workspace content and ends at the sign-in page (FR-29)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await page.goto("/?step=2");
    await expectWorkspaceIsShown(page);

    await signOutFromTheMenu(page);
    await expectSignedOutOnTheSignInPage(page);
    await page.goBack();

    // The earlier workspace entry is requested again, and without a session it is a redirect.
    await expect(page).toHaveURL("/sign-in?returnTo=%2F");
    await expect(page.getByRole("heading", { level: 1, name: signInMessages.title })).toBeVisible();
    await expect(page.getByText(SAMPLE_UNIVERSE_NAME)).toHaveCount(0);
  });

  test("after signing in, going back does not return to the sign-in page (FR-30)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await signOutFromTheMenu(page);
    await expectSignedOutOnTheSignInPage(page);
    // A signed-out request to the workspace is sent to sign in: it adds one more step to the history.
    await page.goto("/?start=1");
    await expect(page).toHaveURL("/sign-in?returnTo=%2F%3Fstart%3D1");
    await waitForFormHydration(page);
    await page.getByLabel(signInMessages.emailLabel).fill(account.email);
    await page.getByLabel(signInMessages.passwordLabel).fill(account.password);
    await page.getByRole("button", { name: signInMessages.submit, exact: true }).click();
    await expect(page).toHaveURL("/?start=1");

    await page.goBack();

    // The previous step is the plain sign-in page; with a session it sends the person to the workspace,
    // so the person lands on the exact workspace address and never sees a sign-in page again.
    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });
});

test.describe("sign-out: clean start of the workspace (FR-31, FR-32)", () => {
  test("a universe created in memory is gone after signing out and signing in; only the sample data shows", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const universeName = `Kept only in memory ${randomUUID()}`;
    await signInThroughTheForm(page, account);
    // The in-memory creation works as before (FR-31).
    await createInMemoryUniverse(page, universeName);
    await expect(page.getByText(universeName).first()).toBeVisible();
    await page.getByRole("button", { name: en.sidebar.newUniverse }).click();
    await expect(page.getByRole("heading", { level: 2, name: en.universeCreation.title })).toBeVisible();

    await signOutFromTheMenu(page);
    await expectSignedOutOnTheSignInPage(page);
    await signInThroughTheForm(page, account);

    await expectWorkspaceIsShown(page);
    await expect(page.getByText(universeName)).toHaveCount(0);
    await expect(page.getByText(en.universeEmptyState.noContentYet)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: en.universeCreation.title })).toHaveCount(0);
  });

  test("an \"already signed in\" answer in another tab leaves this tab's workspace, and its in-memory universe, as it is (FR-22, FR-32)", async ({ page }) => {
    // A failed sign-in cannot happen in a tab of the same browser once a session exists (the action
    // answers "already signed in" first), and a failed submission never leaves the form page; the
    // sign-in spec covers that the form stays as it is after a failure.
    const account = await seedAccountInDatabase();
    const universeName = `Kept only in memory ${randomUUID()}`;
    const otherTab = await page.context().newPage();
    await otherTab.goto("/sign-in");
    await waitForFormHydration(otherTab);

    await signInThroughTheForm(page, account);
    await createInMemoryUniverse(page, universeName);
    await page.evaluate(() => {
      document.documentElement.dataset.untouched = "yes";
    });

    await otherTab.getByLabel(signInMessages.emailLabel).fill(account.email);
    await otherTab.getByLabel(signInMessages.passwordLabel).fill(account.password);
    await otherTab.getByRole("button", { name: signInMessages.submit, exact: true }).click();
    await expect(otherTab).toHaveURL("/");

    await expect(page).toHaveURL("/");
    await expect(page.getByText(universeName).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-untouched", "yes");
  });
});
