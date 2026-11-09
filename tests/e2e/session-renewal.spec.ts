import { expect as baseExpect, test, type Page } from "@playwright/test";
import { en } from "../../src/messages/en";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { isServerActionRequestWithText } from "./support/server-action-requests";
import {
  moveSessionRowsBackInTimeInDatabase,
  ONE_DAY_WITHOUT_USE,
  readSessionExpiryDatesInDatabase,
  THIRTY_ONE_DAYS_WITHOUT_USE,
} from "./support/session-rows-in-database";
import {
  readSessionSetCookies,
  THIRTY_DAYS_IN_SECONDS,
  type ParsedSetCookie,
} from "./support/set-cookie-lines";
import { signInThroughTheForm } from "./support/sign-in-through-the-form";
import { HEALTHY_SERVER_ADDRESS } from "./support/test-servers";
import { buildUniqueAccount } from "./support/unique-account";
import { waitForFormHydration } from "./support/wait-for-form-hydration";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// The session over a simulated passage of time, and the properties of its cookie, in a real browser
// (FR-16, FR-17, NFR-7; spec 002 FR-23 to FR-25 and FR-27 to FR-29 in real use).
//
// The limit, stated in plan D11: a real browser's clock (and the server's) cannot be moved. Passage of
// time is simulated the way real time would act on the stored values: the test moves `expiresAt` and
// `updatedAt` of the account's session rows back in the test database. The proof that the renewal
// reaches the browser is therefore (1) the `Set-Cookie` of every response, (2) the cookie the browser
// stores, which never moves backward, and (3) the server still accepting the session after 31 days.

// Sign-up and sign-in run a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const SIMULATED_DAYS_OF_DAILY_USE = 31;
// The browser and the test run on the same machine: a few minutes is a generous window for the
// distance between "now" and the end of a freshly written 30-day cookie.
const COOKIE_LIFETIME_TOLERANCE_IN_SECONDS = 300;
const signUpMessages = en.accountForms.signUp;
const signInMessages = en.accountForms.signIn;

/** What the `Set-Cookie` line of the session must say every time the server writes the session (FR-17, 002 FR-27, FR-28). */
function expectSessionCookieLine(cookie: ParsedSetCookie): void {
  expect(cookie.value, "the line carries a session value").not.toBe("");
  expect(cookie.attributes.get("max-age")).toBe(String(THIRTY_DAYS_IN_SECONDS));
  expect(cookie.attributes.has("httponly")).toBe(true);
  // Better Auth writes `SameSite=strict` in lower case; the value is compared without case.
  expect(String(cookie.attributes.get("samesite")).toLowerCase()).toBe("strict");
  expect(cookie.attributes.get("path")).toBe("/");
  // The test servers run over plain http: `Secure` is expected only over HTTPS (002 FR-29, a manual check).
  expect(cookie.attributes.has("secure")).toBe(false);
}

async function readStoredSessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  const sessionCookies = cookies.filter((cookie) => cookie.name.endsWith("session_token"));
  expect(sessionCookies, "the browser stores exactly one session cookie").toHaveLength(1);
  return sessionCookies[0];
}

/** What the browser stored: unreadable by scripts, not sent from other sites, whole site, 30 days from now. */
async function expectStoredSessionCookie(page: Page) {
  const storedCookie = await readStoredSessionCookie(page);
  expect(storedCookie.httpOnly).toBe(true);
  expect(storedCookie.sameSite).toBe("Strict");
  expect(storedCookie.path).toBe("/");
  expect(storedCookie.secure).toBe(false);
  const secondsUntilExpiry = storedCookie.expires - Date.now() / 1000;
  expect(secondsUntilExpiry).toBeGreaterThan(THIRTY_DAYS_IN_SECONDS - COOKIE_LIFETIME_TOLERANCE_IN_SECONDS);
  expect(secondsUntilExpiry).toBeLessThanOrEqual(THIRTY_DAYS_IN_SECONDS + COOKIE_LIFETIME_TOLERANCE_IN_SECONDS);
  return storedCookie;
}

async function openWorkspaceRoot(page: Page) {
  const response = await page.goto("/");
  if (response === null) {
    throw new Error("The navigation to the workspace root gave no response.");
  }
  return response;
}

test.describe("the session cookie after a real sign-up and sign-in (FR-17)", () => {
  test("sign-up writes a session cookie that scripts cannot read, from the same site only, for 30 days", async ({ page }) => {
    const account = buildUniqueAccount();
    await page.goto("/sign-up");
    await waitForFormHydration(page);
    await page.getByLabel(signUpMessages.displayNameLabel, { exact: true }).fill(account.displayName);
    await page.getByLabel(signUpMessages.emailLabel, { exact: true }).fill(account.email);
    await page.getByLabel(signUpMessages.passwordLabel, { exact: true }).fill(account.password);
    await page.getByLabel(signUpMessages.repeatPasswordLabel, { exact: true }).fill(account.password);
    const signUpResponse = page.waitForResponse((response) =>
      isServerActionRequestWithText(response.request(), account.email),
    );

    await page.getByRole("button", { name: signUpMessages.submit, exact: true }).click();

    const sessionLines = await readSessionSetCookies(await signUpResponse);
    expect(sessionLines).toHaveLength(1);
    expectSessionCookieLine(sessionLines[0]);
    await expect(page).toHaveURL("/");
    const storedCookie = await expectStoredSessionCookie(page);
    expect(storedCookie.name).toBe(sessionLines[0].name);
    expect(storedCookie.value).toBe(sessionLines[0].value);
    // Scripts in the page do not see it (002 FR-27).
    expect(await page.evaluate(() => document.cookie)).not.toContain("session_token");
  });

  test("sign-in writes the same kind of cookie", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await page.goto("/sign-in");
    await waitForFormHydration(page);
    await page.getByLabel(signInMessages.emailLabel).fill(account.email);
    await page.getByLabel(signInMessages.passwordLabel).fill(account.password);
    const signInResponse = page.waitForResponse((response) =>
      isServerActionRequestWithText(response.request(), account.email),
    );

    await page.getByRole("button", { name: signInMessages.submit, exact: true }).click();

    const sessionLines = await readSessionSetCookies(await signInResponse);
    expect(sessionLines).toHaveLength(1);
    expectSessionCookieLine(sessionLines[0]);
    await expect(page).toHaveURL("/");
    const storedCookie = await expectStoredSessionCookie(page);
    expect(storedCookie.value).toBe(sessionLines[0].value);
    expect(await page.evaluate(() => document.cookie)).not.toContain("session_token");
  });
});

test.describe("renewal of the session of a person who keeps using the application (FR-16)", () => {
  test("opening the workspace once a day for 31 simulated days keeps the person signed in, and every response renews the cookie", async ({ page }) => {
    test.setTimeout(180_000);
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    let previousCookie = await expectStoredSessionCookie(page);

    for (let simulatedDay = 1; simulatedDay <= SIMULATED_DAYS_OF_DAILY_USE; simulatedDay += 1) {
      // A day (plus a minute) without use: the once-a-day renewal of 002 FR-23 is due.
      await moveSessionRowsBackInTimeInDatabase(account.email, ONE_DAY_WITHOUT_USE);

      const response = await openWorkspaceRoot(page);

      const failureContext = `on simulated day ${simulatedDay}`;
      // Still signed in: the workspace answered itself, with no redirect to sign-in.
      expect(response.request().redirectedFrom(), failureContext).toBeNull();
      expect(response.url(), failureContext).toBe(`${HEALTHY_SERVER_ADDRESS}/`);
      expect(response.status(), failureContext).toBe(200);
      // The response carries the renewed session cookie, with the properties of FR-17.
      const sessionLines = await readSessionSetCookies(response);
      expect(sessionLines, failureContext).toHaveLength(1);
      expectSessionCookieLine(sessionLines[0]);
      expect(sessionLines[0].name, failureContext).toBe(previousCookie.name);
      // The cookie the browser stores is the renewed one and never moves backward (plan D11).
      const storedCookie = await expectStoredSessionCookie(page);
      expect(storedCookie.value, failureContext).toBe(previousCookie.value);
      expect(storedCookie.expires, failureContext).toBeGreaterThanOrEqual(previousCookie.expires);
      previousCookie = storedCookie;
    }

    // After more than 30 days the workspace is still there, and the server renewed the stored session
    // each day: without renewals its end would be more than a day in the past.
    await expectWorkspaceIsShown(page);
    const sessionExpiryDates = await readSessionExpiryDatesInDatabase(account.email);
    expect(sessionExpiryDates).toHaveLength(1);
    const daysUntilExpiry = (sessionExpiryDates[0].getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeGreaterThan(29.9);
    expect(daysUntilExpiry).toBeLessThanOrEqual(30.01);
  });

  test("a second opening on the same day does not write the cookie again (once a day at most, 002 FR-23)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    await moveSessionRowsBackInTimeInDatabase(account.email, ONE_DAY_WITHOUT_USE);

    // The headers of a response are read right after its navigation, before the next one starts.
    const firstOpening = await openWorkspaceRoot(page);
    const sessionLinesOfFirstOpening = await readSessionSetCookies(firstOpening);
    const secondOpening = await openWorkspaceRoot(page);
    const sessionLinesOfSecondOpening = await readSessionSetCookies(secondOpening);

    expect(sessionLinesOfFirstOpening).toHaveLength(1);
    expect(secondOpening.status()).toBe(200);
    expect(secondOpening.request().redirectedFrom()).toBeNull();
    expect(sessionLinesOfSecondOpening).toHaveLength(0);
    await expectWorkspaceIsShown(page);
  });

  test("a person absent for 31 simulated days is sent to sign in and the dead cookie is cleaned", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    const sessionCookie = await readStoredSessionCookie(page);
    await moveSessionRowsBackInTimeInDatabase(account.email, THIRTY_ONE_DAYS_WITHOUT_USE);

    const finalResponse = await openWorkspaceRoot(page);

    expect(page.url()).toBe(`${HEALTHY_SERVER_ADDRESS}/sign-in?returnTo=%2F`);
    await expect(page.getByRole("heading", { level: 1, name: signInMessages.title })).toBeVisible();
    // The first answer was the redirect, and it told the browser to delete the dead session cookie.
    const redirectRequest = finalResponse.request().redirectedFrom();
    expect(redirectRequest).not.toBeNull();
    const redirectResponse = await redirectRequest?.response();
    expect(redirectResponse?.status()).toBe(303);
    if (!redirectResponse) {
      throw new Error("The redirect has no response.");
    }
    const cleanupLines = await readSessionSetCookies(redirectResponse);
    expect(cleanupLines).toHaveLength(1);
    expect(cleanupLines[0].name).toBe(sessionCookie.name);
    expect(cleanupLines[0].value).toBe("");
    expect(cleanupLines[0].attributes.get("max-age")).toBe("0");
    const remainingSessionCookies = (await page.context().cookies()).filter((cookie) =>
      cookie.name.endsWith("session_token"),
    );
    expect(remainingSessionCookies).toHaveLength(0);
  });
});
