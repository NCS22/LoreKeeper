import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Page, type Request } from "@playwright/test";
import { CREATION_NOTICE_CODES } from "../../src/components/universes/universe-creation-state";
import { en } from "../../src/messages/en";
import { provokeStorageFailure } from "./support/provoke-storage-failure";
import {
  countUniversesWithNameInDatabase,
  readRememberedUniverseIdInDatabase,
  readUniversesOfAccountInDatabase,
} from "./support/read-universes-in-database";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { seedUniversesInDatabase } from "./support/seed-universes-in-database";
import { isServerActionRequestWithText } from "./support/server-action-requests";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import type { E2eAccount } from "./support/unique-account";
import {
  createUniverseThroughTheForm,
  expectListedUniverseNames,
  expectUniverseIsSelected,
  fillCreationForm,
  findCreateButton,
  findCreationFormHeading,
  findCreationMessages,
  findDescriptionField,
  findDuplicateNameWarning,
  findNameField,
  findUniverseTreeItems,
  openCreationForm,
  signOutThroughTheMenu,
  waitForNameCheckAnswer,
} from "./support/universe-workspace-support";
import { waitForElementHydration } from "./support/wait-for-element-hydration";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// Several tabs of one browser (spec 004: FR-18, FR-21, NFR-5): the account in use can change in one
// tab while another still shows the earlier one, and a universe made in one tab must count in another.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

function buildToken(): string {
  return randomUUID().slice(0, 8);
}

function isCreationCall(request: Request): boolean {
  return isServerActionRequestWithText(request, '"mode"');
}

function isRememberCall(request: Request): boolean {
  return isServerActionRequestWithText(request, '"universeId"');
}

/** Records the calls of the page that match, from now on and across the documents it loads. */
function recordCalls(page: Page, matches: (request: Request) => boolean): Request[] {
  const recordedCalls: Request[] = [];
  page.on("request", (request) => {
    if (matches(request)) recordedCalls.push(request);
  });
  return recordedCalls;
}

/** A tab that cannot hear the other tabs: the check made before each send is then the only protection. */
async function makeTabDeaf(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "BroadcastChannel", { value: undefined, configurable: true, writable: true });
  });
}

type AccountChangedInAnotherTab = {
  readonly firstAccount: E2eAccount;
  readonly secondAccount: E2eAccount;
  readonly firstAccountUniverseNames: readonly string[];
  readonly secondAccountUniverseName: string;
  readonly firstAccountUniverses: ReadonlyArray<{ id: string; name: string }>;
};

/**
 * `page` shows the workspace of the first account, with the form of a new universe half typed. A second
 * tab of the same browser then signs out and signs in as the second account, so the cookie the browser
 * holds now belongs to another account while `page` still shows the first one.
 */
async function changeTheAccountInAnotherTab(
  page: Page,
  options: { readonly firstTabCannotHearTheOthers: boolean; readonly halfTypedName: string },
): Promise<AccountChangedInAnotherTab> {
  const token = buildToken();
  const firstAccount = await seedAccountInDatabase();
  const secondAccount = await seedAccountInDatabase();
  const firstAccountUniverseNames = [`First account A ${token}`, `First account B ${token}`];
  const secondAccountUniverseName = `Second account ${token}`;
  const firstAccountUniverses = await seedUniversesInDatabase(
    firstAccount.email,
    firstAccountUniverseNames.map((name) => ({ name })),
  );
  await seedUniversesInDatabase(secondAccount.email, [{ name: secondAccountUniverseName }]);

  if (options.firstTabCannotHearTheOthers) await makeTabDeaf(page);
  await signInThroughTheForm(page, firstAccount);
  await expectListedUniverseNames(page, firstAccountUniverseNames);
  await waitForElementHydration(findUniverseTreeItems(page).nth(1));
  await openCreationForm(page);
  await fillCreationForm(page, { name: options.halfTypedName, description: "Typed in the first tab" });

  const secondTab = await page.context().newPage();
  await secondTab.goto("/");
  await expectWorkspaceIsShown(secondTab);
  await signOutThroughTheMenu(secondTab);
  await signInThroughTheForm(secondTab, secondAccount);
  await expectListedUniverseNames(secondTab, [secondAccountUniverseName]);

  return { firstAccount, secondAccount, firstAccountUniverseNames, secondAccountUniverseName, firstAccountUniverses };
}

async function expectNothingOfTheFirstAccountIsShown(page: Page, change: AccountChangedInAnotherTab): Promise<void> {
  await expectListedUniverseNames(page, [change.secondAccountUniverseName]);
  await expectUniverseIsSelected(page, change.secondAccountUniverseName);
  await expect(findCreationFormHeading(page)).toHaveCount(0);
  for (const universeName of change.firstAccountUniverseNames) {
    await expect(page.getByText(universeName)).toHaveCount(0);
  }
}

test.describe("an account change in another tab (FR-18)", () => {
  test("a tab that hears the new account starts again: nothing of the earlier account, no half-typed form", async ({ page }) => {
    test.slow();
    const halfTypedName = `Half typed ${buildToken()}`;
    const creationCalls = recordCalls(page, isCreationCall);

    const change = await changeTheAccountInAnotherTab(page, {
      firstTabCannotHearTheOthers: false,
      halfTypedName,
    });

    await expectNothingOfTheFirstAccountIsShown(page, change);
    await expect(page.getByText(halfTypedName)).toHaveCount(0);
    expect(creationCalls).toHaveLength(0);
    expect(await countUniversesWithNameInDatabase(halfTypedName)).toBe(0);
  });

  test("a tab that did not hear it sends no creation under the new account, and starts again", async ({ page }) => {
    test.slow();
    const halfTypedName = `Never sent ${buildToken()}`;
    const creationCalls = recordCalls(page, isCreationCall);
    const change = await changeTheAccountInAnotherTab(page, {
      firstTabCannotHearTheOthers: true,
      halfTypedName,
    });
    // Nothing told this tab: it still shows the first account and the half-typed form.
    await expectListedUniverseNames(page, change.firstAccountUniverseNames);
    await expect(findNameField(page)).toHaveValue(halfTypedName);

    await findCreateButton(page).click();

    await expectNothingOfTheFirstAccountIsShown(page, change);
    expect(creationCalls).toHaveLength(0);
    expect(await countUniversesWithNameInDatabase(halfTypedName)).toBe(0);
    expect((await readUniversesOfAccountInDatabase(change.firstAccount.email)).map((universe) => universe.name)).toEqual(
      change.firstAccountUniverseNames,
    );
    expect(
      (await readUniversesOfAccountInDatabase(change.secondAccount.email)).map((universe) => universe.name),
    ).toEqual([change.secondAccountUniverseName]);
  });

  test("a tab that did not hear it remembers nothing under the new account, and starts again (FR-30)", async ({ page }) => {
    test.slow();
    const rememberCalls = recordCalls(page, isRememberCall);
    const change = await changeTheAccountInAnotherTab(page, {
      firstTabCannotHearTheOthers: true,
      halfTypedName: `Unused ${buildToken()}`,
    });
    await expectListedUniverseNames(page, change.firstAccountUniverseNames);

    // Selecting a universe of the earlier account: the screen may follow, but nothing is stored.
    await findUniverseTreeItems(page).nth(1).click();

    await expectNothingOfTheFirstAccountIsShown(page, change);
    expect(rememberCalls).toHaveLength(0);
    expect(await readRememberedUniverseIdInDatabase(change.firstAccount.email)).toBeNull();
    expect(await readRememberedUniverseIdInDatabase(change.secondAccount.email)).toBeNull();
  });
});

test.describe("signing out and in again (FR-18)", () => {
  test("a half-typed form and a message do not survive a sign-out and a sign-in", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const halfTypedName = `Half typed ${buildToken()}`;
    await signInThroughTheForm(page, account);
    const storageFailure = await provokeStorageFailure({
      accountEmail: account.email,
      table: "Universe",
      behavior: { kind: "fail" },
    });
    try {
      await openCreationForm(page);
      await fillCreationForm(page, { name: halfTypedName, description: "Not to be kept" });
      await findCreateButton(page).click();
      await expect(page.locator(`[data-message-code="${CREATION_NOTICE_CODES.failed}"]`)).toBeVisible();

      await signOutThroughTheMenu(page);
      await signInThroughTheForm(page, account);

      await expect(findCreationFormHeading(page)).toHaveCount(0);
      await expect(findCreationMessages(page)).toHaveCount(0);
      await expect(page.getByText(halfTypedName)).toHaveCount(0);
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
      await openCreationForm(page);
      await expect(findNameField(page)).toHaveValue("");
      await expect(findDescriptionField(page)).toHaveValue("");
      await expect(findCreationMessages(page)).toHaveCount(0);
    } finally {
      await storageFailure.remove();
    }
  });
});

test.describe("a universe made in another tab (FR-21)", () => {
  test("the duplicate-name warning of this tab counts it, although this tab's list does not show it", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const sharedName = `Shared ${buildToken()}`;
    const unrelatedName = `Unrelated ${buildToken()}`;
    await signInThroughTheForm(page, account);
    const secondTab = await page.context().newPage();
    await secondTab.goto("/");
    await expectWorkspaceIsShown(secondTab);
    await openCreationForm(secondTab);

    await createUniverseThroughTheForm(page, { name: sharedName });
    await expectListedUniverseNames(page, [sharedName]);

    // The second tab was loaded before: its list is out of date, but the check reads the stored data.
    await expect(findUniverseTreeItems(secondTab)).toHaveCount(0);
    const unrelatedAnswer = waitForNameCheckAnswer(secondTab, unrelatedName);
    await findNameField(secondTab).fill(unrelatedName);
    await unrelatedAnswer;
    await expect(findDuplicateNameWarning(secondTab)).toHaveCount(0);

    const sharedAnswer = waitForNameCheckAnswer(secondTab, sharedName);
    await findNameField(secondTab).fill(sharedName);
    await sharedAnswer;
    await expect(findDuplicateNameWarning(secondTab)).toBeVisible();
    await expect(findUniverseTreeItems(secondTab)).toHaveCount(0);
    // The warning never blocks: the other tab's universe can still be created again on purpose.
    await expect(findCreateButton(secondTab)).toBeEnabled();
    await expect(secondTab.getByRole("button", { name: en.universeCreation.cancel, exact: true })).toBeEnabled();
  });
});
