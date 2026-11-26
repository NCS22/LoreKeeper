import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { en } from "../../src/messages/en";
import {
  createWorkThroughTheForm,
  fillWorkForm,
  findCreateWorkButton,
  findListedWorks,
  findWorkFormHeading,
  findWorkTitleField,
  findWorkUnitCountField,
  findWorksArea,
  openWorkFormFromTheWorksArea,
} from "./support/knowledge-workspace-support";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { seedUniversesInDatabase } from "./support/seed-universes-in-database";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import type { E2eAccount } from "./support/unique-account";
import { expectUniverseIsSelected, findUniverseTreeItems } from "./support/universe-workspace-support";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// The knowledge items of a universe (spec 006). From T5: the works area, the work form, the empty
// states of the entity list and a change of universe while a form is open (FR-1, FR-2, FR-9, FR-12).
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
