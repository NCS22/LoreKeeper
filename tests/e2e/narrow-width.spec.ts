import { expect as baseExpect, test, type Locator, type Page } from "@playwright/test";
import { en } from "../../src/messages/en";
import { findSessionCookieValue, interceptServerActionsOfPage } from "./support/account-form-support";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { signInThroughTheForm } from "./support/sign-in-through-the-form";
import { UNREACHABLE_DATA_SERVER_ADDRESS, WORKSPACE_ROOT_ACTION_PATTERN } from "./support/test-servers";
import {
  buildLongestEmail,
  buildUniqueAccount,
  LONGEST_DISPLAY_NAME,
  type E2eAccount,
} from "./support/unique-account";
import {
  findMenuMessage,
  findMenuPanel,
  findMenuTrigger,
  findSignOutButton,
  openUserMenu,
} from "./support/user-menu-locators";
import { waitForElementHydration } from "./support/wait-for-element-hydration";
import { waitForFormHydration } from "./support/wait-for-form-hydration";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// The narrowest supported width (NFR-6, FR-26, FR-25): at 320 CSS pixels, with a display name of 120
// characters and an email of 254 characters, the sign-up page, the sign-in page, the user menu, the
// sign-out action, the not-found page and the error page have nothing that scrolls sideways and every
// control can be reached; both forms and the menu can be completed with the keyboard only (NFR-1).
// The error page of the session check and the boundary `error.tsx` share the same frame
// (`AccountPageShell`); only the first can be reached from outside without a test control in the
// application, so it is the one driven here.

// Sign-up and sign-in run a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const NARROWEST_WIDTH = 320;
// Sub-pixel rounding of boxes and scroll widths.
const LAYOUT_ROUNDING_TOLERANCE = 1;
const MAXIMUM_TAB_PRESSES_TO_REACH_A_CONTROL = 12;
const signUpMessages = en.accountForms.signUp;
const signInMessages = en.accountForms.signIn;

test.use({ viewport: { width: NARROWEST_WIDTH, height: 700 } });

function seedAccountWithLongestValues(): Promise<E2eAccount> {
  return seedAccountInDatabase({
    ...buildUniqueAccount(),
    displayName: LONGEST_DISPLAY_NAME,
    email: buildLongestEmail(),
  });
}

/** Nothing scrolls sideways: neither the document nor the body is wider than the 320 px viewport. */
async function expectNothingScrollsSideways(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(widths.viewportWidth).toBe(NARROWEST_WIDTH);
  expect(widths.documentScrollWidth).toBeLessThanOrEqual(widths.viewportWidth);
  expect(widths.bodyScrollWidth).toBeLessThanOrEqual(widths.viewportWidth);
}

/**
 * Every visible, enabled control (field, button, link) can be brought into view and lies fully inside
 * the width of the viewport, so a person can reach it without scrolling sideways. At least
 * `minimumControlCount` controls must have been found, so the check cannot pass on an empty page.
 */
async function expectEveryControlIsReachable(page: Page, minimumControlCount: number): Promise<void> {
  const controls = await page
    .locator("input:visible:not([disabled]), button:visible:not([disabled]), a[href]:visible")
    .all();
  expect(controls.length).toBeGreaterThanOrEqual(minimumControlCount);
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box, "a visible control has a box").not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-LAYOUT_ROUNDING_TOLERANCE);
    expect(box!.x + box!.width).toBeLessThanOrEqual(NARROWEST_WIDTH + LAYOUT_ROUNDING_TOLERANCE);
  }
}

/** Presses Tab until `target` has the focus; fails after a bounded number of presses. */
async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
  for (let pressCount = 0; pressCount < MAXIMUM_TAB_PRESSES_TO_REACH_A_CONTROL; pressCount += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`The control was not reached with Tab in ${MAXIMUM_TAB_PRESSES_TO_REACH_A_CONTROL} presses.`);
}

test.describe("sign-up at 320 px", () => {
  test("the page, its errors and the recovery work with the longest values and the keyboard only", async ({ page }) => {
    const email = buildLongestEmail();
    const password = buildUniqueAccount().password;
    await page.goto("/sign-up");
    await waitForFormHydration(page);
    await expect(page.getByRole("heading", { level: 1, name: signUpMessages.title })).toBeVisible();
    await expectNothingScrollsSideways(page);
    // Four fields, the button and the link to sign in.
    await expectEveryControlIsReachable(page, 6);

    // Keyboard only, with the longest values and a repeat password that differs.
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(signUpMessages.displayNameLabel, { exact: true })).toBeFocused();
    await page.keyboard.type(LONGEST_DISPLAY_NAME);
    await page.keyboard.press("Tab");
    await page.keyboard.type(email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(password);
    await page.keyboard.press("Tab");
    await page.keyboard.type(`${password}-different`);
    await expectNothingScrollsSideways(page);
    await page.keyboard.press("Enter");

    // The error shows on the repeat field and nothing scrolls sideways with the long values still typed.
    const repeatPasswordField = page.getByLabel(signUpMessages.repeatPasswordLabel, { exact: true });
    await expect(page.getByText(en.accountForms.issues.repeatPasswordMismatch)).toBeVisible();
    await expect(repeatPasswordField).toBeFocused();
    await expect(page.getByLabel(signUpMessages.emailLabel, { exact: true })).toHaveValue(email);
    await expectNothingScrollsSideways(page);
    await expectEveryControlIsReachable(page, 6);

    // Both passwords were cleared: back one field, type both again, and send with Enter.
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByLabel(signUpMessages.passwordLabel, { exact: true })).toBeFocused();
    await page.keyboard.type(password);
    await page.keyboard.press("Tab");
    await page.keyboard.type(password);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });

  test("the longest message of the form (the result is unknown) fits the width", async ({ page }) => {
    await interceptServerActionsOfPage(page, /\/sign-up(\?.*)?$/, (route) => route.abort());
    await page.goto("/sign-up");
    await waitForFormHydration(page);
    await page.getByLabel(signUpMessages.displayNameLabel, { exact: true }).fill(LONGEST_DISPLAY_NAME);
    await page.getByLabel(signUpMessages.emailLabel, { exact: true }).fill(buildLongestEmail());
    const { password } = buildUniqueAccount();
    await page.getByLabel(signUpMessages.passwordLabel, { exact: true }).fill(password);
    await page.getByLabel(signUpMessages.repeatPasswordLabel, { exact: true }).fill(password);

    await page.getByRole("button", { name: signUpMessages.submit, exact: true }).click();

    await expect(page.locator("form").getByRole("alert")).toHaveText(signUpMessages.resultUnknown);
    await expectNothingScrollsSideways(page);
    await expectEveryControlIsReachable(page, 6);
  });
});

test.describe("sign-in at 320 px", () => {
  test("the page, its error and the way in work with the longest email and the keyboard only", async ({ page }) => {
    const account = await seedAccountWithLongestValues();
    await page.goto("/sign-in");
    await waitForFormHydration(page);
    await expect(page.getByRole("heading", { level: 1, name: signInMessages.title })).toBeVisible();
    await expectNothingScrollsSideways(page);
    // Two fields, the button and the link to sign up.
    await expectEveryControlIsReachable(page, 4);

    // A wrong password with the longest email: the one credentials message, nothing scrolls sideways.
    await page.getByLabel(signInMessages.emailLabel).fill(account.email);
    await page.getByLabel(signInMessages.passwordLabel).fill("not the password");
    await page.getByRole("button", { name: signInMessages.submit, exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(signInMessages.credentialsIncorrect);
    await expectNothingScrollsSideways(page);
    await expectEveryControlIsReachable(page, 4);

    // Keyboard only on a fresh page.
    await page.goto("/sign-in");
    await waitForFormHydration(page);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(signInMessages.emailLabel)).toBeFocused();
    await page.keyboard.type(account.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(account.password);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });

  test("the longest message of the form (the result is unknown) fits the width", async ({ page }) => {
    const account = await seedAccountWithLongestValues();
    await interceptServerActionsOfPage(page, /\/sign-in(\?.*)?$/, (route) => route.abort());
    await page.goto("/sign-in");
    await waitForFormHydration(page);
    await page.getByLabel(signInMessages.emailLabel).fill(account.email);
    await page.getByLabel(signInMessages.passwordLabel).fill(account.password);

    await page.getByRole("button", { name: signInMessages.submit, exact: true }).click();

    await expect(page.locator("form").getByRole("alert")).toHaveText(signInMessages.resultUnknown);
    await expectNothingScrollsSideways(page);
    await expectEveryControlIsReachable(page, 4);
  });
});

test.describe("user menu and sign-out at 320 px", () => {
  test("the menu shows the 120-character name and the 254-character email in full, inside the viewport, and signs out with the keyboard only", async ({ page }) => {
    const account = await seedAccountWithLongestValues();
    await signInThroughTheForm(page, account);
    await expectWorkspaceIsShown(page);
    await expectNothingScrollsSideways(page);
    const trigger = findMenuTrigger(page);
    await waitForElementHydration(trigger);

    await trigger.focus();
    await page.keyboard.press("Enter");

    const panel = findMenuPanel(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByText(account.displayName, { exact: true })).toBeVisible();
    await expect(panel.getByText(account.email, { exact: true })).toBeVisible();
    await expectNothingScrollsSideways(page);
    const panelWidths = await panel.evaluate((panelElement) => ({
      scrollWidth: panelElement.scrollWidth,
      clientWidth: panelElement.clientWidth,
    }));
    expect(panelWidths.scrollWidth).toBeLessThanOrEqual(panelWidths.clientWidth);
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(-LAYOUT_ROUNDING_TOLERANCE);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(NARROWEST_WIDTH + LAYOUT_ROUNDING_TOLERANCE);
    await expect(findSignOutButton(page)).toBeInViewport();

    // The panel hands the focus to the sign-out action; Enter signs out.
    await expect(findSignOutButton(page)).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: signInMessages.title })).toBeVisible();
    expect(await findSessionCookieValue(page)).toBeUndefined();
    await expectNothingScrollsSideways(page);
  });

  test("the message of a sign-out that could not be confirmed fits the panel", async ({ page }) => {
    const account = await seedAccountWithLongestValues();
    await signInThroughTheForm(page, account);
    await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, (route) => route.abort());

    await openUserMenu(page);
    await findSignOutButton(page).click();

    await expect(findMenuMessage(page)).toHaveText(en.accountForms.signOut.resultUnknown);
    await expect(findMenuMessage(page)).toBeInViewport();
    await expectNothingScrollsSideways(page);
    const panelWidths = await findMenuPanel(page).evaluate((panelElement) => ({
      scrollWidth: panelElement.scrollWidth,
      clientWidth: panelElement.clientWidth,
    }));
    expect(panelWidths.scrollWidth).toBeLessThanOrEqual(panelWidths.clientWidth);
    await expect(findSignOutButton(page)).toBeEnabled();
  });
});

test.describe("the not-found page and the error page at 320 px", () => {
  test("the not-found page, with its top bar and user menu, has nothing that scrolls sideways and its link is reached with Tab", async ({ page }) => {
    const account = await seedAccountWithLongestValues();
    await signInThroughTheForm(page, account);

    await page.goto("/no-such-address");

    await expect(page.getByRole("heading", { level: 1, name: en.notFound.title })).toBeVisible();
    // The user menu streams in behind a placeholder: wait for the real trigger before counting controls.
    await waitForElementHydration(findMenuTrigger(page));
    await expectNothingScrollsSideways(page);
    // The accessibility control, the user menu and the link back to the workspace.
    await expectEveryControlIsReachable(page, 3);
    await openUserMenu(page);
    await expect(findMenuPanel(page).getByText(account.email, { exact: true })).toBeVisible();
    await expectNothingScrollsSideways(page);
    await page.keyboard.press("Escape");
    await expect(findMenuPanel(page)).toBeHidden();

    const backLink = page.getByRole("link", { name: en.notFound.backToWorkspace });
    await tabUntilFocused(page, backLink);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });

  test("the error page has nothing that scrolls sideways and its action is reached with Tab and runs with Enter", async ({ page }) => {
    const account = await seedAccountWithLongestValues();
    await signInThroughTheForm(page, account);
    const pageAddress = `${UNREACHABLE_DATA_SERVER_ADDRESS}/`;

    await page.goto(pageAddress);

    await expect(page.getByRole("heading", { level: 1, name: en.sessionCheckFailed.title })).toBeVisible();
    await expect(page.getByText(en.sessionCheckFailed.description)).toBeVisible();
    await expectNothingScrollsSideways(page);
    await expectEveryControlIsReachable(page, 1);
    const tryAgainButton = page.getByRole("button", { name: en.sessionCheckFailed.tryAgain });
    await waitForElementHydration(tryAgainButton);
    const reloadRequest = page.waitForRequest(
      (request) => request.isNavigationRequest() && request.url() === pageAddress,
    );
    await tabUntilFocused(page, tryAgainButton);
    await page.keyboard.press("Enter");

    await reloadRequest;
    await expect(page.getByRole("heading", { level: 1, name: en.sessionCheckFailed.title })).toBeVisible();
    await expectNothingScrollsSideways(page);
  });
});
