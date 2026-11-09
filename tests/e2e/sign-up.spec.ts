import { expect as baseExpect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { en } from "../../src/messages/en";
import {
  createGate,
  findSessionCookieValue,
  interceptServerActionsOfPage,
} from "./support/account-form-support";
import { isServerActionRequest, isServerActionRequestWithText } from "./support/server-action-requests";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { buildUniqueAccount, E2E_ACCOUNT_DISPLAY_NAME, E2E_ACCOUNT_PASSWORD } from "./support/unique-account";
import { UNREACHABLE_DATA_SERVER_ADDRESS } from "./support/test-servers";
import { waitForFormHydration } from "./support/wait-for-form-hydration";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// Sign-up page and form, driven as a person would (FR-1, FR-3 to FR-5, FR-8 to FR-14, FR-19, FR-22,
// FR-30, NFR-1, NFR-2, NFR-5). Every test uses its own unique email, so tests never collide.

// Sign-up and sign-in run a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const messages = en.accountForms;
const SIGN_UP_PAGE_ADDRESS_PATTERN = /\/sign-up(\?.*)?$/;
const MAXIMUM_DISPLAY_NAME_LENGTH = 120;
const MINIMUM_PASSWORD_LENGTH = 8;
const MAXIMUM_PASSWORD_LENGTH = 128;

// The control characters a single-line text field can hold (plan item 8): tab, bell and the Unicode
// line separator. Built from code points so no editor or tool can turn them into something else.
const CONTROL_CHARACTERS_BY_NAME = [
  ["tab", String.fromCharCode(0x0009)],
  ["bell (U+0007)", String.fromCharCode(0x0007)],
  ["line separator (U+2028)", String.fromCharCode(0x2028)],
] as const;

type SignUpValues = {
  displayName: string;
  email: string;
  password: string;
  repeatPassword: string;
};

function buildSignUpValues(overrides: Partial<SignUpValues> = {}): SignUpValues {
  return {
    displayName: E2E_ACCOUNT_DISPLAY_NAME,
    email: buildUniqueAccount().email,
    password: E2E_ACCOUNT_PASSWORD,
    repeatPassword: E2E_ACCOUNT_PASSWORD,
    ...overrides,
  };
}

function findFormMessage(page: Page): Locator {
  // The framework adds its own route announcer with the same role; only the form's one counts here.
  return page.locator("form").getByRole("alert");
}

function findDisplayNameField(page: Page): Locator {
  return page.getByLabel(messages.signUp.displayNameLabel, { exact: true });
}

function findEmailField(page: Page): Locator {
  return page.getByLabel(messages.signUp.emailLabel, { exact: true });
}

function findPasswordField(page: Page): Locator {
  // Exact: "Repeat password" also contains the word "password".
  return page.getByLabel(messages.signUp.passwordLabel, { exact: true });
}

function findRepeatPasswordField(page: Page): Locator {
  return page.getByLabel(messages.signUp.repeatPasswordLabel, { exact: true });
}

function findSubmitButton(page: Page): Locator {
  return page.getByRole("button", { name: messages.signUp.submit, exact: true });
}

function findSignInLink(page: Page): Locator {
  return page.getByRole("link", { name: messages.signUp.switchLink, exact: true });
}

async function openSignUpPage(page: Page, address = "/sign-up"): Promise<void> {
  await page.goto(address);
  await waitForFormHydration(page);
}

async function typeSignUpValues(page: Page, values: SignUpValues): Promise<void> {
  await findDisplayNameField(page).fill(values.displayName);
  await findEmailField(page).fill(values.email);
  await findPasswordField(page).fill(values.password);
  await findRepeatPasswordField(page).fill(values.repeatPassword);
}

async function signUpThroughTheForm(page: Page, values: SignUpValues): Promise<void> {
  await typeSignUpValues(page, values);
  await findSubmitButton(page).click();
}

async function signInThroughTheSignInPage(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/sign-in");
  await waitForFormHydration(page);
  await page.getByLabel(messages.signIn.emailLabel, { exact: true }).fill(email);
  await page.getByLabel(messages.signIn.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: messages.signIn.submit, exact: true }).click();
}

/** The message must be inside the block that the field points to with `aria-describedby` (NFR-2). */
async function expectErrorOnField(field: Locator, message: string, page: Page): Promise<void> {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAttribute("aria-describedby", /.+/);
  const errorBlockId = await field.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${errorBlockId}"]`)).toContainText(message);
}

async function expectNoErrorOnField(field: Locator): Promise<void> {
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await expect(field).not.toHaveAttribute("aria-describedby", /.*/);
}

/** Runs `handleServerAction` for every Server Action call the sign-up page makes; everything else goes through. */
async function interceptServerActions(
  page: Page,
  handleServerAction: (route: Route, request: Request) => Promise<void>,
): Promise<void> {
  await interceptServerActionsOfPage(page, SIGN_UP_PAGE_ADDRESS_PATTERN, handleServerAction);
}

test.describe("sign-up: the way in", () => {
  test("creating an account lands in the workspace root with a session (FR-1, FR-13)", async ({ page }) => {
    await openSignUpPage(page);

    await expect(page.getByRole("heading", { level: 1, name: messages.signUp.title })).toBeVisible();
    await signUpThroughTheForm(page, buildSignUpValues());

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(await findSessionCookieValue(page)).toBeTruthy();
  });

  test("the account created can sign in again with the same email and password", async ({ page }) => {
    const values = buildSignUpValues();
    await openSignUpPage(page);
    await signUpThroughTheForm(page, values);
    await expect(page).toHaveURL("/");
    await page.context().clearCookies();

    await signInThroughTheSignInPage(page, values.email, values.password);

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });

  test("the sign-up page is not a step of the history after signing up (FR-30)", async ({ page }) => {
    await page.goto("/?start=1");
    await openSignUpPage(page);

    await signUpThroughTheForm(page, buildSignUpValues());
    await expect(page).toHaveURL("/");
    await page.goBack();

    await expect(page).toHaveURL("/?start=1");
  });

  test("a valid destination in returnTo is followed with its query (FR-13, FR-19)", async ({ page }) => {
    await openSignUpPage(page, "/sign-up?returnTo=%2F%3Fx%3D1");

    await signUpThroughTheForm(page, buildSignUpValues());

    await expect(page).toHaveURL("/?x=1");
    await expectWorkspaceIsShown(page);
  });

  for (const unsafeDestination of ["https://evil.example/steal", "//evil.example", "%2Fsign-up", "%2Fsign-in"]) {
    test(`an unsafe destination (${unsafeDestination}) is ignored and the workspace root is used (FR-20)`, async ({ page }) => {
      await openSignUpPage(page, `/sign-up?returnTo=${unsafeDestination}`);

      await signUpThroughTheForm(page, buildSignUpValues());

      await expect(page).toHaveURL("/");
      await expectWorkspaceIsShown(page);
    });
  }

  test("the sign-in link carries the destination, also after a failed submission (FR-19)", async ({ page }) => {
    const signInLink = findSignInLink(page);
    await openSignUpPage(page, "/sign-up?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");
    await expect(signInLink).toHaveAttribute("href", "/sign-in?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");

    await signUpThroughTheForm(page, buildSignUpValues({ repeatPassword: "something else entirely" }));
    await expectErrorOnField(findRepeatPasswordField(page), messages.issues.repeatPasswordMismatch, page);

    await expect(signInLink).toHaveAttribute("href", "/sign-in?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");
    await expect(page).toHaveURL("/sign-up?returnTo=%2Fa%2Fb%3Fx%3D1%26y%3D2");
  });

  test("the sign-in link has no destination when there is none or it is unsafe", async ({ page }) => {
    await openSignUpPage(page);
    await expect(findSignInLink(page)).toHaveAttribute("href", "/sign-in");

    await openSignUpPage(page, "/sign-up?returnTo=https%3A%2F%2Fevil.example");
    await expect(findSignInLink(page)).toHaveAttribute("href", "/sign-in");
  });

  test("the destination is kept from the sign-in page to the sign-up page and back (FR-19)", async ({ page }) => {
    await page.goto("/sign-in?returnTo=%2F%3Fx%3D1");
    await page.getByRole("link", { name: messages.signIn.switchLink, exact: true }).click();
    await expect(page).toHaveURL("/sign-up?returnTo=%2F%3Fx%3D1");
    // The framework keeps the page just left in the document, hidden, so the page is loaded afresh
    // before typing: the labels of both forms would otherwise match.
    await page.reload();
    await waitForFormHydration(page);

    await signUpThroughTheForm(page, buildSignUpValues());

    await expect(page).toHaveURL("/?x=1");
  });
});

test.describe("sign-up: display name", () => {
  test("a name of 121 characters shows the error stating the maximum on that field (FR-4)", async ({ page }) => {
    await openSignUpPage(page);

    await signUpThroughTheForm(page, buildSignUpValues({ displayName: "a".repeat(MAXIMUM_DISPLAY_NAME_LENGTH + 1) }));

    await expectErrorOnField(
      findDisplayNameField(page),
      messages.issues.displayNameTooLong(MAXIMUM_DISPLAY_NAME_LENGTH),
      page,
    );
    await expect(page).toHaveURL(SIGN_UP_PAGE_ADDRESS_PATTERN);
  });

  test("a name of exactly 120 characters is accepted (FR-4)", async ({ page }) => {
    await openSignUpPage(page);

    await signUpThroughTheForm(page, buildSignUpValues({ displayName: "a".repeat(MAXIMUM_DISPLAY_NAME_LENGTH) }));

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });

  for (const [characterName, character] of CONTROL_CHARACTERS_BY_NAME) {
    test(`a name with a control character (${characterName}) shows the "not allowed" message (FR-4)`, async ({ page }) => {
      const displayNameWithControlCharacter = `Ada${character}Lovelace`;
      await openSignUpPage(page);

      await signUpThroughTheForm(page, buildSignUpValues({ displayName: displayNameWithControlCharacter }));

      // The field kept the character as typed: the page did not clean it before the rules saw it (FR-3).
      await expect(findDisplayNameField(page)).toHaveValue(displayNameWithControlCharacter);
      await expectErrorOnField(findDisplayNameField(page), messages.issues.displayNameInvalidCharacters, page);
    });
  }

  test("a name that is too long and has a control character gets the message the account rules choose (FR-4)", async ({ page }) => {
    // The account rules report one issue per field, in a fixed order of precedence, so the form
    // shows the one message they send; several messages on a field are shown by the interface
    // whenever an answer carries several issues (unit-tested with `account-issue-messages`).
    const tooLongNameWithControlCharacter = `${"a".repeat(MAXIMUM_DISPLAY_NAME_LENGTH)}${String.fromCharCode(0x0009)}b`;
    await openSignUpPage(page);

    await signUpThroughTheForm(page, buildSignUpValues({ displayName: tooLongNameWithControlCharacter }));

    await expectErrorOnField(findDisplayNameField(page), messages.issues.displayNameInvalidCharacters, page);
  });

  for (const emptyName of ["", "   "]) {
    test(`a name that is empty or only spaces (${JSON.stringify(emptyName)}) shows that it is required (FR-4)`, async ({ page }) => {
      await openSignUpPage(page);

      await signUpThroughTheForm(page, buildSignUpValues({ displayName: emptyName }));

      await expectErrorOnField(findDisplayNameField(page), messages.issues.displayNameRequired, page);
    });
  }
});

test.describe("sign-up: other fields and failures of the account rules", () => {
  test("a repeat password that differs shows the error on the repeat field only (FR-4)", async ({ page }) => {
    await openSignUpPage(page);

    await signUpThroughTheForm(page, buildSignUpValues({ repeatPassword: "a different password" }));

    await expectErrorOnField(findRepeatPasswordField(page), messages.issues.repeatPasswordMismatch, page);
    await expectNoErrorOnField(findPasswordField(page));
    await expectNoErrorOnField(findDisplayNameField(page));
    await expectNoErrorOnField(findEmailField(page));
  });

  test("an email that is not valid shows the error on the email field (FR-3, FR-4)", async ({ page }) => {
    await openSignUpPage(page);
    const submissionsSent: Request[] = [];
    page.on("request", (request) => {
      if (isServerActionRequest(request)) submissionsSent.push(request);
    });

    await signUpThroughTheForm(page, buildSignUpValues({ email: "not-an-email" }));

    // No check of the browser stopped it: the request reached the account rules.
    await expectErrorOnField(findEmailField(page), messages.issues.emailInvalid, page);
    expect(submissionsSent).toHaveLength(1);
  });

  for (const [description, password] of [
    ["too short", "a".repeat(MINIMUM_PASSWORD_LENGTH - 1)],
    ["too long", "a".repeat(MAXIMUM_PASSWORD_LENGTH + 1)],
  ] as const) {
    test(`a password ${description} shows the limits on the password field (FR-4)`, async ({ page }) => {
      await openSignUpPage(page);

      await signUpThroughTheForm(page, buildSignUpValues({ password, repeatPassword: password }));

      await expectErrorOnField(
        findPasswordField(page),
        messages.issues.passwordLength(MINIMUM_PASSWORD_LENGTH, MAXIMUM_PASSWORD_LENGTH),
        page,
      );
    });
  }

  test("an empty form shows an error on each field that needs one and focuses the first (FR-4, NFR-2)", async ({ page }) => {
    await openSignUpPage(page);

    await findSubmitButton(page).click();

    await expectErrorOnField(findDisplayNameField(page), messages.issues.displayNameRequired, page);
    await expectErrorOnField(findEmailField(page), messages.issues.emailInvalid, page);
    await expectErrorOnField(
      findPasswordField(page),
      messages.issues.passwordLength(MINIMUM_PASSWORD_LENGTH, MAXIMUM_PASSWORD_LENGTH),
      page,
    );
    await expect(findDisplayNameField(page)).toBeFocused();
  });

  test("the focus goes to the first field with an error, not to the first field (NFR-2)", async ({ page }) => {
    await openSignUpPage(page);

    await signUpThroughTheForm(page, buildSignUpValues({ email: "not-an-email", repeatPassword: "nope nope nope" }));

    await expectErrorOnField(findEmailField(page), messages.issues.emailInvalid, page);
    await expect(findEmailField(page)).toBeFocused();
  });

  test("an email that differs only in case and spaces from a registered one is reported as existing, and the lower-cased address signs in (FR-5)", async ({ page }) => {
    const registeredAccount = await seedAccountInDatabase();
    await openSignUpPage(page);

    await signUpThroughTheForm(
      page,
      buildSignUpValues({ email: `  ${registeredAccount.email.toUpperCase()}  ` }),
    );

    await expectErrorOnField(findEmailField(page), messages.emailAlreadyRegistered, page);
    await expect(findEmailField(page)).toHaveValue(`  ${registeredAccount.email.toUpperCase()}  `);
    await expect(page).toHaveURL(SIGN_UP_PAGE_ADDRESS_PATTERN);

    await signInThroughTheSignInPage(page, registeredAccount.email, registeredAccount.password);

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });

  test("a failed sign-up keeps the display name and the email, clears both passwords and focuses the field (FR-8, NFR-2)", async ({ page }) => {
    const values = buildSignUpValues({ displayName: "Ada Lovelace", repeatPassword: "a different password" });
    await openSignUpPage(page);

    await signUpThroughTheForm(page, values);

    await expectErrorOnField(findRepeatPasswordField(page), messages.issues.repeatPasswordMismatch, page);
    await expect(findDisplayNameField(page)).toHaveValue(values.displayName);
    await expect(findEmailField(page)).toHaveValue(values.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findRepeatPasswordField(page)).toHaveValue("");
    await expect(findRepeatPasswordField(page)).toBeFocused();
    await expect(findSubmitButton(page)).toBeEnabled();
  });

  test("the failed sign-up can be corrected and sent again (FR-8)", async ({ page }) => {
    const values = buildSignUpValues({ repeatPassword: "a different password" });
    await openSignUpPage(page);
    await signUpThroughTheForm(page, values);
    await expectErrorOnField(findRepeatPasswordField(page), messages.issues.repeatPasswordMismatch, page);

    await findPasswordField(page).fill(values.password);
    await findRepeatPasswordField(page).fill(values.password);
    await findSubmitButton(page).click();

    await expect(page).toHaveURL("/");
  });

  test("labels, input types, names and the absence of browser validation attributes (FR-3, NFR-2)", async ({ page }) => {
    await openSignUpPage(page);

    const displayNameField = findDisplayNameField(page);
    const emailField = findEmailField(page);
    const passwordField = findPasswordField(page);
    const repeatPasswordField = findRepeatPasswordField(page);
    await expect(displayNameField).toHaveAttribute("type", "text");
    await expect(emailField).toHaveAttribute("type", "text");
    await expect(emailField).toHaveAttribute("inputmode", "email");
    await expect(passwordField).toHaveAttribute("type", "password");
    await expect(repeatPasswordField).toHaveAttribute("type", "password");
    // A single-line field: a person cannot type a line break into it (plan item 8).
    expect(await displayNameField.evaluate((field) => field.tagName)).toBe("INPUT");
    for (const [field, name] of [
      [displayNameField, "displayName"],
      [emailField, "email"],
      [passwordField, "password"],
      [repeatPasswordField, "repeatPassword"],
    ] as const) {
      await expect(field).toHaveAttribute("name", name);
      await expect(field).not.toHaveAttribute("required", /.*/);
      await expect(field).not.toHaveAttribute("pattern", /.*/);
      await expect(field).not.toHaveAttribute("maxlength", /.*/);
    }
    const form = page.locator("form");
    await expect(form).toHaveAttribute("novalidate", "");
    await expect(form).toHaveAttribute("method", "post");
  });

  test("the form can be completed and submitted with the keyboard only (NFR-1)", async ({ page }) => {
    const values = buildSignUpValues();
    await openSignUpPage(page);

    await page.keyboard.press("Tab");
    await expect(findDisplayNameField(page)).toBeFocused();
    await page.keyboard.type(values.displayName);
    await page.keyboard.press("Tab");
    await expect(findEmailField(page)).toBeFocused();
    await page.keyboard.type(values.email);
    await page.keyboard.press("Tab");
    await expect(findPasswordField(page)).toBeFocused();
    await page.keyboard.type(values.password);
    await page.keyboard.press("Tab");
    await expect(findRepeatPasswordField(page)).toBeFocused();
    await page.keyboard.type(values.repeatPassword);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });
});

test.describe("sign-up: waiting and repeated submissions", () => {
  test("a double click sends one submission and ends signed in with no error (FR-12)", async ({ page }) => {
    const values = buildSignUpValues();
    await openSignUpPage(page);
    const signUpRequests: Request[] = [];
    page.on("request", (request) => {
      if (isServerActionRequestWithText(request, values.email)) signUpRequests.push(request);
    });
    await typeSignUpValues(page, values);

    await findSubmitButton(page).dblclick();

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(signUpRequests).toHaveLength(1);
  });

  test("a repeated Enter sends one submission and ends signed in with no error (FR-12)", async ({ page }) => {
    const values = buildSignUpValues();
    await openSignUpPage(page);
    const signUpRequests: Request[] = [];
    page.on("request", (request) => {
      if (isServerActionRequestWithText(request, values.email)) signUpRequests.push(request);
    });
    await typeSignUpValues(page, values);

    await findRepeatPasswordField(page).press("Enter");
    await findRepeatPasswordField(page).press("Enter");
    await findRepeatPasswordField(page).press("Enter");

    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(signUpRequests).toHaveLength(1);
  });

  test("while waiting, the control is disabled, shows the in-progress label and the form is busy (NFR-5)", async ({ page }) => {
    const answerGate = createGate();
    await interceptServerActions(page, async (route) => {
      await answerGate.wait;
      await route.continue();
    });
    await openSignUpPage(page);

    await signUpThroughTheForm(page, buildSignUpValues());

    const waitingButton = page.getByRole("button", { name: messages.signUp.submitting, exact: true });
    await expect(waitingButton).toBeDisabled();
    await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");

    answerGate.open();
    await expect(page).toHaveURL("/");
  });
});

test.describe("sign-up: no usable answer", () => {
  test("a lost connection says the account may exist, keeps the typed values and allows a retry (FR-10)", async ({ page }) => {
    const values = buildSignUpValues();
    await interceptServerActions(page, (route) => route.abort());
    await openSignUpPage(page);

    await signUpThroughTheForm(page, values);

    await expect(findFormMessage(page)).toHaveText(messages.signUp.resultUnknown);
    await expect(findDisplayNameField(page)).toHaveValue(values.displayName);
    await expect(findEmailField(page)).toHaveValue(values.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findRepeatPasswordField(page)).toHaveValue("");
    await expect(findSubmitButton(page)).toBeEnabled();
    await expect(findFormMessage(page)).toBeFocused();

    await page.unroute(SIGN_UP_PAGE_ADDRESS_PATTERN);
    await findPasswordField(page).fill(values.password);
    await findRepeatPasswordField(page).fill(values.password);
    await findSubmitButton(page).click();

    await expect(page).toHaveURL("/");
  });

  test("no answer in 30 seconds says the account may exist and allows a retry (FR-10, FR-11)", async ({ page }) => {
    const values = buildSignUpValues();
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
    await openSignUpPage(page);

    await signUpThroughTheForm(page, values);
    const waitingButton = page.getByRole("button", { name: messages.signUp.submitting, exact: true });
    await expect(waitingButton).toBeDisabled();
    await page.clock.fastForward(29_000);
    await expect(waitingButton).toBeDisabled();
    await expect(findFormMessage(page)).toHaveText("");
    await page.clock.fastForward(2_000);

    await expect(findFormMessage(page)).toHaveText(messages.signUp.resultUnknown);
    await expect(findDisplayNameField(page)).toHaveValue(values.displayName);
    await expect(findEmailField(page)).toHaveValue(values.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findRepeatPasswordField(page)).toHaveValue("");
    await expect(findSubmitButton(page)).toBeEnabled();

    // The framework queues Server Action calls, so the stuck call has to end before a retry can go out.
    neverAnsweredGate.open();
    await findPasswordField(page).fill(values.password);
    await findRepeatPasswordField(page).fill(values.password);
    await findSubmitButton(page).click();

    await expect(page).toHaveURL("/");
  });
});

test.describe("sign-up: failures outside the account rules", () => {
  test("a request marked as coming from another site shows the generic message and keeps the typed values (FR-9)", async ({ page }) => {
    const values = buildSignUpValues();
    // The browser sets this header itself and ignores a change made to its own request, so the call
    // is made by the test (same cookies, same body) with the header changed, and its answer is handed back.
    await interceptServerActions(page, async (route, request) => {
      const response = await route.fetch({ headers: { ...request.headers(), "sec-fetch-site": "cross-site" } });
      await route.fulfill({ response });
    });
    await openSignUpPage(page);

    await signUpThroughTheForm(page, values);

    await expect(findFormMessage(page)).toHaveText(messages.generalFailure);
    await expect(findDisplayNameField(page)).toHaveValue(values.displayName);
    await expect(findEmailField(page)).toHaveValue(values.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findRepeatPasswordField(page)).toHaveValue("");
    await expect(page).toHaveURL(SIGN_UP_PAGE_ADDRESS_PATTERN);
  });

  test("a failing data store shows the generic message and keeps the typed values (FR-9)", async ({ page }) => {
    const values = buildSignUpValues();
    await openSignUpPage(page, `${UNREACHABLE_DATA_SERVER_ADDRESS}/sign-up`);

    await signUpThroughTheForm(page, values);

    await expect(findFormMessage(page)).toHaveText(messages.generalFailure);
    await expect(findDisplayNameField(page)).toHaveValue(values.displayName);
    await expect(findEmailField(page)).toHaveValue(values.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findRepeatPasswordField(page)).toHaveValue("");
    await expect(findSubmitButton(page)).toBeEnabled();
  });

  test("a browser that keeps no cookie says the account was created, shows no loop and the account signs in (FR-14)", async ({ page }) => {
    const values = buildSignUpValues();
    await interceptServerActions(page, async (route) => {
      const response = await route.fetch();
      const headersWithoutCookies = { ...response.headers() };
      delete headersWithoutCookies["set-cookie"];
      // The fetch above stores the cookies it receives in the browser context; a browser that blocks
      // them stores nothing, so they are removed as well.
      await page.context().clearCookies();
      await route.fulfill({ response, headers: headersWithoutCookies });
    });
    await openSignUpPage(page);

    await signUpThroughTheForm(page, values);

    await expect(findFormMessage(page)).toHaveText(messages.signUp.storageBlocked);
    await expect(findFormMessage(page)).toContainText("account was created");
    await expect(page).toHaveURL(SIGN_UP_PAGE_ADDRESS_PATTERN);
    await expect(findDisplayNameField(page)).toHaveValue(values.displayName);
    await expect(findEmailField(page)).toHaveValue(values.email);
    await expect(findPasswordField(page)).toHaveValue("");
    await expect(findRepeatPasswordField(page)).toHaveValue("");
    await expect(findSubmitButton(page)).toBeEnabled();
    expect(await findSessionCookieValue(page)).toBeUndefined();

    // The account exists: once the browser keeps its cookies, signing in works.
    await page.unroute(SIGN_UP_PAGE_ADDRESS_PATTERN);
    await signInThroughTheSignInPage(page, values.email, values.password);
    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
  });
});

test.describe("sign-up: a session that already exists", () => {
  test("a second tab with a valid session submitting the form lands on the destination and keeps its session (FR-22)", async ({ page }) => {
    const secondTab = await page.context().newPage();
    await openSignUpPage(page);
    await openSignUpPage(secondTab, "/sign-up?returnTo=%2F%3Fx%3D1");

    await signUpThroughTheForm(page, buildSignUpValues());
    await expect(page).toHaveURL("/");
    const sessionBeforeSecondSubmission = await findSessionCookieValue(page);
    expect(sessionBeforeSecondSubmission).toBeTruthy();

    await signUpThroughTheForm(secondTab, buildSignUpValues());

    await expect(secondTab).toHaveURL("/?x=1");
    await expectWorkspaceIsShown(secondTab);
    expect(await findSessionCookieValue(page)).toBe(sessionBeforeSecondSubmission);
  });
});
