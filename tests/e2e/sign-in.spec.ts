import { expect as baseExpect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { en } from "../../src/messages/en";
import {
  createGate,
  findSessionCookieValue,
  interceptServerActionsOfPage,
} from "./support/account-form-support";
import { isServerActionRequest, isServerActionRequestWithText } from "./support/server-action-requests";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { buildUniqueAccount, E2E_ACCOUNT_PASSWORD } from "./support/unique-account";
import { waitForFormHydration } from "./support/wait-for-form-hydration";

// Sign-in page and form, driven as a person would (FR-2, FR-6 to FR-14, FR-19, FR-22, FR-30,
// NFR-1, NFR-2, NFR-5). Accounts are created directly in the test database; every test has its own.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const UNREACHABLE_DATA_SERVER_ADDRESS = "http://localhost:3101";
const SAMPLE_UNIVERSE_NAME = "The Ember Concordat";
const messages = en.accountForms;
const SIGN_IN_PAGE_ADDRESS_PATTERN = /\/sign-in(\?.*)?$/;

function findFormMessage(page: Page): Locator {
  // The framework adds its own route announcer with the same role; only the form's one counts here.
  return page.locator("form").getByRole("alert");
}

function findEmailField(page: Page): Locator {
  return page.getByLabel(messages.signIn.emailLabel);
}

function findPasswordField(page: Page): Locator {
  return page.getByLabel(messages.signIn.passwordLabel);
}

function findSubmitButton(page: Page): Locator {
  return page.getByRole("button", { name: messages.signIn.submit, exact: true });
}

async function openSignInPage(page: Page, address = "/sign-in"): Promise<void> {
  await page.goto(address);
  await waitForFormHydration(page);
}

async function typeCredentials(page: Page, email: string, password: string): Promise<void> {
  await findEmailField(page).fill(email);
  await findPasswordField(page).fill(password);
}

async function signInThroughTheForm(page: Page, email: string, password: string): Promise<void> {
  await typeCredentials(page, email, password);
  await findSubmitButton(page).click();
}

async function expectWorkspaceIsShown(page: Page): Promise<void> {
  await expect(page.getByText(SAMPLE_UNIVERSE_NAME).first()).toBeVisible();
}

/** Runs `handleServerAction` for every Server Action call the page makes; everything else goes through. */
async function interceptServerActions(
  page: Page,
  handleServerAction: (route: Route, request: Request) => Promise<void>,
): Promise<void> {
  await interceptServerActionsOfPage(page, SIGN_IN_PAGE_ADDRESS_PATTERN, handleServerAction);
}

test.describe("sign-in: the way in", () => {
  test("signing in with the right credentials lands in the workspace with a session (FR-2, FR-13)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await openSignInPage(page);

    await expect(page.getByRole("heading", { level: 1, name: messages.signIn.title })).toBeVisible();
    await signInThroughTheForm(page, account.email, account.password);

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(await findSessionCookieValue(page)).toBeTruthy();
  });

  test("the sign-in page is not a step of the history after signing in (FR-30)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await page.goto("/?start=1");
    await openSignInPage(page);

    await signInThroughTheForm(page, account.email, account.password);
    await expect(page).toHaveURL("/");
    await page.goBack();

    await expect(page).toHaveURL("/?start=1");
  });

  test("a valid destination in returnTo is followed with its query (FR-13, FR-19)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await openSignInPage(page, "/sign-in?returnTo=%2F%3Fx%3D1");

    await signInThroughTheForm(page, account.email, account.password);

    await expect(page).toHaveURL("/?x=1");
    await expectWorkspaceIsShown(page);
  });

  for (const unsafeDestination of [
    "https://evil.example/steal",
    "//evil.example",
    "%2F%2Fevil.example",
    "%2Fsign-in",
    "%2F_next%2Fstatic%2Fx.js",
    "javascript:alert(1)",
  ]) {
    test(`an unsafe destination (${unsafeDestination}) is ignored and the workspace root is used (FR-20)`, async ({ page }) => {
      const account = await seedAccountInDatabase();
      await openSignInPage(page, `/sign-in?returnTo=${unsafeDestination}`);

      await signInThroughTheForm(page, account.email, account.password);

      await expect(page).toHaveURL("/");
      await expectWorkspaceIsShown(page);
    });
  }

  test("the sign-up link carries the destination, also after a failed submission (FR-19)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const signUpLink = page.getByRole("link", { name: messages.signIn.switchLink });
    await openSignInPage(page, "/sign-in?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");
    await expect(signUpLink).toHaveAttribute("href", "/sign-up?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");

    await signInThroughTheForm(page, account.email, "not the password");
    await expect(findFormMessage(page)).toHaveText(messages.signIn.credentialsIncorrect);

    await expect(signUpLink).toHaveAttribute("href", "/sign-up?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");
    await expect(page).toHaveURL("/sign-in?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");
  });

  test("the sign-up link has no destination when there is none or it is unsafe", async ({ page }) => {
    const signUpLink = page.getByRole("link", { name: messages.signIn.switchLink });

    await openSignInPage(page);
    await expect(signUpLink).toHaveAttribute("href", "/sign-up");

    await openSignInPage(page, "/sign-in?returnTo=https%3A%2F%2Fevil.example");
    await expect(signUpLink).toHaveAttribute("href", "/sign-up");
  });
});

test.describe("sign-in: failures the account rules report", () => {
  test("a wrong password and an unknown email show the same message in the same place (FR-7)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await openSignInPage(page);

    await signInThroughTheForm(page, account.email, "not the password");
    await expect(findFormMessage(page)).toHaveText(messages.signIn.credentialsIncorrect);
    const placeAfterWrongPassword = await findFormMessage(page).boundingBox();

    await signInThroughTheForm(page, buildUniqueAccount().email, account.password);
    await expect(findFormMessage(page)).toHaveText(messages.signIn.credentialsIncorrect);
    const placeAfterUnknownEmail = await findFormMessage(page).boundingBox();

    expect(placeAfterWrongPassword).not.toBeNull();
    expect(placeAfterUnknownEmail).toEqual(placeAfterWrongPassword);
    await expect(page).toHaveURL(SIGN_IN_PAGE_ADDRESS_PATTERN);
  });

  test("empty fields give an error on each field and move the focus to the first one (FR-6, NFR-2)", async ({ page }) => {
    await openSignInPage(page);

    await findSubmitButton(page).click();

    const emailField = findEmailField(page);
    const passwordField = findPasswordField(page);
    await expect(page.getByText(messages.issues.emailRequired)).toBeVisible();
    await expect(page.getByText(messages.issues.passwordRequired)).toBeVisible();
    await expect(emailField).toBeFocused();
    await expect(emailField).toHaveAttribute("aria-invalid", "true");
    await expect(passwordField).toHaveAttribute("aria-invalid", "true");
  });

  test("each error is linked to its field with aria-describedby (NFR-2)", async ({ page }) => {
    await openSignInPage(page);

    await findSubmitButton(page).click();

    for (const [field, message] of [
      [findEmailField(page), messages.issues.emailRequired],
      [findPasswordField(page), messages.issues.passwordRequired],
    ] as const) {
      await expect(field).toHaveAttribute("aria-describedby", /.+/);
      const errorId = await field.getAttribute("aria-describedby");
      await expect(page.locator(`[id="${errorId}"]`)).toHaveText(message);
    }
  });

  test("a failed sign-in keeps the typed email, clears the password and focuses the message (FR-8, NFR-2)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await openSignInPage(page);

    await signInThroughTheForm(page, account.email, "not the password");

    await expect(findFormMessage(page)).toHaveText(messages.signIn.credentialsIncorrect);
    await expect(findEmailField(page)).toHaveValue(account.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findFormMessage(page)).toBeFocused();
  });

  test("no check of the browser stops a submission: an email without @ and a very long email reach the account rules (FR-3)", async ({ page }) => {
    await openSignInPage(page);
    const submissionsSent: Request[] = [];
    page.on("request", (request) => {
      if (isServerActionRequest(request)) submissionsSent.push(request);
    });

    await signInThroughTheForm(page, "not-an-email", E2E_ACCOUNT_PASSWORD);
    await expect(findFormMessage(page)).toHaveText(messages.signIn.credentialsIncorrect);
    expect(submissionsSent).toHaveLength(1);

    const veryLongEmail = `${"a".repeat(300)}@example.com`;
    await findEmailField(page).fill(veryLongEmail);
    await expect(findEmailField(page)).toHaveValue(veryLongEmail);
    await signInThroughTheForm(page, veryLongEmail, E2E_ACCOUNT_PASSWORD);
    await expect(findFormMessage(page)).toHaveText(messages.signIn.credentialsIncorrect);
    expect(submissionsSent).toHaveLength(2);
  });

  test("labels, input types and the absence of browser validation attributes (FR-3, NFR-2)", async ({ page }) => {
    await openSignInPage(page);

    const emailField = findEmailField(page);
    const passwordField = findPasswordField(page);
    await expect(emailField).toHaveAttribute("type", "text");
    await expect(emailField).toHaveAttribute("inputmode", "email");
    await expect(passwordField).toHaveAttribute("type", "password");
    for (const field of [emailField, passwordField]) {
      await expect(field).not.toHaveAttribute("required", /.*/);
      await expect(field).not.toHaveAttribute("pattern", /.*/);
      await expect(field).not.toHaveAttribute("maxlength", /.*/);
    }
    await expect(page.locator("form")).toHaveAttribute("novalidate", "");
  });

  test("the form can be completed and submitted with the keyboard only (NFR-1)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await openSignInPage(page);

    await page.keyboard.press("Tab");
    await expect(findEmailField(page)).toBeFocused();
    await page.keyboard.type(account.email);
    await page.keyboard.press("Tab");
    await expect(findPasswordField(page)).toBeFocused();
    await page.keyboard.type(account.password);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });
});

test.describe("sign-in: waiting and repeated submissions", () => {
  test("a double click sends one submission and ends signed in with no error (FR-12)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await openSignInPage(page);
    const signInRequests: Request[] = [];
    page.on("request", (request) => {
      if (isServerActionRequestWithText(request, account.email)) signInRequests.push(request);
    });
    await typeCredentials(page, account.email, account.password);

    await findSubmitButton(page).dblclick();

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(signInRequests).toHaveLength(1);
  });

  test("a repeated Enter sends one submission and ends signed in with no error (FR-12)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await openSignInPage(page);
    const signInRequests: Request[] = [];
    page.on("request", (request) => {
      if (isServerActionRequestWithText(request, account.email)) signInRequests.push(request);
    });
    await typeCredentials(page, account.email, account.password);

    await findPasswordField(page).press("Enter");
    await findPasswordField(page).press("Enter");
    await findPasswordField(page).press("Enter");

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(signInRequests).toHaveLength(1);
  });

  test("while waiting, the control is disabled, shows the in-progress label and the form is busy (NFR-5)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const answerGate = createGate();
    await interceptServerActions(page, async (route) => {
      await answerGate.wait;
      await route.continue();
    });
    await openSignInPage(page);

    await signInThroughTheForm(page, account.email, account.password);

    const waitingButton = page.getByRole("button", { name: messages.signIn.submitting, exact: true });
    await expect(waitingButton).toBeDisabled();
    await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");

    answerGate.open();
    await expect(page).toHaveURL("/");
  });
});

test.describe("sign-in: no usable answer", () => {
  test("a lost connection shows the result-unknown message, keeps the email and allows a retry (FR-10)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await interceptServerActions(page, (route) => route.abort());
    await openSignInPage(page);

    await signInThroughTheForm(page, account.email, account.password);

    await expect(findFormMessage(page)).toHaveText(messages.signIn.resultUnknown);
    await expect(findEmailField(page)).toHaveValue(account.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findSubmitButton(page)).toBeEnabled();
    await expect(findFormMessage(page)).toBeFocused();

    await page.unroute(SIGN_IN_PAGE_ADDRESS_PATTERN);
    await findPasswordField(page).fill(account.password);
    await findSubmitButton(page).click();

    await expect(page).toHaveURL("/");
  });

  test("no answer in 30 seconds shows the result-unknown message and allows a retry (FR-10, FR-11)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const neverAnsweredGate = createGate();
    let isFirstServerAction = true;
    await page.clock.install();
    await interceptServerActions(page, async (route) => {
      if (!isFirstServerAction) {
        await route.continue();
        return;
      }
      isFirstServerAction = false;
      await neverAnsweredGate.wait;
      await route.abort();
    });
    await openSignInPage(page);

    await signInThroughTheForm(page, account.email, account.password);
    await expect(page.getByRole("button", { name: messages.signIn.submitting, exact: true })).toBeDisabled();
    await page.clock.fastForward(29_000);
    await expect(page.getByRole("button", { name: messages.signIn.submitting, exact: true })).toBeDisabled();
    await expect(findFormMessage(page)).toHaveText("");
    await page.clock.fastForward(2_000);

    await expect(findFormMessage(page)).toHaveText(messages.signIn.resultUnknown);
    await expect(findEmailField(page)).toHaveValue(account.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findSubmitButton(page)).toBeEnabled();

    // The framework queues Server Action calls, so the stuck call has to end before a retry can go out.
    neverAnsweredGate.open();
    await findPasswordField(page).fill(account.password);
    await findSubmitButton(page).click();

    await expect(page).toHaveURL("/");
  });
});

test.describe("sign-in: failures outside the credentials", () => {
  test("a request marked as coming from another site shows the generic message and keeps the email (FR-9)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    // The browser sets this header itself and ignores a change made to its own request, so the call
    // is made by the test (same cookies, same body) with the header changed, and its answer is handed back.
    await interceptServerActions(page, async (route, request) => {
      const response = await route.fetch({ headers: { ...request.headers(), "sec-fetch-site": "cross-site" } });
      await route.fulfill({ response });
    });
    await openSignInPage(page);

    await signInThroughTheForm(page, account.email, account.password);

    await expect(findFormMessage(page)).toHaveText(messages.generalFailure);
    await expect(findEmailField(page)).toHaveValue(account.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(page).toHaveURL(SIGN_IN_PAGE_ADDRESS_PATTERN);
  });

  test("a failing data store shows the generic message and keeps the email (FR-9)", async ({ page }) => {
    const account = buildUniqueAccount();
    await openSignInPage(page, `${UNREACHABLE_DATA_SERVER_ADDRESS}/sign-in`);

    await signInThroughTheForm(page, account.email, account.password);

    await expect(findFormMessage(page)).toHaveText(messages.generalFailure);
    await expect(findEmailField(page)).toHaveValue(account.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findSubmitButton(page)).toBeEnabled();
  });

  test("a browser that keeps no cookie gets the storage message and no loop (FR-14)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await interceptServerActions(page, async (route) => {
      const response = await route.fetch();
      const headersWithoutCookies = { ...response.headers() };
      delete headersWithoutCookies["set-cookie"];
      // The fetch above stores the cookies it receives in the browser context; a browser that blocks
      // them stores nothing, so they are removed as well.
      await page.context().clearCookies();
      await route.fulfill({ response, headers: headersWithoutCookies });
    });
    await openSignInPage(page);

    await signInThroughTheForm(page, account.email, account.password);

    await expect(findFormMessage(page)).toHaveText(messages.signIn.storageBlocked);
    await expect(page).toHaveURL(SIGN_IN_PAGE_ADDRESS_PATTERN);
    await expect(findEmailField(page)).toHaveValue(account.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findSubmitButton(page)).toBeEnabled();
    expect(await findSessionCookieValue(page)).toBeUndefined();

    await page.unroute(SIGN_IN_PAGE_ADDRESS_PATTERN);
    await findPasswordField(page).fill(account.password);
    await findSubmitButton(page).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("sign-in: a session that already exists", () => {
  test("a second tab with a valid session submitting the form lands on the destination and keeps its session (FR-22)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const secondTab = await page.context().newPage();
    await openSignInPage(page);
    await openSignInPage(secondTab, "/sign-in?returnTo=%2F%3Fx%3D1");

    await signInThroughTheForm(page, account.email, account.password);
    await expect(page).toHaveURL("/");
    const sessionBeforeSecondSubmission = await findSessionCookieValue(page);
    expect(sessionBeforeSecondSubmission).toBeTruthy();

    await signInThroughTheForm(secondTab, account.email, account.password);

    await expect(secondTab).toHaveURL("/?x=1");
    await expectWorkspaceIsShown(secondTab);
    expect(await findSessionCookieValue(page)).toBe(sessionBeforeSecondSubmission);
  });
});
