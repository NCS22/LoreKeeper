import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { en } from "../../src/messages/en";
import { captureServerActionId } from "./support/capture-server-action-id";
import { provokeStorageFailure } from "./support/provoke-storage-failure";
import {
  markUniverseAsDeletedInDatabase,
  readRememberedUniverseIdInDatabase,
  readUniversesOfAccountInDatabase,
  writeRememberedUniverseInDatabase,
} from "./support/read-universes-in-database";
import { buildCookieHeader, readActionResult, replayServerAction } from "./support/replay-server-action";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { seedUniversesInDatabase } from "./support/seed-universes-in-database";
import { deleteSessionRowsInDatabase } from "./support/session-rows-in-database";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import { HEALTHY_SERVER_ADDRESS } from "./support/test-servers";
import type { E2eAccount } from "./support/unique-account";
import {
  createUniverseThroughTheForm,
  expectListedUniverseNames,
  expectUniverseIsSelected,
  findCreationMessages,
  findUniverseTreeItems,
  signOutThroughTheMenu,
  waitForRememberAnswer,
} from "./support/universe-workspace-support";
import { waitForElementHydration } from "./support/wait-for-element-hydration";
import { expectWorkspaceIsNotShown, expectWorkspaceIsShown } from "./support/workspace-content";

// The universe selected when the workspace opens (spec 004: FR-24 to FR-30): the remembered universe
// belongs to the account, never to the browser, and its failures are silent.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

function buildToken(): string {
  return randomUUID().slice(0, 8);
}

/** Seeds an account with universes named `<label> <token>`, oldest first, and returns the names. */
async function seedAccountWithThreeUniverses() {
  const account = await seedAccountInDatabase();
  const token = buildToken();
  const names = [`Oldest ${token}`, `Middle ${token}`, `Newest ${token}`];
  const universes = await seedUniversesInDatabase(
    account.email,
    names.map((name) => ({ name })),
  );
  return { account, names, universes };
}

/** Selects the universe in the navigation and waits until the account's remembered universe was answered. */
async function selectUniverseAndWaitForItToBeRemembered(page: Page, position: number, universeId: string): Promise<void> {
  const rememberedAnswer = waitForRememberAnswer(page, universeId);
  await findUniverseTreeItems(page).nth(position).click();
  await rememberedAnswer;
}

/** No failure or unknown-result message, and no alert with text, anywhere in the page. */
async function expectNoMessageIsShown(page: Page): Promise<void> {
  await expect(findCreationMessages(page)).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
}

async function openSignedInPageInAnotherContext(browser: Browser, account: E2eAccount) {
  const context = await browser.newContext({ baseURL: HEALTHY_SERVER_ADDRESS });
  const page = await context.newPage();
  await signInThroughTheForm(page, account);
  return { context, page };
}

test.describe("selecting and reloading (FR-24 to FR-27, FR-29)", () => {
  test("the oldest universe is selected first; a selected universe is remembered across a reload; a creation too; the address never changes", async ({ page }) => {
    test.slow();
    const { account, names, universes } = await seedAccountWithThreeUniverses();
    await signInThroughTheForm(page, account);
    const visitedAddresses: string[] = [page.url()];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) visitedAddresses.push(frame.url());
    });

    // Nothing is remembered yet: the first of the order is selected, with no error (FR-27).
    await expectListedUniverseNames(page, names);
    await expectUniverseIsSelected(page, names[0]);
    await expectNoMessageIsShown(page);

    await selectUniverseAndWaitForItToBeRemembered(page, 1, universes[1].id);
    await expectUniverseIsSelected(page, names[1]);
    expect(await readRememberedUniverseIdInDatabase(account.email)).toBe(universes[1].id);
    await page.reload();
    await expectUniverseIsSelected(page, names[1]);

    await selectUniverseAndWaitForItToBeRemembered(page, 2, universes[2].id);
    await page.reload();
    await expectUniverseIsSelected(page, names[2]);

    // A creation selects the new universe and remembers it (FR-24).
    const createdName = `Created ${buildToken()}`;
    await createUniverseThroughTheForm(page, { name: createdName });
    await page.reload();
    await expectUniverseIsSelected(page, createdName);

    // The selection lives on screen and in the account, never in the address (FR-29).
    const baseAddress = `${HEALTHY_SERVER_ADDRESS}/`;
    const selectedUniverseIds = [...universes.map((universe) => universe.id)];
    expect(visitedAddresses.length).toBeGreaterThan(1);
    for (const visitedAddress of visitedAddresses) {
      expect(visitedAddress).toBe(baseAddress);
    }
    expect(page.url()).toBe(baseAddress);
    for (const universeId of selectedUniverseIds) {
      await expect(page.locator(`[href*="${universeId}"]`)).toHaveCount(0);
    }
    // No return destination carries a universe either: signed out, the workspace address is just "/".
    await signOutThroughTheMenu(page);
    await page.goto("/");
    await expect(page).toHaveURL("/sign-in?returnTo=%2F");
    for (const universeId of selectedUniverseIds) {
      expect(page.url()).not.toContain(universeId);
    }
  });

  test("a second independent browser context of the same account selects the same universe, and the last selection wins (FR-26, FR-28)", async ({ page, browser }) => {
    test.slow();
    const { account, names, universes } = await seedAccountWithThreeUniverses();
    await signInThroughTheForm(page, account);
    await selectUniverseAndWaitForItToBeRemembered(page, 1, universes[1].id);

    const otherDevice = await openSignedInPageInAnotherContext(browser, account);
    try {
      await expectListedUniverseNames(otherDevice.page, names);
      await expectUniverseIsSelected(otherDevice.page, names[1]);

      await selectUniverseAndWaitForItToBeRemembered(otherDevice.page, 2, universes[2].id);
      await page.reload();
      await expectUniverseIsSelected(page, names[2]);
    } finally {
      await otherDevice.context.close();
    }
  });
});

test.describe("a remembered universe that is not available (FR-27, FR-30, FR-35)", () => {
  test("a stale remembered universe selects the oldest one that exists, with no error", async ({ page }) => {
    const { account, names, universes } = await seedAccountWithThreeUniverses();
    await writeRememberedUniverseInDatabase(account.email, universes[1].id);
    await markUniverseAsDeletedInDatabase(universes[1].id);

    await signInThroughTheForm(page, account);

    await expectListedUniverseNames(page, [names[0], names[2]]);
    await expectUniverseIsSelected(page, names[0]);
    await expectNoMessageIsShown(page);
  });

  test("a forged call that remembers a universe of another account is refused and changes nothing", async ({ page, request }) => {
    const { account, names, universes } = await seedAccountWithThreeUniverses();
    const otherAccount = await seedAccountInDatabase();
    const [foreignUniverse] = await seedUniversesInDatabase(otherAccount.email, [{ name: `Foreign ${buildToken()}` }]);
    await writeRememberedUniverseInDatabase(account.email, universes[1].id);
    await signInThroughTheForm(page, account);
    await expectUniverseIsSelected(page, names[1]);
    const rememberActionId = captureServerActionId(page, "remember-universe");
    await selectUniverseAndWaitForItToBeRemembered(page, 2, universes[2].id);
    const actionId = await rememberActionId;
    await selectUniverseAndWaitForItToBeRemembered(page, 1, universes[1].id);

    const answer = await replayServerAction(request, {
      actionId,
      address: "/",
      cookieHeader: buildCookieHeader(await page.context().cookies()),
      argument: { universeId: foreignUniverse.id },
    });

    expect(readActionResult(answer)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await readRememberedUniverseIdInDatabase(account.email)).toBe(universes[1].id);
    expect(await readRememberedUniverseIdInDatabase(otherAccount.email)).toBeNull();
    await page.reload();
    await expectUniverseIsSelected(page, names[1]);
    await expectNoMessageIsShown(page);
    expect((await readUniversesOfAccountInDatabase(otherAccount.email)).map((universe) => universe.id)).toEqual([foreignUniverse.id]);
  });
});

test.describe("failing to remember (FR-30)", () => {
  test("shows no message, keeps the selection of the page, does not undo a creation, and the next opening falls back", async ({ page }) => {
    test.slow();
    const { account, names, universes } = await seedAccountWithThreeUniverses();
    await signInThroughTheForm(page, account);
    await expectUniverseIsSelected(page, names[0]);
    const storageFailure = await provokeStorageFailure({
      accountEmail: account.email,
      table: "RememberedUniverse",
      behavior: { kind: "fail" },
    });
    try {
      const failedAnswer = waitForRememberAnswer(page, universes[1].id);
      await findUniverseTreeItems(page).nth(1).click();
      await failedAnswer;
      // The storage refused the write (nothing was stored)...
      expect(await readRememberedUniverseIdInDatabase(account.email)).toBeNull();
      // ...but the person sees nothing, and the page keeps working with the selection made in it.
      await expectUniverseIsSelected(page, names[1]);
      await expectNoMessageIsShown(page);
      await selectUniverseAndWaitForItToBeRemembered(page, 2, universes[2].id);
      await expectUniverseIsSelected(page, names[2]);

      // A creation is not undone because remembering it failed.
      const createdName = `Created while failing ${buildToken()}`;
      await createUniverseThroughTheForm(page, { name: createdName });
      await expectUniverseIsSelected(page, createdName);
      await expectNoMessageIsShown(page);
      await expectListedUniverseNames(page, [...names, createdName]);
      const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
      expect(storedUniverses.map((universe) => universe.name)).toEqual([...names, createdName]);
      expect(await readRememberedUniverseIdInDatabase(account.email)).toBeNull();

      // The next opening follows what is stored: nothing, so the oldest.
      await page.reload();
      await expectUniverseIsSelected(page, names[0]);
      await expectNoMessageIsShown(page);
    } finally {
      await storageFailure.remove();
    }

    // Once the storage works again, remembering works again.
    await waitForElementHydration(findUniverseTreeItems(page).nth(1));
    await selectUniverseAndWaitForItToBeRemembered(page, 1, universes[1].id);
    await page.reload();
    await expectUniverseIsSelected(page, names[1]);
  });
});

test.describe("a session that ends while selecting (FR-32)", () => {
  test("selecting a universe without a session sends the person to sign in, and remembers nothing", async ({ page }) => {
    const { account, names, universes } = await seedAccountWithThreeUniverses();
    await signInThroughTheForm(page, account);
    await expectUniverseIsSelected(page, names[0]);
    await waitForElementHydration(findUniverseTreeItems(page).nth(1));
    await deleteSessionRowsInDatabase(account.email);

    await findUniverseTreeItems(page).nth(1).click();

    await expect(page.getByRole("heading", { level: 1, name: en.accountForms.signIn.title })).toBeVisible();
    await expect(page).toHaveURL("/sign-in");
    await expectWorkspaceIsNotShown(page);
    expect(await readRememberedUniverseIdInDatabase(account.email)).toBeNull();
    expect(page.url()).not.toContain(universes[1].id);
  });
});
