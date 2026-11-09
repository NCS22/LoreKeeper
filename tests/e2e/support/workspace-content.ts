import { expect as baseExpect, type Page } from "@playwright/test";
import { en } from "../../../src/messages/en";

const expect = baseExpect.configure({ timeout: 15_000 });

/** The first sample universe of the workspace: its name is on the page only when the workspace is shown. */
export const SAMPLE_UNIVERSE_NAME = "The Ember Concordat";

/**
 * Text that only a signed-in person sees in the workspace root: the sample universes and the labels
 * of the top bar, the side panels and the center (NFR-4). None of it may reach a signed-out client,
 * appear on the error pages or come in a refusal.
 */
export const WORKSPACE_ONLY_TEXTS = [
  SAMPLE_UNIVERSE_NAME,
  "Tidewrack",
  en.workspace.mainLabel,
  en.workspace.sidebarLabel,
  en.workspace.inspectorLabel,
  en.sidebar.treeLabel,
  en.sidebar.newUniverse,
  en.center.graphView,
  en.center.newElement,
  en.menus.label,
];

export async function expectWorkspaceIsShown(page: Page): Promise<void> {
  await expect(page.getByText(SAMPLE_UNIVERSE_NAME).first()).toBeVisible();
}
