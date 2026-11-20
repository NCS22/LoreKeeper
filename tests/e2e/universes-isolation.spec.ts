import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { SIGNED_OUT_ACTION_REFUSAL } from "../../src/shared/presentation/signed-out-action-response";
import { captureServerActionId } from "./support/capture-server-action-id";
import {
  countUniversesWithNameInDatabase,
  readAccountIdInDatabase,
  readRememberedUniverseIdInDatabase,
  readUniversesOfAccountInDatabase,
} from "./support/read-universes-in-database";
import { buildCookieHeader, readActionResult, replayServerAction } from "./support/replay-server-action";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { seedUniversesInDatabase } from "./support/seed-universes-in-database";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import { HEALTHY_SERVER_ADDRESS } from "./support/test-servers";
import type { E2eAccount } from "./support/unique-account";
import {
  createUniverseThroughTheForm,
  expectListedUniverseNames,
  findDuplicateNameWarning,
  findNameField,
  findUniverseTreeItems,
  openCreationForm,
  waitForNameCheckAnswer,
  waitForRememberAnswer,
} from "./support/universe-workspace-support";
import { expectWorkspaceIsShown, WORKSPACE_ONLY_TEXTS } from "./support/workspace-content";

// Two accounts that never see each other's universes (spec 004: FR-2, FR-12, FR-13, FR-23, FR-32,
// FR-35, NFR-3). These browser tests are the account-isolation protection tests of this feature at
// the level of the browser; the use cases and the Server Actions have their own with two actors.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

function buildToken(): string {
  return randomUUID().slice(0, 8);
}

/** A second browser context, so the second account has its own cookies, signed in and showing the workspace. */
async function openSignedInPageOfAnotherAccount(browser: Browser, account: E2eAccount) {
  const context = await browser.newContext({ baseURL: HEALTHY_SERVER_ADDRESS });
  const page = await context.newPage();
  await signInThroughTheForm(page, account);
  return { context, page };
}

test.describe("what each account sees (FR-12, FR-13, NFR-3)", () => {
  test("each account lists only its own universes, and a creation of one never changes the other", async ({ page, browser }) => {
    test.slow();
    const firstAccount = await seedAccountInDatabase();
    const secondAccount = await seedAccountInDatabase();
    const token = buildToken();
    const firstName = `Only of the first ${token}`;
    const secondName = `Only of the second ${token}`;
    const otherPerson = await openSignedInPageOfAnotherAccount(browser, secondAccount);
    try {
      await signInThroughTheForm(page, firstAccount);

      await createUniverseThroughTheForm(page, { name: firstName, description: `Secret of ${token}` });
      await createUniverseThroughTheForm(otherPerson.page, { name: secondName });

      // After a reload each one still lists only its own, and nothing of the other is in the page or in the served document.
      await page.reload();
      await otherPerson.page.reload();
      await expectListedUniverseNames(page, [firstName]);
      await expectListedUniverseNames(otherPerson.page, [secondName]);
      expect(await page.content()).not.toContain(secondName);
      expect(await otherPerson.page.content()).not.toContain(firstName);
      expect(await otherPerson.page.content()).not.toContain(`Secret of ${token}`);
      const servedDocumentOfSecond = await otherPerson.context.request.get("/");
      expect(await servedDocumentOfSecond.text()).not.toContain(firstName);

      // A creation of the first account changes nothing for the second (FR-13).
      await createUniverseThroughTheForm(page, { name: `Another of the first ${token}` });
      await otherPerson.page.reload();
      await expectListedUniverseNames(otherPerson.page, [secondName]);
      expect(await otherPerson.page.content()).not.toContain(`Another of the first ${token}`);

      const firstAccountId = await readAccountIdInDatabase(firstAccount.email);
      const secondAccountId = await readAccountIdInDatabase(secondAccount.email);
      const firstRows = await readUniversesOfAccountInDatabase(firstAccount.email);
      const secondRows = await readUniversesOfAccountInDatabase(secondAccount.email);
      expect(firstRows.map((row) => [row.name, row.ownerId])).toEqual([
        [firstName, firstAccountId],
        [`Another of the first ${token}`, firstAccountId],
      ]);
      expect(secondRows.map((row) => [row.name, row.ownerId])).toEqual([[secondName, secondAccountId]]);
    } finally {
      await otherPerson.context.close();
    }
  });

  test("a name that exists only in the other account shows no warning, in the form and in a direct call (FR-23)", async ({ page, browser, request }) => {
    test.slow();
    const firstAccount = await seedAccountInDatabase();
    const secondAccount = await seedAccountInDatabase();
    const sharedName = `Name of the first only ${buildToken()}`;
    await seedUniversesInDatabase(firstAccount.email, [{ name: sharedName }]);
    await seedUniversesInDatabase(secondAccount.email, [{ name: `Own of the second ${buildToken()}` }]);
    const otherPerson = await openSignedInPageOfAnotherAccount(browser, secondAccount);
    try {
      await signInThroughTheForm(page, firstAccount);
      await openCreationForm(page);
      await findNameField(page).fill(sharedName);
      // The control: the account that owns the name is warned.
      await expect(findDuplicateNameWarning(page)).toBeVisible();

      await openCreationForm(otherPerson.page);
      const nameCheckActionId = captureServerActionId(otherPerson.page, "check-name");
      const checkAnswered = waitForNameCheckAnswer(otherPerson.page, sharedName);
      await findNameField(otherPerson.page).fill(sharedName);
      await checkAnswered;
      await expect(findDuplicateNameWarning(otherPerson.page)).toHaveCount(0);

      // The same through a direct call with the session of the second account.
      const actionId = await nameCheckActionId;
      const cookieHeader = buildCookieHeader(await otherPerson.context.cookies());
      const askAboutName = async (typedName: string) =>
        readActionResult(await replayServerAction(request, { actionId, address: "/", cookieHeader, argument: { name: typedName } }));
      expect(await askAboutName(sharedName)).toEqual({ ok: true, value: { isInUse: false } });
      const ownName = (await readUniversesOfAccountInDatabase(secondAccount.email))[0].name;
      expect(await askAboutName(ownName)).toEqual({ ok: true, value: { isInUse: true } });
    } finally {
      await otherPerson.context.close();
    }
  });
});

test.describe("a universe identifier of another account (FR-35, NFR-3)", () => {
  test("a foreign identifier and a nonexistent one give the same answer, a malformed one a validation error, and nothing is remembered", async ({ page, request }) => {
    test.slow();
    const firstAccount = await seedAccountInDatabase();
    const secondAccount = await seedAccountInDatabase();
    const [firstOwnUniverse, secondOwnUniverse] = await seedUniversesInDatabase(firstAccount.email, [
      { name: `First own ${buildToken()}` },
      { name: `Second own ${buildToken()}` },
    ]);
    const [foreignUniverse] = await seedUniversesInDatabase(secondAccount.email, [{ name: `Foreign ${buildToken()}` }]);
    await signInThroughTheForm(page, firstAccount);
    const rememberActionId = captureServerActionId(page, "remember-universe");
    const rememberedAnswer = waitForRememberAnswer(page, secondOwnUniverse.id);
    await findUniverseTreeItems(page).nth(1).click();
    await rememberedAnswer;
    const actionId = await rememberActionId;
    const cookieHeader = buildCookieHeader(await page.context().cookies());
    const remember = (argument: unknown) => replayServerAction(request, { actionId, address: "/", cookieHeader, argument });

    const foreignAnswer = await remember({ universeId: foreignUniverse.id });
    const nonexistentAnswer = await remember({ universeId: randomUUID() });

    // Same kind, code, message and shape: the existence of the foreign universe is not revealed.
    expect(readActionResult(foreignAnswer)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(readActionResult(foreignAnswer)).toEqual(readActionResult(nonexistentAnswer));
    expect(foreignAnswer.status).toBe(nonexistentAnswer.status);
    expect(foreignAnswer.body).toBe(nonexistentAnswer.body);
    expect(foreignAnswer.body).not.toContain(foreignUniverse.id);

    for (const malformedArgument of [{ universeId: "not-a-uuid" }, { universeId: "" }, {}]) {
      const answer = await remember(malformedArgument);
      expect(readActionResult(answer)).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    }

    // Nothing was remembered or changed by any of those calls.
    expect(await readRememberedUniverseIdInDatabase(firstAccount.email)).toBe(secondOwnUniverse.id);
    expect(await readRememberedUniverseIdInDatabase(secondAccount.email)).toBeNull();
    // The own universe still works: the same call with an own identifier is accepted.
    expect(readActionResult(await remember({ universeId: firstOwnUniverse.id }))).toEqual({ ok: true, value: null });
    expect(await readRememberedUniverseIdInDatabase(firstAccount.email)).toBe(firstOwnUniverse.id);
  });
});

test.describe("forged calls (FR-2, FR-32, NFR-3)", () => {
  test("calls without a session, from the sign-in page and from workspace addresses, read and change nothing", async ({ page, request }) => {
    const account = await seedAccountInDatabase();
    const token = buildToken();
    const [ownUniverse, secondOwnUniverse] = await seedUniversesInDatabase(account.email, [
      { name: `Own universe ${token}` },
      { name: `Second own universe ${token}` },
    ]);
    await signInThroughTheForm(page, account);
    const createActionId = captureServerActionId(page, "create-universe");
    const checkActionId = captureServerActionId(page, "check-name");
    const rememberActionId = captureServerActionId(page, "remember-universe");
    const checkAnswered = waitForNameCheckAnswer(page, "x");
    await createUniverseThroughTheForm(page, { name: `Created for the identifiers ${token}` });
    await openCreationForm(page);
    await findNameField(page).fill("x");
    await checkAnswered;
    const actionIds = { create: await createActionId, check: await checkActionId, remember: await rememberActionId };
    const rememberedBefore = await readRememberedUniverseIdInDatabase(account.email);
    const universesBefore = await readUniversesOfAccountInDatabase(account.email);

    const forgedName = `Forged ${token}`;
    const forgedCalls = [
      { actionId: actionIds.create, argument: { name: forgedName, description: null, mode: "READER" } },
      { actionId: actionIds.check, argument: { name: ownUniverse.name } },
      { actionId: actionIds.remember, argument: { universeId: secondOwnUniverse.id } },
    ];
    for (const address of ["/", "/?x=1", "/nope"]) {
      for (const forgedCall of forgedCalls) {
        const answer = await replayServerAction(request, { ...forgedCall, address });
        // The page guard answers by itself: the plain refusal, no redirect and nothing of the workspace.
        expect(answer.status, `${address}`).toBe(SIGNED_OUT_ACTION_REFUSAL.status);
        expect(answer.body).toBe(SIGNED_OUT_ACTION_REFUSAL.text);
        expect(answer.contentType).toBe("text/plain");
      }
    }
    for (const address of ["/sign-in", "/sign-up"]) {
      for (const forgedCall of forgedCalls) {
        const answer = await replayServerAction(request, { ...forgedCall, address });
        // On a public page the action may not even be found, or refuses by itself: either way it is not a success
        // and reveals nothing of the account.
        expect(readActionResult(answer)?.ok ?? false, `${address}`).toBe(false);
        expect(answer.body).not.toContain(ownUniverse.name);
        expect(answer.body).not.toContain(ownUniverse.id);
        expect(answer.body).not.toContain('"isInUse":true');
        for (const workspaceText of WORKSPACE_ONLY_TEXTS) {
          expect(answer.body).not.toContain(workspaceText);
        }
      }
    }

    expect(await countUniversesWithNameInDatabase(forgedName)).toBe(0);
    expect(await readRememberedUniverseIdInDatabase(account.email)).toBe(rememberedBefore);
    expect(await readUniversesOfAccountInDatabase(account.email)).toEqual(universesBefore);
  });

  test("an owner, account or user sent in a call is ignored: the universe belongs to the account of the session (FR-2)", async ({ page, browser, request }) => {
    test.slow();
    const sessionAccount = await seedAccountInDatabase();
    const victimAccount = await seedAccountInDatabase();
    const token = buildToken();
    const [victimUniverse] = await seedUniversesInDatabase(victimAccount.email, [{ name: `Victim universe ${token}` }]);
    const victimAccountId = await readAccountIdInDatabase(victimAccount.email);
    await signInThroughTheForm(page, sessionAccount);
    const createActionId = captureServerActionId(page, "create-universe");
    const rememberActionId = captureServerActionId(page, "remember-universe");
    await createUniverseThroughTheForm(page, { name: `Genuine ${token}` });
    const actionIds = { create: await createActionId, remember: await rememberActionId };
    const cookieHeader = buildCookieHeader(await page.context().cookies());
    const ownerData = { ownerId: victimAccountId, userId: victimAccountId, accountId: victimAccountId, owner: { id: victimAccountId } };
    const ownerHeaders = { "x-owner-id": victimAccountId, "x-user-id": victimAccountId, "x-account-id": victimAccountId };

    const forgedCreation = await replayServerAction(request, {
      actionId: actionIds.create,
      address: `/?ownerId=${victimAccountId}&userId=${victimAccountId}`,
      cookieHeader,
      extraHeaders: ownerHeaders,
      argument: { name: `Forged owner ${token}`, description: null, mode: "READER", ...ownerData },
    });
    expect(readActionResult(forgedCreation)?.ok).toBe(true);

    // With the identifier of a universe of another account, the owner data changes nothing: same answer as without it.
    const plainForeignAnswer = await replayServerAction(request, {
      actionId: actionIds.remember,
      address: "/",
      cookieHeader,
      argument: { universeId: victimUniverse.id },
    });
    const forgedForeignAnswer = await replayServerAction(request, {
      actionId: actionIds.remember,
      address: `/?ownerId=${victimAccountId}`,
      cookieHeader,
      extraHeaders: ownerHeaders,
      argument: { universeId: victimUniverse.id, ...ownerData },
    });
    expect(readActionResult(forgedForeignAnswer)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    // The result is the same one; only the framework's own echo of the address differs.
    expect(readActionResult(forgedForeignAnswer)).toEqual(readActionResult(plainForeignAnswer));

    const sessionRows = await readUniversesOfAccountInDatabase(sessionAccount.email);
    const victimRows = await readUniversesOfAccountInDatabase(victimAccount.email);
    const sessionAccountId = await readAccountIdInDatabase(sessionAccount.email);
    expect(sessionRows.map((row) => [row.name, row.ownerId])).toEqual([
      [`Genuine ${token}`, sessionAccountId],
      [`Forged owner ${token}`, sessionAccountId],
    ]);
    expect(victimRows.map((row) => row.name)).toEqual([`Victim universe ${token}`]);
    expect(await readRememberedUniverseIdInDatabase(victimAccount.email)).toBeNull();

    // The universe the call made shows in the account of the session and never in the other one.
    await page.reload();
    await expectListedUniverseNames(page, [`Genuine ${token}`, `Forged owner ${token}`]);
    const otherPerson = await openSignedInPageOfAnotherAccount(browser, victimAccount);
    try {
      await expectListedUniverseNames(otherPerson.page, [`Victim universe ${token}`]);
      expect(await otherPerson.page.content()).not.toContain(`Forged owner ${token}`);
    } finally {
      await otherPerson.context.close();
    }
  });
});
