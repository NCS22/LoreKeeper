import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { en } from "../../src/messages/en";
import { SAMPLE_DATA_MARKER_TEXTS } from "../support/sample-data-markers";
import { captureServerActionId } from "./support/capture-server-action-id";
import { countUniversesWithNameInDatabase, readUniversesOfAccountInDatabase } from "./support/read-universes-in-database";
import { buildCookieHeader, readActionResult, replayServerAction } from "./support/replay-server-action";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { seedUniversesInDatabase } from "./support/seed-universes-in-database";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import {
  createUniverseThroughTheForm,
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
  expectListedUniverseNames,
  signOutThroughTheMenu,
  waitForNameCheckAnswer,
  waitForRememberAnswer,
} from "./support/universe-workspace-support";
import type { E2eAccount } from "./support/unique-account";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// Creating, listing and keeping stored universes (spec 004: FR-1, FR-4, FR-5, FR-6, FR-11, FR-13,
// FR-14 to FR-17, FR-21, FR-22, FR-24, NFR-2). Accounts are created directly in the test database;
// every test has its own, so tests never see each other's universes.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const issueMessages = en.universeCreation.issues;

async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

function buildToken(): string {
  return randomUUID().slice(0, 8);
}

test.describe("a new account (FR-14, FR-15, FR-16)", () => {
  test("sees the invitation to create the first universe, no universe and no sample data", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);

    await expect(page.getByRole("heading", { level: 1, name: en.noUniversesEmptyState.title })).toBeVisible();
    await expect(page.getByText(en.noUniversesEmptyState.text)).toBeVisible();
    await expect(findUniverseTreeItems(page)).toHaveCount(0);
    // No universe is selected: no views to switch, no works area, and the details panel says so.
    await expect(page.getByText(en.center.graphView, { exact: true })).toHaveCount(0);
    await expect(page.getByText(en.sidebar.noWorks)).toHaveCount(0);
    await expect(page.getByText(en.inspector.emptyText)).toBeVisible();
    const pageContent = await page.content();
    for (const sampleMarker of SAMPLE_DATA_MARKER_TEXTS) {
      expect(pageContent).not.toContain(sampleMarker);
    }
    expect(await readUniversesOfAccountInDatabase(account.email)).toEqual([]);
  });

  test("reaches the creation form from the invitation and can cancel it", async ({ page }) => {
    const account = await seedAccountInDatabase();
    await signInThroughTheForm(page, account);
    const createFirstUniverse = page.getByRole("button", { name: en.noUniversesEmptyState.createFirstUniverse });
    await createFirstUniverse.click();
    await expect(findCreationFormHeading(page)).toBeVisible();

    await page.getByRole("button", { name: en.universeCreation.cancel, exact: true }).click();

    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expect(createFirstUniverse).toBeFocused();
  });
});

test.describe("creating a universe (FR-1, FR-13, FR-17, FR-24)", () => {
  test("a Reader universe and an Author universe are each stored, listed, selected, announced and empty", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const readerName = `Reader world ${token}`;
    const authorName = `Author world ${token}`;
    await signInThroughTheForm(page, account);

    await createUniverseThroughTheForm(page, { name: readerName, description: "A world for readers." });

    await expectUniverseIsSelected(page, readerName);
    await expect(page.getByRole("main").getByText(en.universeCreation.modes.READER.label, { exact: true })).toBeVisible();
    await expect(page.getByText(en.universeCreation.modes.READER.explanation)).toBeVisible();
    await expect(page.getByText("A world for readers.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: en.universeEmptyState.createdAnnouncement(readerName) })).toHaveCount(1);
    // Every section keeps an honest empty state: the works area has no work and offers to add one, and
    // the entity list says a work is needed first (004 FR-15, changed by spec 006 FR-2 and FR-9).
    await expect(page.getByText(en.graph.emptyText)).toBeVisible();
    await expect(page.getByText(en.sidebar.noWorks)).toBeVisible();
    await expect(page.getByRole("button", { name: en.works.addWork })).toBeVisible();
    await expect(page.getByText(en.inspector.emptyText)).toBeVisible();
    await page.getByRole("radio", { name: en.center.listView }).click();
    await expect(page.getByText(en.entityList.workNeededFirst)).toBeVisible();

    await createUniverseThroughTheForm(page, { name: authorName, mode: "AUTHOR" });

    await expectUniverseIsSelected(page, authorName);
    await expect(page.getByRole("main").getByText(en.universeCreation.modes.AUTHOR.label, { exact: true })).toBeVisible();
    await expect(page.getByText(en.universeCreation.modes.AUTHOR.explanation)).toBeVisible();
    await expect(page.getByText(en.sidebar.noWorks)).toBeVisible();
    await expectListedUniverseNames(page, [readerName, authorName]);
    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses.map((universe) => [universe.name, universe.mode, universe.description])).toEqual([
      [readerName, "READER", "A world for readers."],
      [authorName, "AUTHOR", null],
    ]);
  });

  test("keeps the name, the description, the mode and the order after a reload and after signing out and in (FR-6, FR-11)", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const universesToCreate = [
      { name: `First ${token}`, description: "First description\nsecond line", mode: "READER" as const },
      { name: `Second ${token}`, description: undefined, mode: "AUTHOR" as const },
      { name: `Third ${token}`, description: "Third description", mode: "READER" as const },
    ];
    await signInThroughTheForm(page, account);
    for (const universe of universesToCreate) {
      await createUniverseThroughTheForm(page, universe);
    }
    const listedNames = universesToCreate.map((universe) => universe.name);

    await page.reload();

    await expectListedUniverseNames(page, listedNames);
    // The last created one is the remembered one.
    await expectUniverseIsSelected(page, `Third ${token}`);
    await findUniverseTreeItems(page).nth(0).click();
    await expectUniverseIsSelected(page, `First ${token}`);
    await expect(page.getByRole("main").getByText(en.universeCreation.modes.READER.label, { exact: true })).toBeVisible();
    const firstDescription = page.getByRole("main").locator("p bdi").last();
    expect(await firstDescription.evaluate((node) => node.textContent)).toBe("First description\nsecond line");

    const rememberedAnswer = waitForRememberAnswer(page);
    await findUniverseTreeItems(page).nth(1).click();
    await rememberedAnswer;
    await expectUniverseIsSelected(page, `Second ${token}`);
    await expect(page.getByRole("main").getByText(en.universeCreation.modes.AUTHOR.label, { exact: true })).toBeVisible();

    await signOutThroughTheMenu(page);
    await signInThroughTheForm(page, account);

    await expectListedUniverseNames(page, listedNames);
    await expectUniverseIsSelected(page, `Second ${token}`);
    await expect(page.getByRole("main").getByText(en.universeCreation.modes.AUTHOR.label, { exact: true })).toBeVisible();
    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses.map((universe) => [universe.name, universe.mode, universe.description])).toEqual(
      universesToCreate.map((universe) => [universe.name, universe.mode, universe.description ?? null]),
    );
  });

  test("two universes with the same name are both stored and listed, and the second one is warned about and not blocked (FR-21, FR-22)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const twinName = `Twin ${buildToken()}`;
    await signInThroughTheForm(page, account);
    await createUniverseThroughTheForm(page, { name: twinName });

    await openCreationForm(page);
    await findNameField(page).fill(twinName);
    await expect(findDuplicateNameWarning(page)).toBeVisible();
    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);

    await expectListedUniverseNames(page, [twinName, twinName]);
    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses).toHaveLength(2);
    expect(new Set(storedUniverses.map((universe) => universe.id)).size).toBe(2);
    // Each one was created by its own request, and its two timestamps are the same instant (FR-3).
    for (const storedUniverse of storedUniverses) {
      expect(storedUniverse.updatedAt.getTime()).toBe(storedUniverse.createdAt.getTime());
    }
  });

  test("trims the name and the description, and a description of only whitespace is stored as none (FR-1)", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const trimmedName = `Trimmed ${buildToken()}`;
    const onlyWhitespaceName = `Whitespace ${buildToken()}`;
    await signInThroughTheForm(page, account);

    await createUniverseThroughTheForm(page, { name: `   ${trimmedName}\t `, description: "  kept text \n " });
    await expectUniverseIsSelected(page, trimmedName);
    await createUniverseThroughTheForm(page, { name: onlyWhitespaceName, description: " \n\t   \n " });

    await expectUniverseIsSelected(page, onlyWhitespaceName);
    // Nothing but the name and the mode is shown as text of the person: no description paragraph.
    await expect(page.getByRole("main", { name: en.workspace.mainLabel }).locator("p bdi")).toHaveCount(0);
    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses.map((universe) => [universe.name, universe.description])).toEqual([
      [trimmedName, "kept text"],
      [onlyWhitespaceName, null],
    ]);
  });
});

test.describe("the duplicate-name warning (FR-21, FR-22)", () => {
  test("appears for a name that differs only in case, accents, spacing or composition, and not for another name", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const storedName = `Café Noir ${token}`;
    await seedUniversesInDatabase(account.email, [{ name: storedName }]);
    await signInThroughTheForm(page, account);
    await openCreationForm(page);

    const namesThatMatch = [
      storedName,
      `café noir ${token}`,
      `CAFÉ NOIR ${token.toUpperCase()}`,
      `Cafe Noir ${token}`,
      `  Café     Noir   ${token}  `,
      `Café Noir ${token}`,
    ];
    for (const typedName of namesThatMatch) {
      await findNameField(page).fill(typedName);
      await expect(findDuplicateNameWarning(page), `a warning for ${JSON.stringify(typedName)}`).toBeVisible();
    }

    const nameThatDoesNotMatch = `Café Noir ${token} two`;
    const checkAnswered = waitForNameCheckAnswer(page, nameThatDoesNotMatch);
    await findNameField(page).fill(nameThatDoesNotMatch);
    await checkAnswered;
    await expect(findDuplicateNameWarning(page)).toHaveCount(0);

    // The warning never blocks: a name that matches is created, with no second warning or confirmation.
    await findNameField(page).fill(`cafe noir ${token}`);
    await expect(findDuplicateNameWarning(page)).toBeVisible();
    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expectUniverseIsSelected(page, `cafe noir ${token}`);
    await expectListedUniverseNames(page, [storedName, `cafe noir ${token}`]);
  });
});

test.describe("the limits of the name and the description, counted by characters (FR-4)", () => {
  /** Submits a value that is too long: the message appears, the typed value stays, nothing is stored. */
  async function expectRefusedAndKept(page: Page, tooLongMessage: string, refusedName: string): Promise<void> {
    await findCreateButton(page).click();
    await expect(page.getByText(tooLongMessage)).toBeVisible();
    await expect(findCreationFormHeading(page)).toBeVisible();
    await expect(findCreationMessages(page)).toHaveCount(0);
    expect(await countUniversesWithNameInDatabase(refusedName)).toBe(0);
  }

  test("a name of 120 characters is stored and one of 121 is refused with the values kept", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const longestName = "n".repeat(120);
    await signInThroughTheForm(page, account);
    await openCreationForm(page);
    await fillCreationForm(page, { name: `${longestName}x`, description: "kept description" });

    await expectRefusedAndKept(page, issueMessages.NAME_TOO_LONG(120), `${longestName}x`);
    await expect(findNameField(page)).toHaveValue(`${longestName}x`);
    await expect(findDescriptionField(page)).toHaveValue("kept description");

    await findNameField(page).fill(longestName);
    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    await expectUniverseIsSelected(page, longestName);
    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses.map((universe) => universe.name)).toEqual([longestName]);
  });

  test("a description of 2000 characters is stored and one of 2001 is refused with the values kept", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const universeName = `Long description ${buildToken()}`;
    const longestDescription = "d".repeat(2000);
    await signInThroughTheForm(page, account);
    await openCreationForm(page);
    await fillCreationForm(page, { name: universeName, description: `${longestDescription}d` });

    await expectRefusedAndKept(page, issueMessages.DESCRIPTION_TOO_LONG(2000), universeName);
    await expect(findNameField(page)).toHaveValue(universeName);
    await expect(findDescriptionField(page)).toHaveValue(`${longestDescription}d`);

    await findDescriptionField(page).fill(longestDescription);
    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);
    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses.map((universe) => universe.description)).toEqual([longestDescription]);
  });

  test("an emoji counts as one character and a letter with a combining accent as two", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const emojiName = "\u{1F600}".repeat(120);
    const accentedName = "é".repeat(60);
    await signInThroughTheForm(page, account);

    // 120 emoji are 240 UTF-16 units but 120 characters: stored.
    await createUniverseThroughTheForm(page, { name: emojiName });
    // 60 letters with an accent are 120 characters: stored; one more pair makes 122: refused.
    await openCreationForm(page);
    await fillCreationForm(page, { name: `${accentedName}é` });
    await expectRefusedAndKept(page, issueMessages.NAME_TOO_LONG(120), `${accentedName}é`);
    await findNameField(page).fill(accentedName);
    await findCreateButton(page).click();
    await expect(findCreationFormHeading(page)).toHaveCount(0);

    await openCreationForm(page);
    await fillCreationForm(page, { name: `${emojiName}\u{1F600}` });
    await expectRefusedAndKept(page, issueMessages.NAME_TOO_LONG(120), `${emojiName}\u{1F600}`);

    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses.map((universe) => universe.name)).toEqual([emojiName, accentedName]);
  });
});

test.describe("characters that cannot be stored (FR-5, NFR-2)", () => {
  test("the null character in the name or in the description is refused on that field, with the values kept", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    await signInThroughTheForm(page, account);
    await openCreationForm(page);

    await fillCreationForm(page, { name: `Null\u0000name ${token}`, description: "fine description" });
    await findCreateButton(page).click();
    await expect(page.getByText(issueMessages.NAME_INVALID_CHARACTERS)).toBeVisible();
    await expect(findNameField(page)).toHaveValue(`Null\u0000name ${token}`);
    await expect(findNameField(page)).toBeFocused();

    await fillCreationForm(page, { name: `Fine name ${token}`, description: "null\u0000description" });
    await findCreateButton(page).click();
    await expect(page.getByText(issueMessages.DESCRIPTION_INVALID_CHARACTERS)).toBeVisible();
    await expect(page.getByText(issueMessages.NAME_INVALID_CHARACTERS)).toHaveCount(0);
    await expect(findDescriptionField(page)).toHaveValue("null\u0000description");
    // Not a failure of the stored data: no creation message, nothing stored.
    await expect(findCreationMessages(page)).toHaveCount(0);
    expect(await readUniversesOfAccountInDatabase(account.email)).toEqual([]);
  });

  test("a direct call gives the same outcomes as the form: the same refusals, and the same universe when valid", async ({ page, request }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    await signInThroughTheForm(page, account);
    const createActionId = captureServerActionId(page, "create-universe");
    await createUniverseThroughTheForm(page, { name: `Through the form ${token}` });
    const actionId = await createActionId;
    const cookieHeader = buildCookieHeader(await page.context().cookies());
    const callCreate = (rawBody: string) =>
      replayServerAction(request, { actionId, address: "/", cookieHeader, rawBody });

    const nullCharacterAnswer = await callCreate(`[{"name":"Null\\u0000name ${token}","description":null,"mode":"READER"}]`);
    const loneSurrogateAnswer = await callCreate(`[{"name":"Lone \\ud800 surrogate ${token}","description":null,"mode":"READER"}]`);
    const descriptionAnswer = await callCreate(`[{"name":"Fine ${token}","description":"bad \\u0000","mode":"READER"}]`);
    const tooLongAnswer = await callCreate(`[{"name":"${"n".repeat(121)}","description":null,"mode":"READER"}]`);
    const invalidModeAnswer = await callCreate(`[{"name":"Mode ${token}","description":null,"mode":"EVERYONE"}]`);

    const refusals = [
      [nullCharacterAnswer, "name", "NAME_INVALID_CHARACTERS"],
      [loneSurrogateAnswer, "name", "NAME_INVALID_CHARACTERS"],
      [descriptionAnswer, "description", "DESCRIPTION_INVALID_CHARACTERS"],
      [tooLongAnswer, "name", "NAME_TOO_LONG"],
      [invalidModeAnswer, "mode", "MODE_INVALID"],
    ] as const;
    for (const [answer, field, code] of refusals) {
      expect(answer.status).toBe(200);
      const result = readActionResult(answer);
      // A validation failure, not an infrastructure failure, with the issue on the field (FR-5).
      expect(result).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR", fieldErrors: { [field]: [{ code }] } },
      });
    }
    expect(await countUniversesWithNameInDatabase(`Fine ${token}`)).toBe(0);
    expect(await countUniversesWithNameInDatabase(`Mode ${token}`)).toBe(0);

    const validAnswer = await callCreate(`[{"name":"  Direct call ${token}  ","description":"  from a call ","mode":"AUTHOR"}]`);
    expect(readActionResult(validAnswer)?.ok).toBe(true);
    const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
    expect(storedUniverses.map((universe) => [universe.name, universe.description, universe.mode])).toEqual([
      [`Through the form ${token}`, null, "READER"],
      [`Direct call ${token}`, "from a call", "AUTHOR"],
    ]);
    // It is a universe like any other: the next load lists it, owned by the account of the session.
    await page.reload();
    await expectListedUniverseNames(page, [`Through the form ${token}`, `Direct call ${token}`]);
  });
});
