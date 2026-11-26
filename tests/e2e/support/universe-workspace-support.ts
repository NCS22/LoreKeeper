import { expect as baseExpect, type Locator, type Page, type Response } from "@playwright/test";
import { en } from "../../../src/messages/en";
import { isCallOfServerAction } from "./server-action-ids";
import { isServerActionRequestWithText } from "./server-action-requests";
import { findSignOutButton, openUserMenu } from "./user-menu-locators";
import { waitForElementHydration } from "./wait-for-element-hydration";

// What the browser tests of the stored universes do on the workspace and what they look for. One
// place for the labels, so a change of wording changes one file.

const expect = baseExpect.configure({ timeout: 15_000 });

export type UniverseFormValues = {
  readonly name: string;
  readonly description?: string;
  readonly mode?: "READER" | "AUTHOR";
};

export function findCreationFormHeading(page: Page): Locator {
  return page.getByRole("heading", { level: 2, name: en.universeCreation.title });
}

export function findNameField(page: Page): Locator {
  return page.getByRole("textbox", { name: en.universeCreation.nameLabel, exact: true });
}

export function findDescriptionField(page: Page): Locator {
  return page.getByRole("textbox", { name: en.universeCreation.descriptionLabel });
}

export function findCreateButton(page: Page): Locator {
  return page.getByRole("button", { name: en.universeCreation.create, exact: true });
}

export function findModeOption(page: Page, mode: "READER" | "AUTHOR"): Locator {
  return page.getByRole("radio", { name: en.universeCreation.modes[mode].label });
}

export function findDuplicateNameWarning(page: Page): Locator {
  return page.getByText(en.universeCreation.duplicateNameWarning);
}

/** The universes listed in the navigation, in the order shown. */
export function findUniverseTreeItems(page: Page): Locator {
  return page.getByRole("tree", { name: en.sidebar.treeLabel }).getByRole("treeitem");
}

export function findSelectedUniverseTreeItem(page: Page): Locator {
  return findUniverseTreeItems(page).and(page.locator("[aria-selected='true']"));
}

/** The heading of the selected universe: its name, as plain text. */
export function findSelectedUniverseHeading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

/** Failure and unknown-result messages of the creation form carry a stable code in this attribute. */
export function findCreationMessages(page: Page): Locator {
  return page.locator("[data-message-code]");
}

/** Waits for the name check the form sends 250 ms after typing stops, so "no warning" is read after the answer. */
export function waitForNameCheckAnswer(page: Page, checkedName: string): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      isServerActionRequestWithText(response.request(), `[{"name":${JSON.stringify(checkedName)}}]`),
  );
}

/**
 * Waits for the answer to a call that stores the remembered universe. The call is recognized by the
 * identifier of its action: loading the knowledge of a universe sends the same body (spec 006, D-T5-2).
 */
export function waitForRememberAnswer(page: Page, universeId?: string): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      isCallOfServerAction(response.request(), "rememberUniverseAction") &&
      (universeId === undefined || isServerActionRequestWithText(response.request(), `"universeId":"${universeId}"`)),
  );
}

export async function openCreationForm(page: Page): Promise<void> {
  const newUniverseButton = page.getByRole("button", { name: en.sidebar.newUniverse, exact: true });
  await waitForElementHydration(newUniverseButton);
  await newUniverseButton.click();
  await expect(findCreationFormHeading(page)).toBeVisible();
}

/** Types the values in the open form; the mode is chosen only when given (the form starts on Reader). */
export async function fillCreationForm(page: Page, values: UniverseFormValues): Promise<void> {
  await findNameField(page).fill(values.name);
  if (values.description !== undefined) await findDescriptionField(page).fill(values.description);
  if (values.mode !== undefined) await findModeOption(page, values.mode).click();
}

/**
 * Opens the form, fills it, submits it and waits until the form has closed (the universe is stored,
 * listed and selected) and the request that stores it as the remembered universe has been answered,
 * so a reload right after finds the same selection.
 */
export async function createUniverseThroughTheForm(page: Page, values: UniverseFormValues): Promise<void> {
  await openCreationForm(page);
  await fillCreationForm(page, values);
  const rememberedAnswer = waitForRememberAnswer(page);
  await findCreateButton(page).click();
  await expect(findCreationFormHeading(page)).toHaveCount(0);
  await rememberedAnswer;
}

/** The navigation lists exactly these universes, in this order (it waits for the list to be shown). */
export async function expectListedUniverseNames(page: Page, universeNames: readonly string[]): Promise<void> {
  await expect(findUniverseTreeItems(page)).toHaveText([...universeNames]);
}

/** The workspace shows this universe as selected: in the navigation and as the heading of the central area. */
export async function expectUniverseIsSelected(page: Page, universeName: string): Promise<void> {
  await expect(findSelectedUniverseTreeItem(page)).toHaveCount(1);
  await expect(findSelectedUniverseTreeItem(page)).toHaveText(universeName);
  await expect(findSelectedUniverseHeading(page)).toHaveText(universeName);
}

export async function signOutThroughTheMenu(page: Page): Promise<void> {
  await openUserMenu(page);
  await findSignOutButton(page).click();
  await expect(page).toHaveURL("/sign-in");
}
