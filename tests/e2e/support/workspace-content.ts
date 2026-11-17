import { expect as baseExpect, type Page } from "@playwright/test";
import { en } from "../../../src/messages/en";

const expect = baseExpect.configure({ timeout: 15_000 });

/**
 * Text that only a signed-in person sees in the workspace root: the labels of the top bar, the side
 * panels and the center (NFR-4). None of it may reach a signed-out client, appear on the error pages
 * or come in a refusal. The workspace shows no sample universe any more (spec 004, FR-14).
 */
export const WORKSPACE_ONLY_TEXTS = [
  en.workspace.mainLabel,
  en.workspace.sidebarLabel,
  en.workspace.inspectorLabel,
  en.sidebar.treeLabel,
  en.sidebar.newUniverse,
  en.center.graphView,
  en.center.newElement,
  en.menus.label,
];

/** The landmark that only the workspace has: its label is the marker of "the workspace is shown". */
function findWorkspaceLandmark(page: Page) {
  return page.getByRole("main", { name: en.workspace.mainLabel });
}

export async function expectWorkspaceIsShown(page: Page): Promise<void> {
  await expect(findWorkspaceLandmark(page)).toBeVisible();
}

export async function expectWorkspaceIsNotShown(page: Page): Promise<void> {
  await expect(findWorkspaceLandmark(page)).toHaveCount(0);
}
