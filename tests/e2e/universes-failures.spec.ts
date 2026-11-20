import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { CREATION_NOTICE_CODES } from "../../src/components/universes/universe-creation-state";
import { en } from "../../src/messages/en";
import { createGate, findSessionCookieValue, interceptServerActionsOfPage } from "./support/account-form-support";
import { provokeStorageFailure } from "./support/provoke-storage-failure";
import { readUniversesOfAccountInDatabase } from "./support/read-universes-in-database";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { isServerActionRequestWithText } from "./support/server-action-requests";
import { deleteSessionRowsInDatabase, expireSessionRowsInDatabase } from "./support/session-rows-in-database";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import { UNREACHABLE_DATA_SERVER_ADDRESS, WORKSPACE_ROOT_ACTION_PATTERN } from "./support/test-servers";
import type { E2eAccount } from "./support/unique-account";
import {
  expectListedUniverseNames,
  expectUniverseIsSelected,
  findCreateButton,
  findCreationFormHeading,
  findCreationMessages,
  findDescriptionField,
  findDuplicateNameWarning,
  findModeOption,
  findNameField,
  findUniverseTreeItems,
  fillCreationForm,
  openCreationForm,
  waitForNameCheckAnswer,
  waitForRememberAnswer,
} from "./support/universe-workspace-support";
import { waitForFormHydration } from "./support/wait-for-form-hydration";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// What the person sees when creating a universe does not go as planned (spec 004: FR-7 to FR-10,
// FR-33, NFR-5). Failures of the stored data are provoked outside the application with a database
// trigger (plan D12); a lost connection and a request that never ends with `page.route`; the 30
// seconds and the 5 minutes with the Playwright clock (a trigger can sleep only a few real seconds).

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const notices = en.universeCreation.notices;
const NOTICE_CODES = CREATION_NOTICE_CODES;
const THIRTY_SECONDS_AND_ONE = 31_000;
const FOUR_AND_A_HALF_MINUTES = 270_000;

async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

/** A page whose timers the test can move: installed before a reload, as the other specs do. */
async function reloadWithMovableClock(page: Page): Promise<void> {
  await page.clock.install();
  await page.reload();
  await expectWorkspaceIsShown(page);
}

function buildToken(): string {
  return randomUUID().slice(0, 8);
}

function findCreationMessageWithCode(page: Page, messageCode: string): Locator {
  return page.locator(`[data-message-code="${messageCode}"]`);
}

function findCreationForm(page: Page): Locator {
  return page.locator("form").filter({ has: findCreationFormHeading(page) });
}

function isCreationCall(request: Request): boolean {
  return isServerActionRequestWithText(request, '"mode"');
}

type InterceptedCreationCalls = {
  /** How many creation calls the page has made (a held one included). */
  readonly countCalls: () => number;
  /** Resolves when the first creation call reached the network and is being held. */
  readonly firstCallIsHeld: Promise<void>;
  /** The held call goes on to the server, whose answer then arrives late. */
  readonly letHeldCallThrough: () => Promise<void>;
  /** The held call ends as a lost connection. */
  readonly dropHeldCall: () => Promise<void>;
};

/**
 * Counts the creation calls of the page. With `holdFirstCall` the first one is kept waiting, as a
 * request that never ends, until the test lets it through or drops it; every other call goes on.
 */
async function interceptCreationCalls(page: Page, holdFirstCall: boolean): Promise<InterceptedCreationCalls> {
  const firstCallArrived = createGate();
  let callCount = 0;
  let heldRoute: Route | null = null;

  await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, async (route, request) => {
    if (!isCreationCall(request)) {
      await route.continue();
      return;
    }
    callCount += 1;
    if (holdFirstCall && callCount === 1) {
      heldRoute = route;
      firstCallArrived.open();
      return;
    }
    await route.continue();
  });

  function takeHeldRoute(): Route {
    if (heldRoute === null) throw new Error("No creation call is being held.");
    return heldRoute;
  }

  return {
    countCalls: () => callCount,
    firstCallIsHeld: firstCallArrived.wait,
    letHeldCallThrough: () => takeHeldRoute().continue(),
    dropHeldCall: () => takeHeldRoute().abort("connectionreset"),
  };
}

async function readStoredUniverseNames(account: E2eAccount): Promise<string[]> {
  return (await readUniversesOfAccountInDatabase(account.email)).map((universe) => universe.name);
}

async function expectNothingStored(account: E2eAccount): Promise<void> {
  expect(await readStoredUniverseNames(account)).toEqual([]);
}

/** The values typed in the form are still there, and the form accepts a new submission. */
async function expectValuesKeptAndFormUsable(
  page: Page,
  values: { name: string; description: string; mode: "READER" | "AUTHOR" },
): Promise<void> {
  await expect(findCreationFormHeading(page)).toBeVisible();
  await expect(findNameField(page)).toHaveValue(values.name);
  await expect(findDescriptionField(page)).toHaveValue(values.description);
  await expect(findModeOption(page, values.mode)).toBeChecked();
  await expect(findCreateButton(page)).toBeEnabled();
  await expect(findCreationForm(page)).toHaveAttribute("aria-busy", "false");
}

test.describe("a creation the storage refuses (FR-7)", () => {
  test("shows the generic message, keeps the values, stores nothing and lets the person try again", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const values = { name: `Refused ${buildToken()}`, description: "Typed before the failure", mode: "AUTHOR" } as const;
    await signInThroughTheForm(page, account);
    const storageFailure = await provokeStorageFailure({
      accountEmail: account.email,
      table: "Universe",
      behavior: { kind: "fail" },
    });
    try {
      await openCreationForm(page);
      await fillCreationForm(page, values);
      await findCreateButton(page).click();

      const failureMessage = findCreationMessageWithCode(page, NOTICE_CODES.failed);
      await expect(failureMessage).toHaveText(notices.failed);
      await expect(failureMessage).toHaveAttribute("role", "alert");
      await expect(failureMessage).toBeFocused();
      // Not the message of an unknown result, and nothing of the database in what the person reads.
      await expect(findCreationMessageWithCode(page, NOTICE_CODES.resultUnknown)).toHaveCount(0);
      expect(await page.locator("body").innerText()).not.toContain("provoked");
      await expectValuesKeptAndFormUsable(page, values);
      await expect(findUniverseTreeItems(page)).toHaveCount(0);
      await expectNothingStored(account);
    } finally {
      await storageFailure.remove();
    }

    // The same form, still open with the same values, creates the universe once the storage works.
    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expectUniverseIsSelected(page, values.name);
    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses.map((universe) => [universe.name, universe.description, universe.mode])).toEqual([
      [values.name, values.description, values.mode],
    ]);
  });
});

test.describe("a creation without a usable answer (FR-8)", () => {
  test("a lost connection shows the unknown-result message, with its own text and code, and releases the form", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const values = { name: `Lost connection ${buildToken()}`, description: "Kept", mode: "READER" } as const;
    await signInThroughTheForm(page, account);
    const creationCalls = await interceptCreationCalls(page, true);
    await openCreationForm(page);
    await fillCreationForm(page, values);

    await findCreateButton(page).click();
    await creationCalls.firstCallIsHeld;
    await creationCalls.dropHeldCall();

    const unknownResultMessage = findCreationMessageWithCode(page, NOTICE_CODES.resultUnknown);
    await expect(unknownResultMessage).toHaveText(notices.resultUnknown);
    await expect(unknownResultMessage).toHaveAttribute("role", "alert");
    expect(notices.resultUnknown).not.toBe(notices.failed);
    await expect(findCreationMessageWithCode(page, NOTICE_CODES.failed)).toHaveCount(0);
    await expectValuesKeptAndFormUsable(page, values);
    await expectNothingStored(account);

    // Trying again goes through: the first call never reached the server.
    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expectUniverseIsSelected(page, values.name);
    expect(await readStoredUniverseNames(account)).toEqual([values.name]);
  });

  test("no answer in 30 seconds shows the unknown-result message, keeps the form blocked while the request lives and frees it when it ends", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const values = { name: `No answer ${buildToken()}`, description: "Kept too", mode: "AUTHOR" } as const;
    await signInThroughTheForm(page, account);
    await reloadWithMovableClock(page);
    const creationCalls = await interceptCreationCalls(page, true);
    await openCreationForm(page);
    await fillCreationForm(page, values);

    await findCreateButton(page).click();
    await creationCalls.firstCallIsHeld;
    await expect(findCreateButton(page)).toBeDisabled();
    await expect(findCreationForm(page)).toHaveAttribute("aria-busy", "true");
    await page.clock.fastForward(29_000);
    await expect(findCreateButton(page)).toBeDisabled();
    await expect(findCreationMessages(page)).toHaveCount(0);

    await page.clock.fastForward(2_000);
    const unknownResultMessage = findCreationMessageWithCode(page, NOTICE_CODES.resultUnknown);
    await expect(unknownResultMessage).toHaveText(notices.resultUnknown);
    await expect(unknownResultMessage).toBeFocused();
    // The request is still alive: the form stays blocked, the person can still leave it.
    await expect(findCreateButton(page)).toBeDisabled();
    await expect(findCreationForm(page)).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: en.universeCreation.cancel, exact: true })).toBeEnabled();
    await expect(findNameField(page)).toHaveValue(values.name);
    await expect(findDescriptionField(page)).toHaveValue(values.description);

    // The request ends (no answer will come): the message stays and the form is usable again.
    await creationCalls.dropHeldCall();
    await expectValuesKeptAndFormUsable(page, values);
    await expect(unknownResultMessage).toHaveText(notices.resultUnknown);
    await expectNothingStored(account);

    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    expect(await readStoredUniverseNames(account)).toEqual([values.name]);
  });

  test("a storage that answers slowly: the unknown-result message appears at 30 seconds and the real answer replaces it with the confirmation", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const universeName = `Slow storage ${buildToken()}`;
    await signInThroughTheForm(page, account);
    await reloadWithMovableClock(page);
    // The write waits a few real seconds; the clock of the page is moved past 30 seconds meanwhile.
    const storageFailure = await provokeStorageFailure({
      accountEmail: account.email,
      table: "Universe",
      behavior: { kind: "sleep", seconds: 5 },
    });
    try {
      await openCreationForm(page);
      await fillCreationForm(page, { name: universeName, description: "Arrives late" });
      const creationCallReachedTheNetwork = page.waitForRequest(isCreationCall);
      await findCreateButton(page).click();
      await creationCallReachedTheNetwork;
      await page.clock.fastForward(THIRTY_SECONDS_AND_ONE);

      const unknownResultMessage = findCreationMessageWithCode(page, NOTICE_CODES.resultUnknown);
      await expect(unknownResultMessage).toHaveText(notices.resultUnknown);
      await expect(findCreateButton(page)).toBeDisabled();

      // The answer arrives: a normal success (added, selected, remembered) with the confirmation.
      const confirmation = findCreationMessageWithCode(page, NOTICE_CODES.confirmedAfterDelay);
      await expect(confirmation).toHaveText(notices.confirmedAfterDelay);
      await expect(confirmation).toHaveAttribute("role", "status");
      await expect(unknownResultMessage).toHaveCount(0);
      await expect(findCreationFormHeading(page)).toHaveCount(0);
      await expectListedUniverseNames(page, [universeName]);
      await expectUniverseIsSelected(page, universeName);
      expect(await readStoredUniverseNames(account)).toEqual([universeName]);

      await page.getByRole("button", { name: notices.dismiss, exact: true }).click();
      await expect(findCreationMessages(page)).toHaveCount(0);
    } finally {
      await storageFailure.remove();
    }
  });

  test("an answer that arrives after the person left the form still adds and selects the universe, with the confirmation", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const universeName = `Left the form ${buildToken()}`;
    await signInThroughTheForm(page, account);
    await reloadWithMovableClock(page);
    const creationCalls = await interceptCreationCalls(page, true);
    await openCreationForm(page);
    await fillCreationForm(page, { name: universeName });
    await findCreateButton(page).click();
    await creationCalls.firstCallIsHeld;
    await page.clock.fastForward(THIRTY_SECONDS_AND_ONE);
    await expect(findCreationMessageWithCode(page, NOTICE_CODES.resultUnknown)).toBeVisible();

    await page.getByRole("button", { name: en.universeCreation.cancel, exact: true }).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expectListedUniverseNames(page, []);

    await creationCalls.letHeldCallThrough();

    await expectListedUniverseNames(page, [universeName]);
    await expectUniverseIsSelected(page, universeName);
    await expect(findCreationMessageWithCode(page, NOTICE_CODES.confirmedAfterDelay)).toHaveText(
      notices.confirmedAfterDelay,
    );
    expect(await readStoredUniverseNames(account)).toEqual([universeName]);
  });
});

test.describe("a request that never ends: the 5-minute cap (FR-8)", () => {
  test("after 5 minutes the form is usable again with the message and the values kept; the late answer adds and selects the universe, and the duplicate warning shows", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const values = { name: `Very late ${buildToken()}`, description: "Still here", mode: "AUTHOR" } as const;
    await signInThroughTheForm(page, account);
    await reloadWithMovableClock(page);
    const creationCalls = await interceptCreationCalls(page, true);
    await openCreationForm(page);
    await fillCreationForm(page, values);
    await findCreateButton(page).click();
    await creationCalls.firstCallIsHeld;

    await page.clock.fastForward(THIRTY_SECONDS_AND_ONE);
    const unknownResultMessage = findCreationMessageWithCode(page, NOTICE_CODES.resultUnknown);
    await expect(unknownResultMessage).toHaveText(notices.resultUnknown);
    await expect(findCreateButton(page)).toBeDisabled();

    // Five minutes after the submission the form is released although the request is still alive.
    await page.clock.fastForward(FOUR_AND_A_HALF_MINUTES);
    await expectValuesKeptAndFormUsable(page, values);
    await expect(unknownResultMessage).toHaveText(notices.resultUnknown);
    await expectNothingStored(account);

    // The answer of the first request finally arrives: the universe exists and is shown.
    await creationCalls.letHeldCallThrough();
    const confirmation = findCreationMessageWithCode(page, NOTICE_CODES.confirmedAfterDelay);
    await expect(confirmation).toHaveText(notices.confirmedAfterDelay);
    await expect(unknownResultMessage).toHaveCount(0);
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expectListedUniverseNames(page, [values.name]);
    await expectUniverseIsSelected(page, values.name);
    expect(await readStoredUniverseNames(account)).toEqual([values.name]);

    // The person who types the same name again is warned that it exists (FR-21).
    await openCreationForm(page);
    const nameCheckAnswer = waitForNameCheckAnswer(page, values.name);
    await findNameField(page).fill(values.name);
    await nameCheckAnswer;
    await expect(findDuplicateNameWarning(page)).toBeVisible();
  });

  test("a second submission after the cap is accepted; both universes end up stored", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const firstName = `First try ${buildToken()}`;
    const secondName = `Second try ${buildToken()}`;
    await signInThroughTheForm(page, account);
    await reloadWithMovableClock(page);
    const creationCalls = await interceptCreationCalls(page, true);
    await openCreationForm(page);
    await fillCreationForm(page, { name: firstName });
    await findCreateButton(page).click();
    await creationCalls.firstCallIsHeld;
    await page.clock.fastForward(THIRTY_SECONDS_AND_ONE);
    await page.clock.fastForward(FOUR_AND_A_HALF_MINUTES);
    await expect(findCreateButton(page)).toBeEnabled();

    // The person changes the name and submits again: the form accepts it and is blocked again.
    await findNameField(page).fill(secondName);
    await findCreateButton(page).click();
    await expect(findCreateButton(page)).toBeDisabled();
    await expect(findCreationForm(page)).toHaveAttribute("aria-busy", "true");
    await expect(findCreationMessageWithCode(page, NOTICE_CODES.resultUnknown)).toHaveCount(0);

    // The first request ends well after all (the calls of the framework run one after another).
    await creationCalls.letHeldCallThrough();
    await expect.poll(() => readStoredUniverseNames(account)).toEqual([firstName, secondName]);
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expectListedUniverseNames(page, [firstName, secondName]);
    expect(creationCalls.countCalls()).toBe(2);
  });
});

test.describe("repeating the same action (FR-9)", () => {
  type RepeatedAction = {
    readonly name: string;
    /** Submits the open form more than once, as fast as the person could. */
    readonly repeat: (page: Page) => Promise<void>;
  };

  const repeatedActions: readonly RepeatedAction[] = [
    { name: "a double click", repeat: (page) => findCreateButton(page).dblclick() },
    {
      name: "a repeated Enter",
      repeat: async (page) => {
        await findNameField(page).press("Enter");
        await findNameField(page).press("Enter");
        await findNameField(page).press("Enter");
      },
    },
    {
      name: "a click followed by Enter",
      repeat: async (page) => {
        await findCreateButton(page).click();
        await findNameField(page).press("Enter");
      },
    },
    {
      name: "two submissions in the same instant",
      repeat: (page) =>
        findCreationForm(page).evaluate((form) => {
          if (!(form instanceof HTMLFormElement)) throw new Error("The creation form was not found.");
          form.requestSubmit();
          form.requestSubmit();
        }),
    },
  ];

  for (const repeatedAction of repeatedActions) {
    test(`${repeatedAction.name} creates one universe`, async ({ page }) => {
      test.slow();
      const account = await seedAccountInDatabase();
      const universeName = `Once ${buildToken()}`;
      await signInThroughTheForm(page, account);
      const creationCalls = await interceptCreationCalls(page, false);
      await openCreationForm(page);
      await fillCreationForm(page, { name: universeName });
      const rememberAnswer = waitForRememberAnswer(page);

      await repeatedAction.repeat(page);

      await expect(findCreationFormHeading(page)).toHaveCount(0);
      await rememberAnswer;
      await expectListedUniverseNames(page, [universeName]);
      expect(creationCalls.countCalls()).toBe(1);
      expect(await readStoredUniverseNames(account)).toEqual([universeName]);
    });
  }

  test("while the answer is awaited, Enter, a click and a second submission send nothing more", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const universeName = `Waiting ${buildToken()}`;
    await signInThroughTheForm(page, account);
    const creationCalls = await interceptCreationCalls(page, true);
    await openCreationForm(page);
    await fillCreationForm(page, { name: universeName });
    await findCreateButton(page).click();
    await creationCalls.firstCallIsHeld;
    await expect(findCreateButton(page)).toBeDisabled();

    await findNameField(page).press("Enter");
    await findCreateButton(page).click({ force: true });
    await findCreationForm(page).evaluate((form) => {
      if (!(form instanceof HTMLFormElement)) throw new Error("The creation form was not found.");
      form.requestSubmit();
    });
    const rememberAnswer = waitForRememberAnswer(page);
    await creationCalls.letHeldCallThrough();

    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await rememberAnswer;
    expect(creationCalls.countCalls()).toBe(1);
    expect(await readStoredUniverseNames(account)).toEqual([universeName]);
  });
});

test.describe("a session that ends while the form is open (FR-10)", () => {
  const endedSessions: ReadonlyArray<{ name: string; endSession: (account: E2eAccount) => Promise<void> }> = [
    { name: "has expired", endSession: (account) => expireSessionRowsInDatabase(account.email) },
    { name: "was removed", endSession: (account) => deleteSessionRowsInDatabase(account.email) },
  ];

  for (const endedSession of endedSessions) {
    test(`a session that ${endedSession.name}: nothing is created, the values stay, the message offers sign-in, and the form is empty after signing in`, async ({ page }) => {
      test.slow();
      const account = await seedAccountInDatabase();
      const values = { name: `Session ended ${buildToken()}`, description: "Typed while signed in", mode: "AUTHOR" } as const;
      await signInThroughTheForm(page, account);
      await openCreationForm(page);
      // The live name check runs 250 ms after typing and, without a session, sends the person to sign
      // in (FR-32); the session ends after it, so that the creation is what reaches the missing session.
      const nameCheckAnswer = waitForNameCheckAnswer(page, values.name);
      await fillCreationForm(page, values);
      await nameCheckAnswer;
      await endedSession.endSession(account);

      await findCreateButton(page).click();

      const signInAgainMessage = findCreationMessageWithCode(page, NOTICE_CODES.signInAgain);
      await expect(signInAgainMessage).toContainText(notices.signInAgain);
      await expect(signInAgainMessage).toHaveAttribute("role", "alert");
      const signInLink = signInAgainMessage.getByRole("link", { name: notices.signInLink, exact: true });
      await expect(signInLink).toHaveAttribute("href", "/sign-in");
      await expectValuesKeptAndFormUsable(page, values);
      await expectNothingStored(account);

      // Signing in again through the link gives a fresh page: no half-typed values, no message.
      await signInLink.click();
      await expect(page).toHaveURL("/sign-in");
      await waitForFormHydration(page);
      await page.getByLabel(en.accountForms.signIn.emailLabel).fill(account.email);
      await page.getByLabel(en.accountForms.signIn.passwordLabel).fill(account.password);
      await page.getByRole("button", { name: en.accountForms.signIn.submit, exact: true }).click();
      await expect(page).toHaveURL("/");
      await expectWorkspaceIsShown(page);
      await expect(findCreationFormHeading(page)).toHaveCount(0);
      await expect(findCreationMessages(page)).toHaveCount(0);
      await expectNothingStored(account);
      await openCreationForm(page);
      await expect(findNameField(page)).toHaveValue("");
      await expect(findDescriptionField(page)).toHaveValue("");
      await expect(findModeOption(page, "READER")).toBeChecked();
      await expect(findCreationMessages(page)).toHaveCount(0);
    });
  }

  test("a session that cannot be checked (unreachable data): the generic message, the values stay, and the person is not treated as signed out (FR-10, FR-33)", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const values = { name: `Unverifiable ${buildToken()}`, description: "Kept as well", mode: "READER" } as const;
    await signInThroughTheForm(page, account);
    await openCreationForm(page);
    await fillCreationForm(page, values);
    // The calls of the page go to the server whose data store cannot be reached, with the person's cookie.
    await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, async (route: Route) => {
      const response = await route.fetch({ url: `${UNREACHABLE_DATA_SERVER_ADDRESS}/` });
      await route.fulfill({ response });
    });

    await findCreateButton(page).click();

    const failureMessage = findCreationMessageWithCode(page, NOTICE_CODES.failed);
    await expect(failureMessage).toHaveText(notices.failed);
    await expect(findCreationMessageWithCode(page, NOTICE_CODES.signInAgain)).toHaveCount(0);
    await expect(findCreationMessageWithCode(page, NOTICE_CODES.resultUnknown)).toHaveCount(0);
    await expect(failureMessage.getByRole("link")).toHaveCount(0);
    await expectValuesKeptAndFormUsable(page, values);
    // Not signed out: still in the workspace, with the session cookie, and nothing was created.
    await expect(page).toHaveURL("/");
    await expectWorkspaceIsShown(page);
    expect(await findSessionCookieValue(page)).toBeTruthy();
    await expectNothingStored(account);

    // The session is still valid on the healthy server, so the same form creates the universe.
    await page.unroute(WORKSPACE_ROOT_ACTION_PATTERN);
    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expectUniverseIsSelected(page, values.name);
    expect(await readStoredUniverseNames(account)).toEqual([values.name]);
  });
});
