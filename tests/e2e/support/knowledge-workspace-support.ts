import { expect as baseExpect, type Locator, type Page } from "@playwright/test";
import { en } from "../../../src/messages/en";
import { waitForElementHydration } from "./wait-for-element-hydration";

// What the browser tests of the knowledge items (spec 006) do on the workspace and what they look
// for. One place for the labels, so a change of wording changes one file.

const expect = baseExpect.configure({ timeout: 15_000 });

export type WorkFormValues = {
  readonly title: string;
  /** The medium as the form shows it, for example "Manga". */
  readonly mediumLabel: string;
  readonly unitCount: string;
};

export function findWorksArea(page: Page): Locator {
  return page.getByRole("region", { name: en.sidebar.worksHeading });
}

export function findListedWorks(page: Page): Locator {
  return page.getByRole("list", { name: en.works.listLabel }).getByRole("listitem");
}

export function findWorkFormHeading(page: Page): Locator {
  return page.getByRole("heading", { level: 2, name: en.workCreation.title });
}

export function findWorkTitleField(page: Page): Locator {
  return page.getByRole("textbox", { name: en.workCreation.titleLabel, exact: true });
}

export function findWorkMediumField(page: Page): Locator {
  return page.getByRole("combobox", { name: en.workCreation.mediumLabel });
}

export function findWorkUnitCountField(page: Page): Locator {
  return page.getByRole("textbox", { name: en.workCreation.unitCountLabel });
}

export function findCreateWorkButton(page: Page): Locator {
  return page.getByRole("button", { name: en.workCreation.create, exact: true });
}

/** Opens the work form from the works area of the navigation. */
export async function openWorkFormFromTheWorksArea(page: Page): Promise<void> {
  const addWorkButton = findWorksArea(page).getByRole("button", { name: en.works.addWork });
  await waitForElementHydration(addWorkButton);
  await addWorkButton.click();
  await expect(findWorkFormHeading(page)).toBeVisible();
}

export async function fillWorkForm(page: Page, values: WorkFormValues): Promise<void> {
  await findWorkTitleField(page).fill(values.title);
  await findWorkMediumField(page).selectOption({ label: values.mediumLabel });
  await findWorkUnitCountField(page).fill(values.unitCount);
}

/** Fills the open work form, submits it and waits until the form has closed and the work is listed. */
export async function createWorkThroughTheForm(page: Page, values: WorkFormValues, expectedWorkCount: number): Promise<void> {
  await openWorkFormFromTheWorksArea(page);
  await fillWorkForm(page, values);
  await findCreateWorkButton(page).click();
  await expect(findWorkFormHeading(page)).toHaveCount(0);
  await expect(findListedWorks(page)).toHaveCount(expectedWorkCount);
}

export function findEntityList(page: Page): Locator {
  return page.getByRole("region", { name: en.entityList.heading });
}

/** The rows of the entity list, each a button that selects its entity. */
export function findListedEntityButtons(page: Page): Locator {
  return findEntityList(page).getByRole("listitem").getByRole("button");
}

export function findEntityFormHeading(page: Page): Locator {
  return page.getByRole("heading", { level: 2, name: en.entityCreation.title });
}

export function findEntityNameField(page: Page): Locator {
  return page.getByRole("textbox", { name: en.entityCreation.nameLabel, exact: true });
}

export function findEntityTypeField(page: Page): Locator {
  return page.getByRole("combobox", { name: en.entityCreation.typeLabel, exact: true });
}

/** The point of the entity in the open entity form. */
export function findEntityPointGroup(page: Page): Locator {
  return page.getByRole("group", { name: en.entityCreation.pointLegend });
}

/** The own point of the first fragment, shown only while "Same point as the entity" is unchecked. */
export function findFragmentPointGroup(page: Page): Locator {
  return page.getByRole("group", { name: en.entityCreation.fragmentPointLegend });
}

export function findPointWorkField(pointGroup: Locator): Locator {
  return pointGroup.getByRole("combobox", { name: en.unitPicker.workLabel });
}

/** The unit number field of a point, labelled with the wording of its work ("Chapter", "Episode"). */
export function findPointUnitField(pointGroup: Locator, wordingLabel: string): Locator {
  return pointGroup.getByRole("textbox", { name: wordingLabel, exact: true });
}

export function findFragmentContentField(page: Page): Locator {
  return page.getByRole("textbox", { name: en.entityCreation.fragmentContentLabel });
}

export function findSamePointCheckbox(page: Page): Locator {
  return page.getByRole("checkbox", { name: en.entityCreation.samePointLabel });
}

export function findCreateEntityButton(page: Page): Locator {
  return page.getByRole("button", { name: en.entityCreation.create, exact: true });
}

/** The notice of FR-6 naming the existing similar entity. */
export function findSimilarEntityNotice(page: Page, similarEntityName: string): Locator {
  return page.getByRole("status").filter({ hasText: en.entityCreation.similarEntityNotice(similarEntityName) });
}

/** Shows the entity list and opens the entity form from its "New entity" button. */
export async function openEntityFormFromTheList(page: Page): Promise<void> {
  const listViewRadio = page.getByRole("radio", { name: en.center.listView });
  await waitForElementHydration(listViewRadio);
  await listViewRadio.click();
  const newEntityButton = findEntityList(page).getByRole("button", { name: en.entityList.newEntity });
  await waitForElementHydration(newEntityButton);
  await newEntityButton.click();
  await expect(findEntityFormHeading(page)).toBeVisible();
}

/**
 * Submits the open entity form and waits until it has closed, the list holds `expectedEntityCount`
 * entities and the created one, the last in creation order, is the only selected row.
 */
export async function submitEntityFormAndExpectSelected(page: Page, expectedEntityCount: number): Promise<void> {
  await findCreateEntityButton(page).click();
  await expect(findEntityFormHeading(page)).toHaveCount(0);
  const entityButtons = findListedEntityButtons(page);
  await expect(entityButtons).toHaveCount(expectedEntityCount);
  await expect(entityButtons.last()).toHaveAttribute("aria-pressed", "true");
  await expect(findEntityList(page).locator('[aria-pressed="true"]')).toHaveCount(1);
}

/** Selects an entity of the list by its row, whose text starts with the name of the entity. */
export async function selectListedEntity(page: Page, entityName: string): Promise<void> {
  const entityButton = findListedEntityButtons(page).filter({ hasText: entityName });
  await waitForElementHydration(entityButton);
  await entityButton.click();
  await expect(entityButton).toHaveAttribute("aria-pressed", "true");
}

/** The details panel as a desktop column; on a narrow screen it is a drawer opened from the top bar. */
export function findDetailsPanel(page: Page): Locator {
  return page.getByRole("complementary", { name: en.workspace.inspectorLabel });
}

/** The details of the selected entity in the panel, named by the entity. */
export function findEntityDetails(panel: Locator, entityName: string): Locator {
  return panel.getByRole("article", { name: entityName });
}

/** The relationships of the entity of the panel, each as read from that entity. */
export function findDetailsRelationshipItems(panel: Locator): Locator {
  return panel.getByRole("list", { name: en.entityDetails.relationshipsHeading }).getByRole("listitem");
}

/** A point as the panel writes it: "Chapter 3 of The Fellowship". */
export function describePoint(wordingLabel: string, unitLabel: string, workTitle: string): string {
  return `${en.entityDetails.pointUnitOf(wordingLabel, unitLabel)} ${workTitle}`;
}

/** The text of a relationship item of the panel: its reading, then its status and its point. */
export function describeRelationshipItem(reading: {
  readonly subjectName: string;
  readonly label: string;
  readonly otherName: string;
  readonly statusLabel: string;
  readonly point: string;
}): string {
  const { afterSubject, afterLabel } = en.entityDetails.readingConnectors;
  return `${reading.subjectName}${afterSubject}${reading.label}${afterLabel}${reading.otherName}${reading.statusLabel} · ${reading.point}`;
}

export function findRelationshipFormHeading(page: Page): Locator {
  return page.getByRole("heading", { level: 2, name: en.relationshipCreation.title });
}

export function findRelationshipSourceField(page: Page): Locator {
  return page.getByRole("combobox", { name: en.relationshipCreation.sourceLabel, exact: true });
}

export function findRelationshipTypeField(page: Page): Locator {
  return page.getByRole("combobox", { name: en.relationshipCreation.typeLabel, exact: true });
}

export function findRelationshipTargetField(page: Page): Locator {
  return page.getByRole("combobox", { name: en.relationshipCreation.targetLabel, exact: true });
}

export function findRelationshipPointGroup(page: Page): Locator {
  return page.getByRole("group", { name: en.relationshipCreation.pointLegend });
}

export function findCreateRelationshipButton(page: Page): Locator {
  return page.getByRole("button", { name: en.relationshipCreation.create, exact: true });
}

/** Opens the relationship form from the "New relationship" button of the details panel. */
export async function openRelationshipFormFromThePanel(page: Page): Promise<void> {
  const newRelationshipButton = findDetailsPanel(page).getByRole("button", { name: en.entityDetails.newRelationship });
  await waitForElementHydration(newRelationshipButton);
  await newRelationshipButton.click();
  await expect(findRelationshipFormHeading(page)).toBeVisible();
}
