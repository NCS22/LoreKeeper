import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { en } from "../../src/messages/en";
import {
  createWorkThroughTheForm,
  fillWorkForm,
  findCreateWorkButton,
  findEntityFormHeading,
  findEntityNameField,
  findEntityPointGroup,
  findEntityTypeField,
  findFragmentContentField,
  findFragmentPointGroup,
  findListedEntityButtons,
  findListedWorks,
  findPointUnitField,
  findPointWorkField,
  findSamePointCheckbox,
  findSimilarEntityNotice,
  openEntityFormFromTheList,
  submitEntityFormAndExpectSelected,
  findWorkFormHeading,
  findWorkTitleField,
  findWorkUnitCountField,
  findWorksArea,
  openWorkFormFromTheWorksArea,
} from "./support/knowledge-workspace-support";
import { readEntitiesOfUniverseInDatabase } from "./support/read-knowledge-in-database";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { seedUniversesInDatabase } from "./support/seed-universes-in-database";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import type { E2eAccount } from "./support/unique-account";
import { expectUniverseIsSelected, findUniverseTreeItems } from "./support/universe-workspace-support";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// The knowledge items of a universe (spec 006). From T5: the works area, the work form, the empty
// states of the entity list and a change of universe while a form is open (FR-1, FR-2, FR-9, FR-12).
// From T6: the entity form with its unit picker, first fragment and duplicate notice (FR-4, FR-5, FR-6).
// Accounts and universes are written directly in the test database; every test has its own account.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

function buildToken(): string {
  return randomUUID().slice(0, 8);
}

async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

test.describe("works of a universe (FR-1, FR-2, FR-9)", () => {
  test("a work is created from the works area, listed with its medium and units, and still there after a reload", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [universe] = await seedUniversesInDatabase(account.email, [{ name: `Works world ${token}` }]);
    const workTitle = `The long saga ${token}`;
    await signInThroughTheForm(page, account);
    await expectUniverseIsSelected(page, universe.name);

    // The honest empty states: no work yet, and the entity list asks for a work first.
    await expect(findWorksArea(page).getByText(en.sidebar.noWorks)).toBeVisible();
    await page.getByRole("radio", { name: en.center.listView }).click();
    await expect(page.getByText(en.entityList.workNeededFirst)).toBeVisible();

    await openWorkFormFromTheWorksArea(page);
    await expect(findWorkTitleField(page)).toBeFocused();
    await fillWorkForm(page, { title: workTitle, mediumLabel: en.knowledge.mediums.MANGA, unitCount: "1e3" });
    await findCreateWorkButton(page).click();

    // A number that is not only digits is refused under its field, linked to it, and the values stay.
    const unitCountField = findWorkUnitCountField(page);
    const unitCountError = page.getByText(en.workCreation.issues.UNIT_COUNT_INVALID);
    await expect(unitCountError).toBeVisible();
    await expect(unitCountField).toHaveAttribute("aria-invalid", "true");
    await expect(unitCountField).toBeFocused();
    const describedByIds = (await unitCountField.getAttribute("aria-describedby"))?.split(" ") ?? [];
    expect(describedByIds).toContain(await unitCountError.getAttribute("id"));
    await expect(findWorkTitleField(page)).toHaveValue(workTitle);
    await expect(unitCountField).toHaveValue("1e3");

    // Surrounding spaces and leading zeros are accepted.
    await unitCountField.fill(" 0120 ");
    await findCreateWorkButton(page).click();

    await expect(findWorkFormHeading(page)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: en.workCreation.createdAnnouncement(workTitle) })).toHaveCount(1);
    await expect(findListedWorks(page)).toHaveText([`${workTitle}${en.knowledge.mediums.MANGA} · 120 chapters`]);
    await expect(findWorksArea(page).getByText(en.sidebar.noWorks)).toHaveCount(0);
    await expect(page.getByText(en.entityList.noEntities)).toBeVisible();
    await expect(page.getByText(en.entityList.workNeededFirst)).toHaveCount(0);

    await page.reload();
    await expectWorkspaceIsShown(page);

    await expect(findListedWorks(page)).toHaveText([`${workTitle}${en.knowledge.mediums.MANGA} · 120 chapters`]);
  });

  test("a second work with the same title is listed after the first, each with its medium and unit wording", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    await seedUniversesInDatabase(account.email, [{ name: `Twin titles ${token}` }]);
    const workTitle = `Same title ${token}`;
    await signInThroughTheForm(page, account);

    await createWorkThroughTheForm(page, { title: workTitle, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "1" }, 1);
    await createWorkThroughTheForm(page, { title: workTitle, mediumLabel: en.knowledge.mediums.ANIME, unitCount: "24" }, 2);

    await expect(findListedWorks(page)).toHaveText([
      `${workTitle}${en.knowledge.mediums.NOVEL} · 1 chapter`,
      `${workTitle}${en.knowledge.mediums.ANIME} · 24 episodes`,
    ]);
  });
});

test.describe("changing the selected universe (FR-12)", () => {
  test("closes the open work form with its typed values, and each universe shows only its own works", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [firstUniverse, secondUniverse] = await seedUniversesInDatabase(account.email, [
      { name: `First ${token}` },
      { name: `Second ${token}` },
    ]);
    const firstWorkTitle = `Only in the first ${token}`;
    const halfTypedTitle = `Half typed ${token}`;
    await signInThroughTheForm(page, account);
    await expectUniverseIsSelected(page, firstUniverse.name);
    await createWorkThroughTheForm(page, { title: firstWorkTitle, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "12" }, 1);

    await openWorkFormFromTheWorksArea(page);
    await findWorkTitleField(page).fill(halfTypedTitle);
    await findUniverseTreeItems(page).nth(1).click();

    await expectUniverseIsSelected(page, secondUniverse.name);
    await expect(findWorkFormHeading(page)).toHaveCount(0);
    await expect(page.getByText(halfTypedTitle)).toHaveCount(0);
    await expect(findWorksArea(page).getByText(en.sidebar.noWorks)).toBeVisible();
    await expect(page.getByText(firstWorkTitle)).toHaveCount(0);

    await findUniverseTreeItems(page).nth(0).click();

    await expectUniverseIsSelected(page, firstUniverse.name);
    await expect(findWorkFormHeading(page)).toHaveCount(0);
    await expect(findListedWorks(page)).toHaveText([`${firstWorkTitle}${en.knowledge.mediums.NOVEL} · 12 chapters`]);
  });
});

test.describe("entities of a universe (FR-4, FR-5, FR-6)", () => {
  test("creates an entity without a fragment and two with one, whose point follows the entity point until it is changed", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [universe] = await seedUniversesInDatabase(account.email, [{ name: `Reader world ${token}`, mode: "READER" }]);
    const sagaTitle = `Saga ${token}`;
    const showTitle = `Show ${token}`;
    const sagaOption = en.unitPicker.workOption(sagaTitle, en.knowledge.mediums.NOVEL);
    const showOption = en.unitPicker.workOption(showTitle, en.knowledge.mediums.ANIME);
    const chapter = en.unitPicker.wordingLabels.chapter;
    const episode = en.unitPicker.wordingLabels.episode;
    await signInThroughTheForm(page, account);
    await createWorkThroughTheForm(page, { title: sagaTitle, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "12" }, 1);
    await createWorkThroughTheForm(page, { title: showTitle, mediumLabel: en.knowledge.mediums.ANIME, unitCount: "24" }, 2);

    // 1. No fragment. In a READER universe the person chooses the unit; a number with no unit picks nothing.
    await openEntityFormFromTheList(page);
    await expect(findEntityNameField(page)).toBeFocused();
    await findEntityNameField(page).fill(`Frodo ${token}`);
    const entityPoint = findEntityPointGroup(page);
    const chapterField = findPointUnitField(entityPoint, chapter);
    await expect(chapterField).toHaveValue("");
    await chapterField.fill("13");
    const noUnitError = entityPoint.getByText(en.unitPicker.noUnit("chapter", 12));
    await expect(noUnitError).toBeVisible();
    await expect(chapterField).toHaveAttribute("aria-invalid", "true");
    const describedByIds = (await chapterField.getAttribute("aria-describedby"))?.split(" ") ?? [];
    expect(describedByIds).toContain(await noUnitError.getAttribute("id"));
    await findPointWorkField(entityPoint).selectOption({ label: showOption });
    await expect(findPointUnitField(entityPoint, episode)).toHaveValue("");
    await findPointWorkField(entityPoint).selectOption({ label: sagaOption });
    await findPointUnitField(entityPoint, chapter).fill(" 03 ");
    await expect(entityPoint.getByText(en.unitPicker.resolvedPoint(chapter, 3, sagaTitle))).toBeVisible();
    await submitEntityFormAndExpectSelected(page, 1);
    await expect(
      page.getByRole("status").filter({ hasText: en.entityCreation.createdAnnouncement(`Frodo ${token}`) }),
    ).toHaveCount(1);

    // 2. A first fragment at the same point: changing the entity point afterwards moves the fragment too.
    await openEntityFormFromTheList(page);
    await findEntityNameField(page).fill(`Ring ${token}`);
    await findEntityTypeField(page).selectOption({ label: en.knowledge.entityTypes.OBJECT });
    await findPointUnitField(findEntityPointGroup(page), chapter).fill("5");
    await findFragmentContentField(page).fill(`Found in the cave ${token}`);
    await expect(page.getByRole("radio", { name: en.entityCreation.statuses.USER_NOTE.label })).toBeChecked();
    await expect(findSamePointCheckbox(page)).toBeChecked();
    await findPointUnitField(findEntityPointGroup(page), chapter).fill("7");
    await submitEntityFormAndExpectSelected(page, 2);

    // 3. Its own point: it starts at the entity point and stays when the entity point changes later.
    await openEntityFormFromTheList(page);
    await findEntityNameField(page).fill(`Sting ${token}`);
    await findEntityTypeField(page).selectOption({ label: en.knowledge.entityTypes.OBJECT });
    await findPointUnitField(findEntityPointGroup(page), chapter).fill("2");
    await findFragmentContentField(page).fill(`A blade that glows ${token}`);
    await page.getByRole("radio", { name: en.entityCreation.statuses.CONFIRMED.label }).click();
    await findSamePointCheckbox(page).uncheck();
    const fragmentPoint = findFragmentPointGroup(page);
    await expect(findPointUnitField(fragmentPoint, chapter)).toHaveValue("2");
    await findPointWorkField(fragmentPoint).selectOption({ label: showOption });
    await expect(findPointUnitField(fragmentPoint, episode)).toHaveValue("");
    await findPointUnitField(fragmentPoint, episode).fill("4");
    await findPointUnitField(findEntityPointGroup(page), chapter).fill("9");
    await expect(findPointUnitField(fragmentPoint, episode)).toHaveValue("4");
    await submitEntityFormAndExpectSelected(page, 3);

    await expect(findListedEntityButtons(page)).toHaveText([
      `Frodo ${token}${en.knowledge.entityTypes.CHARACTER}`,
      `Ring ${token}${en.knowledge.entityTypes.OBJECT}`,
      `Sting ${token}${en.knowledge.entityTypes.OBJECT}`,
    ]);
    expect(await readEntitiesOfUniverseInDatabase(universe.id)).toEqual([
      { name: `Frodo ${token}`, type: "CHARACTER", introducedAt: { workTitle: sagaTitle, unitLabel: "3" }, fragments: [] },
      {
        name: `Ring ${token}`,
        type: "OBJECT",
        introducedAt: { workTitle: sagaTitle, unitLabel: "7" },
        fragments: [
          { content: `Found in the cave ${token}`, status: "USER_NOTE", revealedAt: { workTitle: sagaTitle, unitLabel: "7" } },
        ],
      },
      {
        name: `Sting ${token}`,
        type: "OBJECT",
        introducedAt: { workTitle: sagaTitle, unitLabel: "9" },
        fragments: [
          { content: `A blade that glows ${token}`, status: "CONFIRMED", revealedAt: { workTitle: showTitle, unitLabel: "4" } },
        ],
      },
    ]);
  });

  test("an AUTHOR universe proposes the last unit, and a similar name of the same type is created with a notice naming the oldest", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [universe] = await seedUniversesInDatabase(account.email, [{ name: `Author world ${token}`, mode: "AUTHOR" }]);
    const sagaTitle = `Saga ${token}`;
    const showTitle = `Show ${token}`;
    const existingName = `Gandalf the Grey ${token}`;
    const similarName = `  gandalf   THE grey ${token} `;
    await signInThroughTheForm(page, account);
    await createWorkThroughTheForm(page, { title: sagaTitle, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "12" }, 1);
    await createWorkThroughTheForm(page, { title: showTitle, mediumLabel: en.knowledge.mediums.ANIME, unitCount: "24" }, 2);

    await openEntityFormFromTheList(page);
    const entityPoint = findEntityPointGroup(page);
    await expect(findPointUnitField(entityPoint, en.unitPicker.wordingLabels.chapter)).toHaveValue("12");
    await findPointWorkField(entityPoint).selectOption({ label: en.unitPicker.workOption(showTitle, en.knowledge.mediums.ANIME) });
    await expect(findPointUnitField(entityPoint, en.unitPicker.wordingLabels.episode)).toHaveValue("24");
    await findEntityNameField(page).fill(existingName);
    await submitEntityFormAndExpectSelected(page, 1);
    await expect(findSimilarEntityNotice(page, existingName)).toHaveCount(0);

    // Same type, a name that differs only in case and spacing: created, with the notice (FR-6).
    await openEntityFormFromTheList(page);
    await findEntityNameField(page).fill(similarName);
    await submitEntityFormAndExpectSelected(page, 2);
    await expect(findSimilarEntityNotice(page, existingName)).toBeVisible();

    // The notice stays while the created entity is selected and goes when another form opens.
    await openEntityFormFromTheList(page);
    await expect(findSimilarEntityNotice(page, existingName)).toHaveCount(0);

    // The same name with another type makes no notice.
    await findEntityNameField(page).fill(existingName);
    await findEntityTypeField(page).selectOption({ label: en.knowledge.entityTypes.CONCEPT });
    await submitEntityFormAndExpectSelected(page, 3);
    await expect(page.getByRole("status").filter({ hasText: en.entityCreation.createdAnnouncement(existingName) })).toHaveCount(1);
    await expect(findSimilarEntityNotice(page, existingName)).toHaveCount(0);
    await expect(findEntityFormHeading(page)).toHaveCount(0);

    const storedEntities = await readEntitiesOfUniverseInDatabase(universe.id);
    expect(
      storedEntities.map((entity) => [entity.name, entity.type, entity.introducedAt.workTitle, entity.introducedAt.unitLabel]),
    ).toEqual([
      [existingName, "CHARACTER", showTitle, "24"],
      [similarName.trim(), "CHARACTER", sagaTitle, "12"],
      [existingName, "CONCEPT", sagaTitle, "12"],
    ]);
  });
});
