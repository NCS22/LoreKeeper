import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Locator, type Page, type Route } from "@playwright/test";
import { en } from "../../src/messages/en";
import { createGate, interceptServerActionsOfPage } from "./support/account-form-support";
import {
  createWorkThroughTheForm,
  describePoint,
  describeRelationshipItem,
  fillWorkForm,
  findCreateEntityButton,
  findCreateRelationshipButton,
  findCreateWorkButton,
  findDetailsPanel,
  findDetailsRelationshipItems,
  findEntityDetails,
  findEntityFormHeading,
  findEntityList,
  findEntityNameField,
  findEntityPointGroup,
  findEntityTypeField,
  findFragmentContentField,
  findFragmentPointGroup,
  findListedEntityButtons,
  findListedWorks,
  findPointUnitField,
  findPointWorkField,
  findRelationshipFormHeading,
  findRelationshipPointGroup,
  findRelationshipSourceField,
  findRelationshipTargetField,
  findRelationshipTypeField,
  findSamePointCheckbox,
  findSimilarEntityNotice,
  findWorkFormHeading,
  findWorkMediumField,
  findWorkTitleField,
  findWorkUnitCountField,
  findWorksArea,
  openEntityFormFromTheList,
  openRelationshipFormFromThePanel,
  openWorkFormFromTheWorksArea,
  selectListedEntity,
  submitEntityFormAndExpectSelected,
} from "./support/knowledge-workspace-support";
import {
  expectNothingOutsideTheViewportWidth,
  expectTextIsShownWhole,
  NARROWEST_VIEWPORT,
  tabUntilFocused,
} from "./support/layout-measurements";
import { countRelationshipsOfUniverseInDatabase, readEntitiesOfUniverseInDatabase } from "./support/read-knowledge-in-database";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { seedUniversesInDatabase } from "./support/seed-universes-in-database";
import { isCallOfServerAction, type ServerActionName } from "./support/server-action-ids";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import { WORKSPACE_ROOT_ACTION_PATTERN } from "./support/test-servers";
import type { E2eAccount } from "./support/unique-account";
import { expectUniverseIsSelected, findUniverseTreeItems } from "./support/universe-workspace-support";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// The knowledge items of a universe (spec 006). From T5: the works area, the work form, the empty
// states of the entity list and a change of universe while a form is open (FR-1, FR-2, FR-9, FR-12).
// From T6: the entity form with its unit picker, first fragment and duplicate notice (FR-4, FR-5, FR-6).
// From T7: relationships and the details panel, the second account, a change of universe with the
// relationship form open, a work of 5000 units at 320 px and a lost connection in the three forms
// (FR-7, FR-10, FR-12, NFR-3, NFR-4).
// From the validation: a creation answer that arrives after the universe changed, and one that arrives
// after 30 seconds with the duplicate notice (FR-6, FR-12, 004 FR-8).
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

/** Creates an entity through the form at the chapter given, with an optional first fragment. */
async function createEntityThroughTheForm(
  page: Page,
  values: { name: string; typeLabel?: string; chapter: string; fragmentContent?: string },
  expectedEntityCount: number,
): Promise<void> {
  await openEntityFormFromTheList(page);
  await findEntityNameField(page).fill(values.name);
  if (values.typeLabel !== undefined) await findEntityTypeField(page).selectOption({ label: values.typeLabel });
  await findPointUnitField(findEntityPointGroup(page), en.unitPicker.wordingLabels.chapter).fill(values.chapter);
  if (values.fragmentContent !== undefined) await findFragmentContentField(page).fill(values.fragmentContent);
  await submitEntityFormAndExpectSelected(page, expectedEntityCount);
}

/** Fills the open relationship form; the source stays as proposed. */
async function fillRelationshipForm(
  page: Page,
  values: { typeLabel: string; targetOption: string; statusLabel?: string; chapter: string },
): Promise<void> {
  await findRelationshipTypeField(page).selectOption({ label: values.typeLabel });
  await findRelationshipTargetField(page).selectOption({ label: values.targetOption });
  if (values.statusLabel !== undefined) await page.getByRole("radio", { name: values.statusLabel }).click();
  await findPointUnitField(findRelationshipPointGroup(page), en.unitPicker.wordingLabels.chapter).fill(values.chapter);
}

const relationshipTypeLabels = { memberOf: "member of", hasMember: "has member", allyOf: "ally of" } as const;

test.describe("relationships and the details panel (FR-7, FR-10, NFR-4)", () => {
  test("the main journey: a work, two entities, two relationships read from both entities, also after a reload", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const token = buildToken();
    await seedUniversesInDatabase(account.email, [{ name: `Middle-earth ${token}`, mode: "READER" }]);
    const sagaTitle = `Saga ${token}`;
    const frodo = `Frodo ${token}`;
    const fellowship = `Fellowship ${token}`;
    const fragmentContent = `Carries the ring.\nLives in the Shire. ${token}`;
    const chapter = en.unitPicker.wordingLabels.chapter;
    const statuses = en.entityCreation.statuses;
    const frodoOption = en.relationshipCreation.entityOption(frodo, en.knowledge.entityTypes.CHARACTER);
    const fellowshipOption = en.relationshipCreation.entityOption(fellowship, en.knowledge.entityTypes.ORGANIZATION);
    const detailsPanel = findDetailsPanel(page);
    await signInThroughTheForm(page, account);
    await expect(detailsPanel.getByText(en.entityDetails.noEntitiesTitle)).toBeVisible();
    await expect(detailsPanel.getByText(en.inspector.emptyText)).toBeVisible();
    await createWorkThroughTheForm(page, { title: sagaTitle, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "120" }, 1);

    // Entity A with a first fragment: its details are shown as soon as it is created and selected.
    await createEntityThroughTheForm(page, { name: frodo, chapter: "3", fragmentContent }, 1);
    const frodoDetails = findEntityDetails(detailsPanel, frodo);
    await expect(frodoDetails).toBeVisible();
    await expect(frodoDetails.getByRole("definition")).toHaveText([
      en.knowledge.entityTypes.CHARACTER,
      describePoint(chapter, "3", sagaTitle),
      statuses.USER_NOTE.label,
      describePoint(chapter, "3", sagaTitle),
    ]);
    // The content is shown whole, with its line break.
    expect(await frodoDetails.getByText(`Lives in the Shire. ${token}`).evaluate((element) => element.textContent)).toBe(
      fragmentContent,
    );
    await expect(frodoDetails.getByText(en.entityDetails.noRelationships)).toBeVisible();
    // With one entity there is no relationship form, only the message that two are needed (FR-7).
    await expect(frodoDetails.getByText(en.relationshipCreation.twoEntitiesNeeded)).toBeVisible();
    await expect(detailsPanel.getByRole("button", { name: en.entityDetails.newRelationship })).toHaveCount(0);

    // Entity B without a fragment.
    await createEntityThroughTheForm(page, { name: fellowship, typeLabel: en.knowledge.entityTypes.ORGANIZATION, chapter: "5" }, 2);
    const fellowshipDetails = findEntityDetails(detailsPanel, fellowship);
    await expect(fellowshipDetails.getByText(en.entityDetails.noFragment)).toBeVisible();
    await expect(fellowshipDetails.getByText(en.entityDetails.noRelationships)).toBeVisible();

    // The relationship form proposes the selected entity as the source.
    await selectListedEntity(page, frodo);
    await expect(frodoDetails).toBeVisible();
    await openRelationshipFormFromThePanel(page);
    await expect(findRelationshipSourceField(page)).toBeFocused();
    await expect(findRelationshipSourceField(page).locator("option:checked")).toHaveText(frodoOption);
    await expect(findRelationshipTargetField(page).locator("option:checked")).toHaveText(fellowshipOption);
    await expect(page.getByRole("radio", { name: statuses.USER_NOTE.label })).toBeChecked();

    // An entity related to itself is refused on the target field, linked to it, and nothing is stored (FR-8).
    await fillRelationshipForm(page, { typeLabel: relationshipTypeLabels.memberOf, targetOption: frodoOption, chapter: "10" });
    await findCreateRelationshipButton(page).click();
    const targetField = findRelationshipTargetField(page);
    const relatedToItselfError = page.getByText(en.relationshipCreation.issues.RELATED_TO_ITSELF);
    await expect(relatedToItselfError).toBeVisible();
    await expect(targetField).toHaveAttribute("aria-invalid", "true");
    await expect(targetField).toBeFocused();
    expect((await targetField.getAttribute("aria-describedby"))?.split(" ")).toContain(await relatedToItselfError.getAttribute("id"));

    // A — member of → B, then a symmetric one: A — ally of → B.
    await targetField.selectOption({ label: fellowshipOption });
    await findCreateRelationshipButton(page).click();
    await expect(findRelationshipFormHeading(page)).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({
        hasText: en.relationshipCreation.createdAnnouncement(frodo, relationshipTypeLabels.memberOf, fellowship),
      }),
    ).toHaveCount(1);
    await openRelationshipFormFromThePanel(page);
    await fillRelationshipForm(page, {
      typeLabel: relationshipTypeLabels.allyOf,
      targetOption: fellowshipOption,
      statusLabel: statuses.CONFIRMED.label,
      chapter: "12",
    });
    await findCreateRelationshipButton(page).click();
    await expect(findRelationshipFormHeading(page)).toHaveCount(0);

    const readingsFromFrodo = [
      describeRelationshipItem({
        subjectName: frodo,
        label: relationshipTypeLabels.memberOf,
        otherName: fellowship,
        statusLabel: statuses.USER_NOTE.label,
        point: describePoint(chapter, "10", sagaTitle),
      }),
      describeRelationshipItem({
        subjectName: frodo,
        label: relationshipTypeLabels.allyOf,
        otherName: fellowship,
        statusLabel: statuses.CONFIRMED.label,
        point: describePoint(chapter, "12", sagaTitle),
      }),
    ];
    const readingsFromFellowship = [
      describeRelationshipItem({
        subjectName: fellowship,
        label: relationshipTypeLabels.hasMember,
        otherName: frodo,
        statusLabel: statuses.USER_NOTE.label,
        point: describePoint(chapter, "10", sagaTitle),
      }),
      describeRelationshipItem({
        subjectName: fellowship,
        label: relationshipTypeLabels.allyOf,
        otherName: frodo,
        statusLabel: statuses.CONFIRMED.label,
        point: describePoint(chapter, "12", sagaTitle),
      }),
    ];
    await expect(findDetailsRelationshipItems(detailsPanel)).toHaveText(readingsFromFrodo);
    await selectListedEntity(page, fellowship);
    await expect(findDetailsRelationshipItems(detailsPanel)).toHaveText(readingsFromFellowship);

    // After a reload nothing is selected, and both readings are still there.
    await page.reload();
    await expectWorkspaceIsShown(page);
    await expect(detailsPanel.getByText(en.entityDetails.selectEntityTitle)).toBeVisible();
    await page.getByRole("radio", { name: en.center.listView }).click();
    await selectListedEntity(page, frodo);
    await expect(findDetailsRelationshipItems(detailsPanel)).toHaveText(readingsFromFrodo);
    await selectListedEntity(page, fellowship);
    await expect(findDetailsRelationshipItems(detailsPanel)).toHaveText(readingsFromFellowship);
  });

  test("a second account sees none of the items of the first, and a name used only by the first gives no notice", async ({ page, browser }) => {
    test.slow();
    const token = buildToken();
    const sharedName = `Aragorn ${token}`;
    const firstAccount = await seedAccountInDatabase();
    const [firstUniverse] = await seedUniversesInDatabase(firstAccount.email, [{ name: `First account world ${token}` }]);
    const firstWorkTitle = `First account saga ${token}`;
    await signInThroughTheForm(page, firstAccount);
    await createWorkThroughTheForm(page, { title: firstWorkTitle, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "10" }, 1);
    await createEntityThroughTheForm(page, { name: sharedName, chapter: "1", fragmentContent: `Only the first knows ${token}` }, 1);

    const secondAccount = await seedAccountInDatabase();
    const [secondUniverse] = await seedUniversesInDatabase(secondAccount.email, [{ name: `Second account world ${token}` }]);
    const secondContext = await browser.newContext();
    try {
      const secondPage = await secondContext.newPage();
      await signInThroughTheForm(secondPage, secondAccount);

      await expectUniverseIsSelected(secondPage, secondUniverse.name);
      await expect(findUniverseTreeItems(secondPage)).toHaveCount(1);
      await expect(findWorksArea(secondPage).getByText(en.sidebar.noWorks)).toBeVisible();
      await expect(findDetailsPanel(secondPage).getByText(en.entityDetails.noEntitiesTitle)).toBeVisible();

      await createWorkThroughTheForm(
        secondPage,
        { title: `Second account saga ${token}`, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "10" },
        1,
      );
      await createEntityThroughTheForm(secondPage, { name: sharedName, chapter: "1" }, 1);

      await expect(findSimilarEntityNotice(secondPage, sharedName)).toHaveCount(0);
      await expect(findListedEntityButtons(secondPage)).toHaveText([`${sharedName}${en.knowledge.entityTypes.CHARACTER}`]);
      const secondDetails = findEntityDetails(findDetailsPanel(secondPage), sharedName);
      await expect(secondDetails.getByText(en.entityDetails.noFragment)).toBeVisible();
      const secondPageContent = await secondPage.content();
      for (const firstAccountText of [firstUniverse.name, firstWorkTitle, `Only the first knows ${token}`]) {
        expect(secondPageContent).not.toContain(firstAccountText);
      }
    } finally {
      await secondContext.close();
    }
  });
});

test.describe("changing the selected universe with a relationship form open (FR-12)", () => {
  test("closes the half-typed form and clears the selected entity, also when coming back", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [firstUniverse, secondUniverse] = await seedUniversesInDatabase(account.email, [
      { name: `First ${token}` },
      { name: `Second ${token}` },
    ]);
    const detailsPanel = findDetailsPanel(page);
    await signInThroughTheForm(page, account);
    await expectUniverseIsSelected(page, firstUniverse.name);
    await createWorkThroughTheForm(page, { title: `Saga ${token}`, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "12" }, 1);
    await createEntityThroughTheForm(page, { name: `Sam ${token}`, chapter: "1" }, 1);
    await createEntityThroughTheForm(page, { name: `Rosie ${token}`, chapter: "2" }, 2);
    await openRelationshipFormFromThePanel(page);
    await findRelationshipTypeField(page).selectOption({ label: relationshipTypeLabels.allyOf });
    await findPointUnitField(findRelationshipPointGroup(page), en.unitPicker.wordingLabels.chapter).fill("7");

    await findUniverseTreeItems(page).nth(1).click();

    await expectUniverseIsSelected(page, secondUniverse.name);
    await expect(findRelationshipFormHeading(page)).toHaveCount(0);
    await expect(detailsPanel.getByRole("article")).toHaveCount(0);
    await expect(detailsPanel.getByText(en.entityDetails.noEntitiesTitle)).toBeVisible();

    await findUniverseTreeItems(page).nth(0).click();

    await expectUniverseIsSelected(page, firstUniverse.name);
    await expect(findRelationshipFormHeading(page)).toHaveCount(0);
    await expect(detailsPanel.getByText(en.entityDetails.selectEntityTitle)).toBeVisible();
    await page.getByRole("radio", { name: en.center.listView }).click();
    await expect(findListedEntityButtons(page)).toHaveCount(2);
    await expect(findEntityList(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  });
});

type HeldCreationCall = {
  /** From now on, the next call of the action is kept waiting, as a request that has not answered yet. */
  readonly holdNextCall: () => void;
  /** Resolves when the held call reached the network and is being kept waiting. */
  readonly callIsHeld: Promise<void>;
  /** The held call goes on to the server; resolves when its answer has reached the page. */
  readonly letHeldCallThrough: () => Promise<void>;
};

/** Lets every Server Action call of the workspace through, except the one of `actionName` after `holdNextCall()`. */
async function interceptToHoldOneCallOf(page: Page, actionName: ServerActionName): Promise<HeldCreationCall> {
  const callArrived = createGate();
  let isHoldingNextCall = false;
  let heldRoute: Route | null = null;
  await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, async (route, request) => {
    if (isHoldingNextCall && isCallOfServerAction(request, actionName)) {
      isHoldingNextCall = false;
      heldRoute = route;
      callArrived.open();
      return;
    }
    await route.continue();
  });

  function takeHeldRoute(): Route {
    if (heldRoute === null) throw new Error(`No call of ${actionName} is being held.`);
    return heldRoute;
  }

  return {
    holdNextCall: () => {
      isHoldingNextCall = true;
    },
    callIsHeld: callArrived.wait,
    letHeldCallThrough: async () => {
      const route = takeHeldRoute();
      const answerArrived = page.waitForResponse((response) => isCallOfServerAction(response.request(), actionName));
      await route.continue();
      await answerArrived;
    },
  };
}

/** A page whose timers the test can move: installed before a reload, as the universe failure specs do. */
async function reloadWithMovableClock(page: Page): Promise<void> {
  await page.clock.install();
  await page.reload();
  await expectWorkspaceIsShown(page);
}

const THIRTY_SECONDS_AND_ONE = 31_000;

/** Every message the entity creation can leave on the page about an entity: none must be shown. */
function findEntityCreationMessages(page: Page, entityName: string): Locator[] {
  const notices = en.entityCreation.notices;
  return [notices.failed, notices.resultUnknown, notices.confirmedAfterDelay, notices.signInAgain, en.entityCreation.createdAnnouncement(entityName)].map(
    (messageText) => page.getByText(messageText),
  );
}

test.describe("a creation answer that arrives late (FR-6, FR-12, 004 FR-8)", () => {
  test("an entity whose answer arrives after the universe changed is discarded without any message, and is in its own universe when coming back", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [firstUniverse, secondUniverse] = await seedUniversesInDatabase(account.email, [
      { name: `First ${token}` },
      { name: `Second ${token}` },
    ]);
    const entityName = `Pippin ${token}`;
    const detailsPanel = findDetailsPanel(page);
    const entityCreationCalls = await interceptToHoldOneCallOf(page, "createEntityAction");
    await signInThroughTheForm(page, account);
    await expectUniverseIsSelected(page, firstUniverse.name);
    await createWorkThroughTheForm(page, { title: `Saga ${token}`, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "12" }, 1);

    entityCreationCalls.holdNextCall();
    await openEntityFormFromTheList(page);
    await findEntityNameField(page).fill(entityName);
    await findPointUnitField(findEntityPointGroup(page), en.unitPicker.wordingLabels.chapter).fill("3");
    await findCreateEntityButton(page).click();
    await entityCreationCalls.callIsHeld;
    await expect(findCreateEntityButton(page)).toBeDisabled();

    const secondUniverseLoaded = page.waitForResponse(
      (response) =>
        isCallOfServerAction(response.request(), "loadUniverseKnowledgeAction") &&
        (response.request().postData() ?? "").includes(secondUniverse.id),
    );
    await findUniverseTreeItems(page).nth(1).click();
    await expectUniverseIsSelected(page, secondUniverse.name);
    await expect(findEntityFormHeading(page)).toHaveCount(0);

    // The answer of the first universe arrives while the second one is selected.
    await entityCreationCalls.letHeldCallThrough();
    await secondUniverseLoaded;
    await expect.poll(async () => (await readEntitiesOfUniverseInDatabase(firstUniverse.id)).map((entity) => entity.name)).toEqual([
      entityName,
    ]);
    expect(await readEntitiesOfUniverseInDatabase(secondUniverse.id)).toEqual([]);

    await expect(findWorksArea(page).getByText(en.sidebar.noWorks)).toBeVisible();
    await expect(page.getByText(en.entityList.workNeededFirst)).toBeVisible();
    await expect(detailsPanel.getByText(en.entityDetails.noEntitiesTitle)).toBeVisible();
    await expect(detailsPanel.getByRole("article")).toHaveCount(0);
    await expect(page.getByText(entityName)).toHaveCount(0);
    for (const entityCreationMessage of findEntityCreationMessages(page, entityName)) {
      await expect(entityCreationMessage).toHaveCount(0);
    }

    await findUniverseTreeItems(page).nth(0).click();

    await expectUniverseIsSelected(page, firstUniverse.name);
    await page.getByRole("radio", { name: en.center.listView }).click();
    await expect(findListedEntityButtons(page)).toHaveText([`${entityName}${en.knowledge.entityTypes.CHARACTER}`]);
    await expect(findEntityList(page).locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(detailsPanel.getByText(en.entityDetails.selectEntityTitle)).toBeVisible();
    for (const entityCreationMessage of findEntityCreationMessages(page, entityName)) {
      await expect(entityCreationMessage).toHaveCount(0);
    }
  });

  test("an entity with a similar name whose answer arrives after 30 seconds is added and selected, with the confirmation and the notice naming the existing one", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [universe] = await seedUniversesInDatabase(account.email, [{ name: `Late world ${token}`, mode: "AUTHOR" }]);
    const existingName = `Saruman the White ${token}`;
    const similarName = `saruman  the WHITE ${token}`;
    const detailsPanel = findDetailsPanel(page);
    const entityCreationCalls = await interceptToHoldOneCallOf(page, "createEntityAction");
    await signInThroughTheForm(page, account);
    await reloadWithMovableClock(page);
    await createWorkThroughTheForm(page, { title: `Saga ${token}`, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "12" }, 1);
    await createEntityThroughTheForm(page, { name: existingName, chapter: "1" }, 1);

    entityCreationCalls.holdNextCall();
    await openEntityFormFromTheList(page);
    await findEntityNameField(page).fill(similarName);
    await findPointUnitField(findEntityPointGroup(page), en.unitPicker.wordingLabels.chapter).fill("2");
    await findCreateEntityButton(page).click();
    await entityCreationCalls.callIsHeld;
    await page.clock.fastForward(THIRTY_SECONDS_AND_ONE);

    const unknownResultAlert = findUnknownResultAlert(page, en.entityCreation.notices.resultUnknown);
    await expect(unknownResultAlert).toBeVisible();
    await expect(findCreateEntityButton(page)).toBeDisabled();
    await expect(findSimilarEntityNotice(page, existingName)).toHaveCount(0);

    // The answer arrives late: a normal success, with the confirmation and the notice of FR-6.
    await entityCreationCalls.letHeldCallThrough();

    await expect(findEntityFormHeading(page)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: en.entityCreation.notices.confirmedAfterDelay })).toBeVisible();
    await expect(unknownResultAlert).toHaveCount(0);
    await expect(findSimilarEntityNotice(page, existingName)).toBeVisible();
    const entityButtons = findListedEntityButtons(page);
    await expect(entityButtons).toHaveCount(2);
    await expect(entityButtons.last()).toHaveAttribute("aria-pressed", "true");
    await expect(findEntityList(page).locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(findEntityDetails(detailsPanel, similarName)).toBeVisible();
    expect((await readEntitiesOfUniverseInDatabase(universe.id)).map((entity) => entity.name)).toEqual([existingName, similarName]);
  });
});

test.describe("a work of 5000 units at 320 px (NFR-3)", () => {
  test("the unit is chosen by keyboard, the form and the details panel fit a 200-character title and a 5000-character fragment, and the drawer gives way to the relationship form", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const token = buildToken();
    await seedUniversesInDatabase(account.email, [{ name: `Long world ${token}` }]);
    const longTitle = `${"Longtitle".repeat(21)}${token}`.slice(0, 200);
    const entityName = `Wanderer ${token}`;
    const longFragment = `${"a".repeat(4990)}${token}`.padEnd(5000, "z");
    const chapter = en.unitPicker.wordingLabels.chapter;
    await signInThroughTheForm(page, account);
    await createWorkThroughTheForm(page, { title: longTitle, mediumLabel: en.knowledge.mediums.NOVEL, unitCount: "5000" }, 1);

    await page.setViewportSize(NARROWEST_VIEWPORT);
    await page.reload();
    await expectWorkspaceIsShown(page);
    await openEntityFormFromTheList(page);
    await expect(findEntityNameField(page)).toBeFocused();
    await page.keyboard.type(entityName);

    const entityPoint = findEntityPointGroup(page);
    const chapterField = findPointUnitField(entityPoint, chapter);
    await tabUntilFocused(page, chapterField);
    await page.keyboard.type("4999");
    await expect(entityPoint.getByText(en.unitPicker.resolvedPoint(chapter, 4999, longTitle))).toBeVisible();
    await tabUntilFocused(page, entityPoint.getByRole("button", { name: en.unitPicker.lastLabel("chapter") }));
    await page.keyboard.press("Enter");
    await expect(chapterField).toHaveValue("5000");
    await expect(entityPoint.getByText(en.unitPicker.resolvedPoint(chapter, 5000, longTitle))).toBeVisible();

    const fragmentField = findFragmentContentField(page);
    await tabUntilFocused(page, fragmentField);
    await fragmentField.fill(longFragment);
    await expectNothingOutsideTheViewportWidth(page);

    await tabUntilFocused(page, findCreateEntityButton(page));
    await page.keyboard.press("Enter");
    await expect(findEntityFormHeading(page)).toHaveCount(0);

    // On a narrow screen the details panel is a drawer opened from the top bar.
    const openDetailsButton = page.getByRole("button", { name: en.workspace.detailsPanel });
    await openDetailsButton.focus();
    await page.keyboard.press("Enter");
    const detailsDrawer = page.getByRole("dialog", { name: en.workspace.inspectorLabel });
    const entityDetails = findEntityDetails(detailsDrawer, entityName);
    await expect(entityDetails).toBeVisible();
    await expect(entityDetails.getByText(longFragment)).toBeVisible();
    await expect(entityDetails.getByRole("definition").nth(1)).toHaveText(describePoint(chapter, "5000", longTitle));
    await expectTextIsShownWhole(entityDetails.getByText(longFragment));
    await expectNothingOutsideTheViewportWidth(page);
    await expect(entityDetails.getByText(en.relationshipCreation.twoEntitiesNeeded)).toBeVisible();

    // With a second entity, "New relationship" closes the drawer so the form it opens can be used.
    await page.keyboard.press("Escape");
    await expect(detailsDrawer).toHaveCount(0);
    await createEntityThroughTheForm(page, { name: `Companion ${token}`, chapter: "1" }, 2);
    await openDetailsButton.focus();
    await page.keyboard.press("Enter");
    const newRelationshipButton = detailsDrawer.getByRole("button", { name: en.entityDetails.newRelationship });
    await newRelationshipButton.focus();
    await page.keyboard.press("Enter");
    await expect(detailsDrawer).toHaveCount(0);
    await expect(findRelationshipFormHeading(page)).toBeVisible();
    await expect(findRelationshipSourceField(page)).toBeFocused();
    await expectNothingOutsideTheViewportWidth(page);
  });
});

test.describe("a lost connection in the knowledge forms (004 FR-8 applied to spec 006)", () => {
  test("the work, entity and relationship forms show the unknown-result message and keep the typed values, storing nothing", async ({ page }) => {
    test.slow();
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [universe] = await seedUniversesInDatabase(account.email, [{ name: `Unreliable world ${token}` }]);
    const chapter = en.unitPicker.wordingLabels.chapter;
    let actionToDrop: ServerActionName | null = null;
    await interceptServerActionsOfPage(page, WORKSPACE_ROOT_ACTION_PATTERN, async (route, request) => {
      if (actionToDrop !== null && isCallOfServerAction(request, actionToDrop)) {
        actionToDrop = null;
        await route.abort("connectionreset");
        return;
      }
      await route.continue();
    });
    await signInThroughTheForm(page, account);

    // The work form.
    const workTitle = `Lost saga ${token}`;
    actionToDrop = "createWorkAction";
    await openWorkFormFromTheWorksArea(page);
    await fillWorkForm(page, { title: workTitle, mediumLabel: en.knowledge.mediums.MANGA, unitCount: "30" });
    await findCreateWorkButton(page).click();
    await expect(findUnknownResultAlert(page, en.workCreation.notices.resultUnknown)).toBeVisible();
    await expect(findWorkTitleField(page)).toHaveValue(workTitle);
    await expect(findWorkMediumField(page).locator("option:checked")).toHaveText(en.knowledge.mediums.MANGA);
    await expect(findWorkUnitCountField(page)).toHaveValue("30");
    await expect(findCreateWorkButton(page)).toBeEnabled();
    await expect(findWorksArea(page).getByText(en.sidebar.noWorks)).toBeVisible();
    await findCreateWorkButton(page).click();
    await expect(findWorkFormHeading(page)).toHaveCount(0);
    await expect(findListedWorks(page)).toHaveCount(1);

    // The entity form.
    const entityName = `Lost entity ${token}`;
    actionToDrop = "createEntityAction";
    await openEntityFormFromTheList(page);
    await findEntityNameField(page).fill(entityName);
    await findPointUnitField(findEntityPointGroup(page), chapter).fill("4");
    await findFragmentContentField(page).fill(`Kept fragment ${token}`);
    await findCreateEntityButton(page).click();
    await expect(findUnknownResultAlert(page, en.entityCreation.notices.resultUnknown)).toBeVisible();
    await expect(findEntityNameField(page)).toHaveValue(entityName);
    await expect(findPointUnitField(findEntityPointGroup(page), chapter)).toHaveValue("4");
    await expect(findFragmentContentField(page)).toHaveValue(`Kept fragment ${token}`);
    await expect(findCreateEntityButton(page)).toBeEnabled();
    expect(await readEntitiesOfUniverseInDatabase(universe.id)).toEqual([]);
    await submitEntityFormAndExpectSelected(page, 1);
    await createEntityThroughTheForm(page, { name: `Other entity ${token}`, chapter: "5" }, 2);

    // The relationship form.
    actionToDrop = "createRelationshipAction";
    await openRelationshipFormFromThePanel(page);
    await fillRelationshipForm(page, {
      typeLabel: relationshipTypeLabels.memberOf,
      targetOption: en.relationshipCreation.entityOption(entityName, en.knowledge.entityTypes.CHARACTER),
      statusLabel: en.entityCreation.statuses.SPECULATION.label,
      chapter: "9",
    });
    await findCreateRelationshipButton(page).click();
    await expect(findUnknownResultAlert(page, en.relationshipCreation.notices.resultUnknown)).toBeVisible();
    await expect(findRelationshipTypeField(page).locator("option:checked")).toHaveText(relationshipTypeLabels.memberOf);
    await expect(findRelationshipTargetField(page).locator("option:checked")).toHaveText(
      en.relationshipCreation.entityOption(entityName, en.knowledge.entityTypes.CHARACTER),
    );
    await expect(page.getByRole("radio", { name: en.entityCreation.statuses.SPECULATION.label })).toBeChecked();
    await expect(findPointUnitField(findRelationshipPointGroup(page), chapter)).toHaveValue("9");
    await expect(findCreateRelationshipButton(page)).toBeEnabled();
    expect(await countRelationshipsOfUniverseInDatabase(universe.id)).toBe(0);
    await findCreateRelationshipButton(page).click();
    await expect(findRelationshipFormHeading(page)).toHaveCount(0);
    expect(await countRelationshipsOfUniverseInDatabase(universe.id)).toBe(1);
  });
});

/** The unknown-result message of a form, announced as an alert. */
function findUnknownResultAlert(page: Page, messageText: string): Locator {
  return page.getByRole("alert").filter({ hasText: messageText });
}
