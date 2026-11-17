import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { en } from "../../src/messages/en";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { seedUniversesInDatabase, type SeededUniverseDescription } from "./support/seed-universes-in-database";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import {
  DESKTOP_VIEWPORT,
  expectBoxInsideTheViewportWidth,
  expectNothingOutsideTheViewportWidth,
  expectTextIsShownWhole,
  measureScrollingAreaAround,
  NARROWEST_VIEWPORT,
  tabUntilFocused,
} from "./support/layout-measurements";
import {
  findCreateButton,
  findCreationFormHeading,
  findDescriptionField,
  findNameField,
  findSelectedUniverseHeading,
  findUniverseTreeItems,
  waitForRememberAnswer,
} from "./support/universe-workspace-support";
import type { E2eAccount } from "./support/unique-account";
import { waitForElementHydration } from "./support/wait-for-element-hydration";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// The look of stored universes at the narrowest and at a desktop width (spec 004: FR-19, FR-20,
// NFR-6, and NFR-4 where it can be asserted): names and descriptions are plain text that breaks
// nothing and is shown whole, a very long list scrolls inside the navigation, and the form, the empty
// states and the navigation are reached with the keyboard with nothing scrolling sideways. Using the
// form and the lists with a screen reader is the person's manual check (NFR-4).

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const LONGEST_NAME_LENGTH = 120;
const LONGEST_DESCRIPTION_LENGTH = 2000;
const UNIVERSES_IN_THE_LONG_LIST = 200;

const VIEWPORTS = [
  { label: "desktop", viewport: DESKTOP_VIEWPORT },
  { label: "320 px", viewport: NARROWEST_VIEWPORT },
] as const;

// Direction-control and invisible characters: right-to-left override, right-to-left and left-to-right
// isolates and embeddings, marks and a zero-width space, none of them closed.
const DIRECTION_CONTROL_CHARACTERS = "‮⁧⁦⁨‫‪‭‏‎​";

type HostileUniverse = SeededUniverseDescription & { readonly description: string };

function buildHostileUniverses(token: string): HostileUniverse[] {
  const unbrokenName = `${token}${"abcdefghij".repeat(LONGEST_NAME_LENGTH / 10)}`.slice(0, LONGEST_NAME_LENGTH);
  const unbrokenDescription = "0123456789".repeat(LONGEST_DESCRIPTION_LENGTH / 10);
  const wordsName = Array.from({ length: 20 }, (_, position) => `word${position}`)
    .join(" ")
    .padEnd(LONGEST_NAME_LENGTH, "!")
    .slice(0, LONGEST_NAME_LENGTH);
  const wordsDescription = Array.from({ length: 400 }, (_, position) => `line${position}`)
    .join("\n")
    .slice(0, LONGEST_DESCRIPTION_LENGTH);
  return [
    { name: unbrokenName, description: unbrokenDescription },
    {
      name: `<img src=x onerror="window.__markupRan=1"><b>${token}</b> & <script>window.__markupRan=1</script>`,
      description: '<h1>Not a heading</h1>\n<a href="javascript:window.__markupRan=1">not a link</a>\n&amp; &lt;tag&gt;',
    },
    {
      name: `${DIRECTION_CONTROL_CHARACTERS}evil ${token} name`,
      description: `${DIRECTION_CONTROL_CHARACTERS}first line\nsecond ${DIRECTION_CONTROL_CHARACTERS} line`,
    },
    { name: wordsName, description: wordsDescription },
  ];
}

async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

/** On a narrow screen the navigation is a drawer opened from the top bar; on desktop it is always there. */
async function openNavigation(page: Page, isNarrow: boolean): Promise<void> {
  if (!isNarrow) {
    await expect(findUniverseTreeItems(page).first()).toBeVisible();
    return;
  }
  const openButton = page.getByRole("button", { name: en.workspace.openSidebar });
  await waitForElementHydration(openButton);
  await openButton.click();
  await expect(page.getByRole("dialog", { name: en.workspace.sidebarLabel })).toBeVisible();
  await expect(findUniverseTreeItems(page).first()).toBeVisible();
}

for (const { label, viewport } of VIEWPORTS) {
  const isNarrow = viewport.width === NARROWEST_VIEWPORT.width;

  test.describe(`universe texts at ${label} (FR-19, NFR-6)`, () => {
    test.use({ viewport });

    test("names and descriptions with markup, direction controls and the longest lengths are plain text that breaks nothing and is shown whole", async ({
      page,
    }) => {
      const account = await seedAccountInDatabase();
      const hostileUniverses = buildHostileUniverses(randomUUID().slice(0, 8));
      await seedUniversesInDatabase(account.email, hostileUniverses);
      const dialogMessages: string[] = [];
      page.on("dialog", async (dialog) => {
        dialogMessages.push(dialog.message());
        await dialog.dismiss();
      });
      await signInThroughTheForm(page, account);

      // The navigation: each name is one text node, shown whole, inside the width, wrapped never cut.
      await openNavigation(page, isNarrow);
      const treeItems = findUniverseTreeItems(page);
      await expect(treeItems).toHaveCount(hostileUniverses.length);
      for (const [position, universe] of hostileUniverses.entries()) {
        const nameText = treeItems.nth(position).locator("bdi");
        expect(await nameText.textContent()).toBe(universe.name);
        await expect(treeItems.nth(position).locator("bdi *")).toHaveCount(0);
        await expectTextIsShownWhole(nameText);
        await expectBoxInsideTheViewportWidth(nameText, viewport.width);
        // A name with direction controls does not push the icon of its row after the name.
        const iconBox = await treeItems.nth(position).locator("svg").boundingBox();
        const nameBox = await nameText.boundingBox();
        expect(iconBox!.x).toBeLessThan(nameBox!.x);
      }
      await expectNothingOutsideTheViewportWidth(page);
      const navigationArea = await measureScrollingAreaAround(treeItems.first());
      expect(navigationArea, "the navigation has an area of its own").not.toBeNull();
      expect(navigationArea!.contentWidth).toBeLessThanOrEqual(navigationArea!.shownWidth + 1);

      // The central area, for each universe.
      for (const [position, universe] of hostileUniverses.entries()) {
        if (position > 0 && isNarrow) await openNavigation(page, isNarrow);
        await treeItems.nth(position).click();
        const main = page.getByRole("main");
        const heading = findSelectedUniverseHeading(page);
        await expect(heading.locator("bdi")).toHaveCount(1);
        await expect.poll(() => heading.locator("bdi").textContent()).toBe(universe.name);
        // Plain text: the text is the only child of its isolating element, whatever it looked like.
        await expect(main.locator("bdi *")).toHaveCount(0);
        await expect(main.locator("img, script, a")).toHaveCount(0);

        const headingText = heading.locator("bdi");
        await expectTextIsShownWhole(headingText);
        await expectBoxInsideTheViewportWidth(headingText, viewport.width);
        const descriptionText = main.locator("bdi").nth(1);
        expect(await descriptionText.textContent()).toBe(universe.description);
        await expectTextIsShownWhole(descriptionText);
        await expectBoxInsideTheViewportWidth(descriptionText, viewport.width);

        // The text is isolated, wraps anywhere and keeps its line breaks; it does not reorder what is around it.
        const headingStyle = await headingText.evaluate((element) => ({
          bidi: getComputedStyle(element).unicodeBidi,
          wrap: getComputedStyle(element).overflowWrap,
        }));
        expect(headingStyle).toEqual({ bidi: "isolate", wrap: "anywhere" });
        expect(await descriptionText.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("pre-line");
        const modeLabelBox = await main.getByText(en.universeEmptyState.modeLabel).boundingBox();
        const modeNameBox = await main.getByText(en.universeCreation.modes.READER.label, { exact: true }).boundingBox();
        const headingBox = await heading.boundingBox();
        const descriptionBox = await descriptionText.boundingBox();
        expect(modeLabelBox!.x).toBeLessThan(modeNameBox!.x);
        expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(modeLabelBox!.y + 1);
        expect(modeLabelBox!.y).toBeLessThanOrEqual(descriptionBox!.y);
        await expectNothingOutsideTheViewportWidth(page);
      }

      expect(await page.evaluate(() => (window as unknown as { __markupRan?: number }).__markupRan)).toBeUndefined();
      expect(dialogMessages).toEqual([]);
    });
  });

  test.describe(`the details panel at ${label} (FR-15, NFR-6)`, () => {
    test.use({ viewport });

    test("shows its honest empty state with its close button and nothing sticking out", async ({ page }) => {
      const account = await seedAccountInDatabase();
      await signInThroughTheForm(page, account);

      // On a narrow screen the panel is a drawer opened from the top bar; on desktop it is a column.
      let detailsPanel = page.getByRole("complementary", { name: en.workspace.inspectorLabel });
      if (isNarrow) {
        const openButton = page.getByRole("button", { name: en.workspace.detailsPanel });
        await waitForElementHydration(openButton);
        await openButton.click();
        detailsPanel = page.getByRole("dialog", { name: en.workspace.inspectorLabel });
      }
      await expect(detailsPanel).toBeVisible();

      const closeButton = detailsPanel.getByRole("button", { name: en.workspace.collapseInspector });
      const emptyTitle = detailsPanel.getByText(en.inspector.emptyTitle);
      const emptyText = detailsPanel.getByText(en.inspector.emptyText);
      await expect(closeButton).toBeVisible();
      await expect(emptyTitle).toBeVisible();
      await expect(emptyText).toBeVisible();
      for (const shownPart of [closeButton, emptyTitle, emptyText]) {
        await expectBoxInsideTheViewportWidth(shownPart, viewport.width);
      }
      await expectNothingOutsideTheViewportWidth(page);

      // The drawer's content fits its container; the desktop column keeps its minimum width.
      const panelWidths = await detailsPanel.evaluate((panelElement) => {
        const panelBox = panelElement.getBoundingClientRect();
        const contentBox = (panelElement.querySelector("h2") as HTMLElement).closest("div.flex-col")!.getBoundingClientRect();
        return { panelWidth: panelBox.width, contentWidth: contentBox.width, contentRight: contentBox.right, panelRight: panelBox.right };
      });
      if (isNarrow) {
        expect(panelWidths.contentRight).toBeLessThanOrEqual(panelWidths.panelRight + 1);
      } else {
        expect(panelWidths.contentWidth).toBeGreaterThanOrEqual(300 - 1);
      }
    });
  });

  test.describe(`a very long list at ${label} (FR-20)`, () => {
    test.use({ viewport });

    test(`${UNIVERSES_IN_THE_LONG_LIST} universes scroll inside the navigation and not the page`, async ({ page }) => {
      const account = await seedAccountInDatabase();
      const token = randomUUID().slice(0, 8);
      const universes = Array.from({ length: UNIVERSES_IN_THE_LONG_LIST }, (_, position) => ({
        name: `Universe ${String(position + 1).padStart(3, "0")} ${token}`,
      }));
      await seedUniversesInDatabase(account.email, universes);
      await signInThroughTheForm(page, account);
      await openNavigation(page, isNarrow);

      // Nothing is cut off the list: all of them are listed, in order.
      const treeItems = findUniverseTreeItems(page);
      await expect(treeItems).toHaveCount(UNIVERSES_IN_THE_LONG_LIST);
      await expect(treeItems.first()).toHaveText(universes[0].name);
      await expect(treeItems.last()).toHaveText(universes[UNIVERSES_IN_THE_LONG_LIST - 1].name);

      // The list is longer than its area, which scrolls on its own; the page does not.
      const scrollingArea = await measureScrollingAreaAround(treeItems.first());
      expect(scrollingArea, "the navigation has an area of its own that scrolls").not.toBeNull();
      expect(scrollingArea!.contentHeight).toBeGreaterThan(scrollingArea!.shownHeight);
      expect(scrollingArea!.shownHeight).toBeLessThan(viewport.height);
      const sidebarHeading = page
        .getByRole("navigation", { name: en.workspace.sidebarLabel })
        .getByRole("heading", { level: 2, name: en.workspace.sidebarLabel });
      await expect(sidebarHeading).toBeInViewport();

      // The first and the last row are reached by scrolling the navigation: the rest of the page stays where it is.
      await expect(treeItems.last()).not.toBeInViewport();
      await treeItems.last().scrollIntoViewIfNeeded();
      await expect(treeItems.last()).toBeInViewport();
      await expect(sidebarHeading).toBeInViewport();
      await expect(page.getByRole("button", { name: en.sidebar.newUniverse, exact: true })).toBeInViewport();
      const pageScroll = await page.evaluate(() => ({
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
        windowHeight: window.innerHeight,
      }));
      expect(pageScroll.scrollY).toBe(0);
      expect(pageScroll.documentHeight).toBeLessThanOrEqual(pageScroll.windowHeight);
      await treeItems.first().scrollIntoViewIfNeeded();
      await expect(treeItems.first()).toBeInViewport();

      // The keyboard reaches the end of the list too, and the rows stay inside the width.
      await treeItems.first().focus();
      await page.keyboard.press("End");
      await expect(treeItems.last()).toBeFocused();
      await expect(treeItems.last()).toBeInViewport();
      await expectNothingOutsideTheViewportWidth(page);
    });
  });
}

test.describe("the form, the empty states and the navigation at 320 px, with the keyboard (NFR-6, NFR-4)", () => {
  test.use({ viewport: NARROWEST_VIEWPORT });

  test("a new account reaches the form, fills it with the longest values, creates the universe and moves through the navigation without a mouse and without sideways scrolling", async ({
    page,
  }) => {
    const account = await seedAccountInDatabase();
    const token = randomUUID().slice(0, 8);
    const earlierUniverseName = `Earlier universe ${token}`;
    const longestName = `${token}${"n".repeat(LONGEST_NAME_LENGTH)}`.slice(0, LONGEST_NAME_LENGTH);
    const longestDescription = "d".repeat(LONGEST_DESCRIPTION_LENGTH);
    await signInThroughTheForm(page, account);

    // Empty state of an account without universes: its heading and its one button.
    await expect(page.getByRole("heading", { level: 1, name: en.noUniversesEmptyState.title })).toBeVisible();
    await expectNothingOutsideTheViewportWidth(page);
    const createFirstUniverse = page.getByRole("button", { name: en.noUniversesEmptyState.createFirstUniverse });
    await waitForElementHydration(createFirstUniverse);
    await tabUntilFocused(page, createFirstUniverse);
    await page.keyboard.press("Enter");

    // The form: every control is reached with Tab, the longest values are typed and nothing sticks out.
    await expect(findCreationFormHeading(page)).toBeVisible();
    await tabUntilFocused(page, findNameField(page));
    await page.keyboard.type(longestName);
    await expect(findNameField(page)).toHaveValue(longestName);
    await tabUntilFocused(page, findDescriptionField(page));
    await page.keyboard.insertText(longestDescription);
    await expect(findDescriptionField(page)).toHaveValue(longestDescription);
    await tabUntilFocused(page, page.getByRole("radio", { name: en.universeCreation.modes.READER.label }));
    // The arrow moves the focus to the other mode and Space chooses it.
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: en.universeCreation.modes.AUTHOR.label })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio", { name: en.universeCreation.modes.AUTHOR.label })).toBeChecked();
    await expectNothingOutsideTheViewportWidth(page);
    await tabUntilFocused(page, page.getByRole("button", { name: en.universeCreation.cancel, exact: true }));
    await expectNothingOutsideTheViewportWidth(page);
    await tabUntilFocused(page, findCreateButton(page));
    const rememberedAnswer = waitForRememberAnswer(page);
    await page.keyboard.press("Enter");

    // The empty state of the created universe, with the 120-character name and the 2000-character description.
    const heading = findSelectedUniverseHeading(page);
    await expect.poll(() => heading.locator("bdi").textContent()).toBe(longestName);
    await rememberedAnswer;
    await expect(page.getByRole("main").locator("bdi").nth(1)).toHaveText(longestDescription);
    await expect(page.getByText(en.universeEmptyState.emptyText)).toBeVisible();
    await expectNothingOutsideTheViewportWidth(page);

    // The view switcher is reached with the keyboard and its empty state fits as well.
    const graphView = page.getByRole("radio", { name: en.center.graphView });
    await tabUntilFocused(page, graphView);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: en.center.listView })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByText(en.entityList.emptyText)).toBeVisible();
    await expectNothingOutsideTheViewportWidth(page);

    // The navigation: opened from the top bar, its rows are a single tab stop moved with the arrows.
    await seedUniversesInDatabase(account.email, [{ name: earlierUniverseName }]);
    await page.reload();
    await expectWorkspaceIsShown(page);
    const openNavigationButton = page.getByRole("button", { name: en.workspace.openSidebar });
    await waitForElementHydration(openNavigationButton);
    await tabUntilFocused(page, openNavigationButton);
    await page.keyboard.press("Enter");
    const navigation = page.getByRole("dialog", { name: en.workspace.sidebarLabel });
    await expect(navigation).toBeVisible();
    const treeItems = findUniverseTreeItems(page);
    await expect(treeItems).toHaveCount(2);
    await expect(treeItems.first()).toHaveText(earlierUniverseName);
    await expect(treeItems.last()).toHaveText(longestName);
    await tabUntilFocused(page, treeItems.last());
    await expectNothingOutsideTheViewportWidth(page);
    await page.keyboard.press("ArrowUp");
    await expect(treeItems.first()).toBeFocused();
    await expectNothingOutsideTheViewportWidth(page);
    await page.keyboard.press("Enter");

    // Choosing a universe closes the drawer and shows it.
    await expect(navigation).toHaveCount(0);
    await expect.poll(() => heading.locator("bdi").textContent()).toBe(earlierUniverseName);
    await expectNothingOutsideTheViewportWidth(page);
    // The form can be reached again from the drawer's own button, and it starts empty.
    await page.getByRole("button", { name: en.workspace.openSidebar }).click();
    await page.getByRole("button", { name: en.sidebar.newUniverse, exact: true }).click();
    await expect(findCreationFormHeading(page)).toBeVisible();
    await expect(findNameField(page)).toHaveValue("");
    await expectNothingOutsideTheViewportWidth(page);
  });

  test("the form shows its validation messages and the duplicate-name warning inside the width", async ({ page }) => {
    const account = await seedAccountInDatabase();
    const token = randomUUID().slice(0, 8);
    const existingName = `Existing ${token}`;
    await seedUniversesInDatabase(account.email, [{ name: existingName }]);
    await signInThroughTheForm(page, account);
    await openNavigation(page, true);
    await page.getByRole("button", { name: en.sidebar.newUniverse, exact: true }).click();
    await expect(findCreationFormHeading(page)).toBeVisible();

    // The warning that the name exists, with the longest name that is still valid.
    await findNameField(page).fill(existingName);
    await expect(page.getByText(en.universeCreation.duplicateNameWarning)).toBeVisible();
    await expectNothingOutsideTheViewportWidth(page);
    // The messages of the rules, with a name and a description over the limits.
    await findNameField(page).fill("n".repeat(LONGEST_NAME_LENGTH + 1));
    await findDescriptionField(page).fill("d".repeat(LONGEST_DESCRIPTION_LENGTH + 1));
    await findCreateButton(page).click();
    await expect(page.getByText(en.universeCreation.issues.NAME_TOO_LONG(LONGEST_NAME_LENGTH))).toBeVisible();
    await expect(page.getByText(en.universeCreation.issues.DESCRIPTION_TOO_LONG(LONGEST_DESCRIPTION_LENGTH))).toBeVisible();
    await expectNothingOutsideTheViewportWidth(page);
  });
});
