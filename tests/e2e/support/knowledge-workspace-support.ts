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
