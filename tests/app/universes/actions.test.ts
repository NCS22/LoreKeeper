import { describe, expect, it, vi } from "vitest";
import {
  confirmAccountAction,
  createUniverseAction,
  editUniverseAction,
  isUniverseNameInUseAction,
  rememberUniverseAction,
} from "@/app/universes/actions";
import { createAccountsModule } from "@/modules/accounts";
import {
  UNIVERSE_DESCRIPTION_TOO_LONG_CODE,
  UNIVERSE_NAME_REQUIRED_CODE,
  createUniversesModule,
} from "@/modules/universes";
import { UNIVERSE_ID_INVALID_CODE } from "@/modules/universes/domain/universe-id";
import {
  AUTHENTICATION_ERROR_CODE,
  INFRASTRUCTURE_ERROR_CODE,
  NOT_FOUND_ERROR_CODE,
} from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";
import { getBetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import { getPrismaClient } from "@/shared/infrastructure/prisma-client";
import { CROSS_SITE_REQUEST_ISSUE_CODE } from "@/shared/presentation/assert-same-site-request";
import { ERROR_MESSAGE_BY_CODE } from "@/shared/presentation/error-messages";
import { INVALID_INPUT_ISSUE_CODE } from "@/shared/presentation/parse-action-input";
import {
  CROSS_SITE_REQUEST_EMULATIONS,
  TEST_SESSION_COOKIE_NAME,
  emulateRequestFromThisSite,
  prepareRealCompositionOverTestDatabase,
} from "../../support/database/real-composition-environment";
import { emulatedBrowser } from "../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const PASSWORD = "unique-typed-password-4f9c1a";
const ANA_EMAIL = "ana@example.com";
const BETO_EMAIL = "beto@example.com";
const NONEXISTENT_UNIVERSE_ID = "2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a";

const { readStoredRowsClient } = prepareRealCompositionOverTestDatabase();

/** Signs the person up; the emulated browser then holds that person's session. */
async function signUpThroughTheUseCase(displayName: string, email: string): Promise<void> {
  await createAccountsModule().signUp({
    displayName,
    email,
    password: PASSWORD,
    repeatPassword: PASSWORD,
  });
}

async function readUserId(email: string): Promise<string> {
  const storedUser = await readStoredRowsClient().user.findUniqueOrThrow({ where: { email } });
  return storedUser.id;
}

/** Signs Ana up and then Beto, and leaves the browser with Beto's session. Returns Ana's session token. */
async function signUpAnaThenBeto(): Promise<{ anaSessionToken: string; betoSessionToken: string }> {
  await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
  const anaSessionToken = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME) ?? "";
  emulatedBrowser.clear();
  await signUpThroughTheUseCase("Beto Ruiz", BETO_EMAIL);
  const betoSessionToken = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME) ?? "";
  return { anaSessionToken, betoSessionToken };
}

function switchToSession(sessionToken: string): void {
  emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, sessionToken);
}

async function countStoredUniverses(): Promise<number> {
  return readStoredRowsClient().universe.count();
}

function silenceServerLog(): unknown[][] {
  const loggedLines: unknown[][] = [];
  vi.spyOn(console, "error").mockImplementation((...lineParts: unknown[]) => {
    loggedLines.push(lineParts);
  });
  return loggedLines;
}

const VALID_CREATION_INPUT = { name: "Middle-earth", description: "An old world.", mode: "AUTHOR" };

type ActionUnderTest = {
  readonly label: string;
  readonly run: () => Promise<unknown>;
};

/**
 * One call to each of the five actions with input that a signed-in person could send. The edit
 * names a nonexistent universe, so even with a session nothing could change.
 */
const EVERY_ACTION: readonly ActionUnderTest[] = [
  { label: "createUniverseAction", run: () => createUniverseAction(VALID_CREATION_INPUT) },
  { label: "isUniverseNameInUseAction", run: () => isUniverseNameInUseAction({ name: "Anything" }) },
  {
    label: "rememberUniverseAction",
    run: () => rememberUniverseAction({ universeId: NONEXISTENT_UNIVERSE_ID }),
  },
  { label: "confirmAccountAction", run: () => confirmAccountAction() },
  {
    label: "editUniverseAction",
    run: () =>
      editUniverseAction({ universeId: NONEXISTENT_UNIVERSE_ID, name: "Arda", description: null }),
  },
];

describe("with a valid session", () => {
  it("createUniverseAction stores the universe for the account of the session (FR-1, FR-24)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);

    const result = await createUniverseAction(VALID_CREATION_INPUT);

    expect(result).toMatchObject({
      ok: true,
      value: { universe: { name: "Middle-earth", description: "An old world.", mode: "AUTHOR" } },
    });
    const storedUniverses = await readStoredRowsClient().universe.findMany();
    expect(storedUniverses).toHaveLength(1);
    expect(storedUniverses[0]?.ownerId).toBe(await readUserId(ANA_EMAIL));
    expect(result.ok && result.value.universe.id).toBe(storedUniverses[0]?.id);
  });

  it("createUniverseAction reports every failing field together and stores nothing (FR-5)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);

    const result = await createUniverseAction({ name: "   ", description: null, mode: "SOMETHING" });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: { name: [{ code: "NAME_REQUIRED" }], mode: [{ code: "MODE_INVALID" }] },
      },
    });
    expect(await countStoredUniverses()).toBe(0);
  });

  it("createUniverseAction reports an input of the wrong shape as a validation error on that field", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);

    const result = await createUniverseAction({ name: 12, description: null });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: {
          name: [{ code: INVALID_INPUT_ISSUE_CODE }],
          mode: [{ code: INVALID_INPUT_ISSUE_CODE }],
        },
      },
    });
    expect(await countStoredUniverses()).toBe(0);
  });

  it("isUniverseNameInUseAction compares with the own universes, ignoring case, accents and spacing (FR-21)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    await createUniverseAction({ name: "Cosmère", description: null, mode: "READER" });

    expect(await isUniverseNameInUseAction({ name: "  COSMERE " })).toEqual({
      ok: true,
      value: { isInUse: true },
    });
    expect(await isUniverseNameInUseAction({ name: "Another" })).toEqual({
      ok: true,
      value: { isInUse: false },
    });
  });

  it("isUniverseNameInUseAction leaves out the excluded universe and still counts another own one (spec 007a FR-8)", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    const betoCreation = await createUniverseAction({ name: "Cosmère", description: null, mode: "READER" });
    const betoUniverseId = betoCreation.ok ? betoCreation.value.universe.id : "";
    switchToSession(anaSessionToken);
    const cosmereCreation = await createUniverseAction({ name: "Cosmère", description: null, mode: "READER" });
    const cosmereUniverseId = cosmereCreation.ok ? cosmereCreation.value.universe.id : "";

    expect(
      await isUniverseNameInUseAction({ name: "  COSMERE ", excludedUniverseId: cosmereUniverseId }),
    ).toEqual({ ok: true, value: { isInUse: false } });
    expect(
      await isUniverseNameInUseAction({ name: "Cosmère", excludedUniverseId: betoUniverseId }),
    ).toEqual({ ok: true, value: { isInUse: true } });
    expect(
      await isUniverseNameInUseAction({ name: "Cosmère", excludedUniverseId: "not-a-universe-id" }),
    ).toEqual({ ok: true, value: { isInUse: true } });

    await createUniverseAction({ name: "cosmere", description: null, mode: "AUTHOR" });
    expect(
      await isUniverseNameInUseAction({ name: "Cosmère", excludedUniverseId: cosmereUniverseId }),
    ).toEqual({ ok: true, value: { isInUse: true } });
    switchToSession(betoSessionToken);
    expect(
      await isUniverseNameInUseAction({ name: "Cosmère", excludedUniverseId: betoUniverseId }),
    ).toEqual({ ok: true, value: { isInUse: false } });
  });

  it("isUniverseNameInUseAction reports an excluded identifier that is not a string as a validation error on that field", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);

    const result = await isUniverseNameInUseAction({ name: "Anything", excludedUniverseId: 12 });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: { excludedUniverseId: [{ code: INVALID_INPUT_ISSUE_CODE }] },
      },
    });
  });

  it("rememberUniverseAction remembers an own universe and the next load selects it (FR-11, FR-27)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    await createUniverseAction({ name: "First", description: null, mode: "READER" });
    const secondCreation = await createUniverseAction({ name: "Second", description: null, mode: "READER" });
    const secondUniverseId = secondCreation.ok ? secondCreation.value.universe.id : "";

    const result = await rememberUniverseAction({ universeId: secondUniverseId });

    expect(result).toEqual({ ok: true, value: null });
    const anaActor = { userId: await readUserId(ANA_EMAIL), displayName: "Ana Torres", email: ANA_EMAIL };
    const workspaceUniverses = await createUniversesModule().loadWorkspaceUniverses(anaActor);
    expect(workspaceUniverses.initialUniverseId).toBe(secondUniverseId);
  });

  it("confirmAccountAction gives the identifier of the account of the session (FR-18)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);

    const result = await confirmAccountAction();

    expect(result).toEqual({ ok: true, value: { accountKey: await readUserId(ANA_EMAIL) } });
  });

  it("accepts a request from a page of the application itself", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    emulateRequestFromThisSite();

    const result = await createUniverseAction(VALID_CREATION_INPUT);

    expect(result.ok).toBe(true);
  });
});

describe("without a session (FR-32)", () => {
  it.each(EVERY_ACTION)("$label answers the authentication error", async ({ run }) => {
    expect(await run()).toEqual({
      ok: false,
      error: {
        code: AUTHENTICATION_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[AUTHENTICATION_ERROR_CODE],
      },
    });
  });

  it("createUniverseAction stores nothing, and invalid input does not turn the answer into a validation error", async () => {
    const withValidInput = await createUniverseAction(VALID_CREATION_INPUT);
    const withInvalidInput = await createUniverseAction("not even an object");

    expect(withValidInput).toMatchObject({ ok: false, error: { code: AUTHENTICATION_ERROR_CODE } });
    expect(withInvalidInput).toEqual(withValidInput);
    expect(await countStoredUniverses()).toBe(0);
  });

  it("answers the authentication error when the session cookie is not a stored session", async () => {
    emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, "not-a-real-session-token");

    const result = await createUniverseAction(VALID_CREATION_INPUT);

    expect(result).toMatchObject({ ok: false, error: { code: AUTHENTICATION_ERROR_CODE } });
    expect(await countStoredUniverses()).toBe(0);
  });

  it("does not log a missing session as a failure", async () => {
    const loggedLines = silenceServerLog();

    await rememberUniverseAction({ universeId: NONEXISTENT_UNIVERSE_ID });

    expect(loggedLines).toEqual([]);
  });
});

describe("when the session cannot be checked (FR-33)", () => {
  it.each(EVERY_ACTION)(
    "$label answers the infrastructure error, not the authentication error, and runs nothing",
    async ({ run }) => {
      await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
      vi.spyOn(getBetterAuthInstance().api, "getSession").mockRejectedValue(
        new Error("connection to db-host-7 refused"),
      );
      silenceServerLog();

      const result = await run();

      expect(result).toEqual({
        ok: false,
        error: {
          code: INFRASTRUCTURE_ERROR_CODE,
          message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
        },
      });
      expect(JSON.stringify(result)).not.toMatch(/db-host-7|stack/i);
      expect(await countStoredUniverses()).toBe(0);
    },
  );
});

describe("when the request comes from another site", () => {
  it.each(CROSS_SITE_REQUEST_EMULATIONS)(
    "every action rejects a request with $label, even with a valid session, and stores nothing",
    async ({ emulate }) => {
      await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
      emulate();

      for (const { run } of EVERY_ACTION) {
        expect(await run()).toMatchObject({
          ok: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] },
          },
        });
      }
      expect(await countStoredUniverses()).toBe(0);
    },
  );
});

describe("owner, account and universe data sent by the client is ignored (FR-2)", () => {
  it("createUniverseAction gives the same result with forged ownerId, userId, accountId and universeId", async () => {
    const { betoSessionToken } = await signUpAnaThenBeto();
    const betoUserId = await readUserId(BETO_EMAIL);
    const forgedKeys = {
      ownerId: await readUserId(ANA_EMAIL),
      userId: await readUserId(ANA_EMAIL),
      accountId: await readUserId(ANA_EMAIL),
      universeId: NONEXISTENT_UNIVERSE_ID,
    };
    switchToSession(betoSessionToken);

    const plainResult = await createUniverseAction(VALID_CREATION_INPUT);
    const forgedResult = await createUniverseAction({ ...VALID_CREATION_INPUT, ...forgedKeys });

    expect(plainResult.ok).toBe(true);
    expect(forgedResult.ok).toBe(true);
    expect(forgedResult.ok && Object.keys(forgedResult.value.universe).sort()).toEqual(
      plainResult.ok ? Object.keys(plainResult.value.universe).sort() : [],
    );
    expect(forgedResult.ok && forgedResult.value.universe.id).not.toBe(NONEXISTENT_UNIVERSE_ID);
    const storedUniverses = await readStoredRowsClient().universe.findMany();
    expect(storedUniverses).toHaveLength(2);
    expect(storedUniverses.every((storedUniverse) => storedUniverse.ownerId === betoUserId)).toBe(true);
  });

  it("isUniverseNameInUseAction and rememberUniverseAction give the same result with forged keys", async () => {
    const { anaSessionToken } = await signUpAnaThenBeto();
    switchToSession(anaSessionToken);
    const creation = await createUniverseAction(VALID_CREATION_INPUT);
    const ownUniverseId = creation.ok ? creation.value.universe.id : "";
    const forgedKeys = {
      ownerId: await readUserId(BETO_EMAIL),
      userId: await readUserId(BETO_EMAIL),
      accountId: await readUserId(BETO_EMAIL),
    };

    expect(await isUniverseNameInUseAction({ name: "Middle-earth", ...forgedKeys })).toEqual(
      await isUniverseNameInUseAction({ name: "Middle-earth" }),
    );
    expect(await rememberUniverseAction({ universeId: ownUniverseId, ...forgedKeys })).toEqual(
      await rememberUniverseAction({ universeId: ownUniverseId }),
    );
    const rememberedRows = await readStoredRowsClient().rememberedUniverse.findMany();
    expect(rememberedRows.map((row) => row.userId)).toEqual([await readUserId(ANA_EMAIL)]);
  });
});

describe("rememberUniverseAction with a bad identifier (FR-30, FR-35)", () => {
  it("rejects an empty identifier with the domain issue on universeId, logs it once and stores nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const loggedLines = silenceServerLog();

    const result = await rememberUniverseAction({ universeId: "" });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: { universeId: [{ code: UNIVERSE_ID_INVALID_CODE }] },
      },
    });
    expect(loggedLines).toHaveLength(1);
    expect(loggedLines[0]?.[0]).toBe(`[server-error] ${VALIDATION_ERROR_CODE}`);
    expect(await readStoredRowsClient().rememberedUniverse.count()).toBe(0);
  });

  it("rejects a malformed identifier with the domain issue on universeId", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    silenceServerLog();

    const result = await rememberUniverseAction({ universeId: "not-an-identifier" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: VALIDATION_ERROR_CODE, fieldErrors: { universeId: [{ code: UNIVERSE_ID_INVALID_CODE }] } },
    });
  });

  it.each([
    { label: "missing", input: {} },
    { label: "not a string", input: { universeId: 42 } },
    { label: "null", input: { universeId: null } },
    { label: "an input that is not an object", input: "text" },
  ])("rejects a universeId that is $label as a shape failure, logged once", async ({ input }) => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const loggedLines = silenceServerLog();

    const result = await rememberUniverseAction(input);

    expect(result).toMatchObject({ ok: false, error: { code: VALIDATION_ERROR_CODE } });
    expect(loggedLines).toHaveLength(1);
  });

  it("answers the same not-found result for a foreign and for a nonexistent universe, logs each once and stores nothing", async () => {
    const { anaSessionToken } = await signUpAnaThenBeto();
    const betoCreation = await createUniverseAction(VALID_CREATION_INPUT);
    const betoUniverseId = betoCreation.ok ? betoCreation.value.universe.id : "";
    switchToSession(anaSessionToken);
    const loggedLines = silenceServerLog();

    const foreignResult = await rememberUniverseAction({ universeId: betoUniverseId });
    const nonexistentResult = await rememberUniverseAction({ universeId: NONEXISTENT_UNIVERSE_ID });

    expect(foreignResult).toEqual(nonexistentResult);
    expect(foreignResult).toEqual({
      ok: false,
      error: { code: NOT_FOUND_ERROR_CODE, message: ERROR_MESSAGE_BY_CODE[NOT_FOUND_ERROR_CODE] },
    });
    expect(JSON.stringify(foreignResult)).not.toContain(betoUniverseId);
    expect(loggedLines).toHaveLength(2);
    expect(loggedLines.every((line) => line[0] === `[server-error] ${NOT_FOUND_ERROR_CODE}`)).toBe(true);
    expect(await readStoredRowsClient().rememberedUniverse.count()).toBe(0);
  });
});

describe("when the storage fails (FR-7, NFR-2)", () => {
  it("answers the generic infrastructure result with no stack, query or internal name, and logs the failure once", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    vi.spyOn(getPrismaClient().universe, "findFirst").mockRejectedValue(
      new Error("connection to db-host-7 refused: select * from Universe"),
    );
    const loggedLines = silenceServerLog();

    const result = await rememberUniverseAction({ universeId: NONEXISTENT_UNIVERSE_ID });

    expect(result).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/db-host-7|select|stack|Universe/i);
    expect(loggedLines).toHaveLength(1);
    expect(loggedLines[0]?.[0]).toBe(`[server-error] ${INFRASTRUCTURE_ERROR_CODE}`);
  });

  it("createUniverseAction answers the generic infrastructure result and stores nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    vi.spyOn(getPrismaClient().universe, "create").mockRejectedValue(
      new Error("connection to db-host-7 refused"),
    );
    silenceServerLog();

    const result = await createUniverseAction(VALID_CREATION_INPUT);

    expect(result).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
    expect(await countStoredUniverses()).toBe(0);
  });
});

describe("two accounts (NFR-3)", () => {
  it("never see each other's universes, names or remembered universe", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    switchToSession(anaSessionToken);
    const anaCreation = await createUniverseAction({ name: "Ana's secret world", description: null, mode: "READER" });
    const anaUniverseId = anaCreation.ok ? anaCreation.value.universe.id : "";
    await rememberUniverseAction({ universeId: anaUniverseId });
    switchToSession(betoSessionToken);

    expect(await isUniverseNameInUseAction({ name: "Ana's secret world" })).toEqual({
      ok: true,
      value: { isInUse: false },
    });
    const betoRemembering = await rememberUniverseAction({ universeId: anaUniverseId });
    expect(betoRemembering).toMatchObject({ ok: false, error: { code: NOT_FOUND_ERROR_CODE } });
    const betoActor = { userId: await readUserId(BETO_EMAIL), displayName: "Beto Ruiz", email: BETO_EMAIL };
    expect(await createUniversesModule().loadWorkspaceUniverses(betoActor)).toEqual({
      universes: [],
      initialUniverseId: null,
    });
    expect(await confirmAccountAction()).toEqual({ ok: true, value: { accountKey: betoActor.userId } });
    const rememberedRows = await readStoredRowsClient().rememberedUniverse.findMany();
    expect(rememberedRows.map((row) => row.userId)).toEqual([await readUserId(ANA_EMAIL)]);
  });
});

const LONG_AGO = new Date("2026-01-15T08:00:00.000Z");

/** Creates a universe through the action with the session the browser holds, and returns its id. */
async function createUniverseThroughTheAction(
  name: string,
  description: string | null,
  mode: "READER" | "AUTHOR",
): Promise<string> {
  const creation = await createUniverseAction({ name, description, mode });
  if (!creation.ok) {
    throw new Error(`the universe ${name} could not be created for the test`);
  }
  return creation.value.universe.id;
}

/** Moves the update time of a stored universe back, so that a new write is always visible. */
async function setUpdateTimeLongAgo(universeId: string): Promise<void> {
  await readStoredRowsClient().universe.update({
    where: { id: universeId },
    data: { updatedAt: LONG_AGO },
  });
}

async function readStoredUniverse(universeId: string) {
  return readStoredRowsClient().universe.findUniqueOrThrow({ where: { id: universeId } });
}

const NOT_FOUND_ANSWER = {
  ok: false,
  error: { code: NOT_FOUND_ERROR_CODE, message: ERROR_MESSAGE_BY_CODE[NOT_FOUND_ERROR_CODE] },
};

describe("editUniverseAction (spec 007a)", () => {
  it("stores the trimmed name and description of an own universe and answers it, keeping its id, owner, mode and creation time (FR-4)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createUniverseThroughTheAction("Middle-earth", "An old world.", "READER");
    await setUpdateTimeLongAgo(universeId);
    const storedBefore = await readStoredUniverse(universeId);

    const result = await editUniverseAction({
      universeId,
      name: "  Arda  ",
      description: "  The whole world.  ",
    });

    const storedAfter = await readStoredUniverse(universeId);
    expect(result).toEqual({
      ok: true,
      value: {
        universe: {
          id: universeId,
          name: "Arda",
          description: "The whole world.",
          mode: "READER",
          createdAt: storedBefore.createdAt.toISOString(),
          updatedAt: storedAfter.updatedAt.toISOString(),
        },
      },
    });
    expect(storedAfter).toMatchObject({
      id: universeId,
      ownerId: await readUserId(ANA_EMAIL),
      name: "Arda",
      description: "The whole world.",
      mode: "READER",
      createdAt: storedBefore.createdAt,
      deletedAt: null,
    });
    expect(storedAfter.updatedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());
  });

  it("answers success with the stored universe for a save with no real change, leaving updatedAt as it was (FR-7)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createUniverseThroughTheAction("Middle-earth", "An old world.", "AUTHOR");
    await setUpdateTimeLongAgo(universeId);

    const result = await editUniverseAction({
      universeId,
      name: " Middle-earth ",
      description: "An old world.  ",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { universe: { id: universeId, name: "Middle-earth", updatedAt: LONG_AGO.toISOString() } },
    });
    expect((await readStoredUniverse(universeId)).updatedAt).toEqual(LONG_AGO);
  });

  it("reports every failing field together, keyed by field, and changes nothing (FR-6)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createUniverseThroughTheAction("Middle-earth", "An old world.", "READER");
    const storedBefore = await readStoredUniverse(universeId);

    const result = await editUniverseAction({ universeId, name: "   ", description: "x".repeat(2001) });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: {
          name: [{ code: UNIVERSE_NAME_REQUIRED_CODE }],
          description: [{ code: UNIVERSE_DESCRIPTION_TOO_LONG_CODE }],
        },
      },
    });
    expect(await readStoredUniverse(universeId)).toEqual(storedBefore);
  });

  it("reports an input of the wrong shape as a validation error on each failing field and changes nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createUniverseThroughTheAction("Middle-earth", null, "READER");
    const storedBefore = await readStoredUniverse(universeId);

    const result = await editUniverseAction({ universeId, name: 12 });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: {
          name: [{ code: INVALID_INPUT_ISSUE_CODE }],
          description: [{ code: INVALID_INPUT_ISSUE_CODE }],
        },
      },
    });
    expect(await readStoredUniverse(universeId)).toEqual(storedBefore);
  });

  it.each([
    { label: "malformed", universeId: "not-an-identifier" },
    { label: "empty", universeId: "" },
  ])("rejects a $label identifier with the domain issue on universeId (FR-11)", async ({ universeId }) => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);

    const result = await editUniverseAction({ universeId, name: "Arda", description: null });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: { universeId: [{ code: UNIVERSE_ID_INVALID_CODE }] },
      },
    });
  });

  it.each([
    { label: "missing", input: { name: "Arda", description: null } },
    { label: "not a string", input: { universeId: 42, name: "Arda", description: null } },
  ])("rejects a universeId that is $label as a shape failure on universeId (FR-11)", async ({ input }) => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);

    const result = await editUniverseAction(input);

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: { universeId: [{ code: INVALID_INPUT_ISSUE_CODE }] },
      },
    });
  });

  it("gives the same not found answer for a universe of another account, a nonexistent one and a deleted one, also with values equal to the stored ones, and changes nothing (FR-9, FR-11)", async () => {
    const { anaSessionToken } = await signUpAnaThenBeto();
    const betoUniverseId = await createUniverseThroughTheAction("Beto's world", "Beto's notes.", "READER");
    switchToSession(anaSessionToken);
    const deletedUniverseId = await createUniverseThroughTheAction("Lost world", "Gone.", "AUTHOR");
    await readStoredRowsClient().universe.update({
      where: { id: deletedUniverseId },
      data: { deletedAt: new Date("2026-02-02T10:00:00.000Z") },
    });
    const betoUniverseBefore = await readStoredUniverse(betoUniverseId);
    const deletedUniverseBefore = await readStoredUniverse(deletedUniverseId);
    const betoUserId = await readUserId(BETO_EMAIL);

    const answers = [
      await editUniverseAction({ universeId: betoUniverseId, name: "Taken over", description: null }),
      await editUniverseAction({ universeId: betoUniverseId, name: "Beto's world", description: "Beto's notes." }),
      await editUniverseAction({ universeId: betoUniverseId, name: "   ", description: "x".repeat(2001) }),
      await editUniverseAction({
        universeId: betoUniverseId,
        name: "Taken over",
        description: null,
        ownerId: betoUserId,
        userId: betoUserId,
        accountId: betoUserId,
      }),
      await editUniverseAction({ universeId: NONEXISTENT_UNIVERSE_ID, name: "Taken over", description: null }),
      await editUniverseAction({ universeId: NONEXISTENT_UNIVERSE_ID, name: "   ", description: null }),
      await editUniverseAction({ universeId: deletedUniverseId, name: "Found again", description: null }),
      await editUniverseAction({ universeId: deletedUniverseId, name: "Lost world", description: "Gone." }),
    ];

    for (const answer of answers) {
      expect(answer).toEqual(NOT_FOUND_ANSWER);
    }
    expect(await readStoredUniverse(betoUniverseId)).toEqual(betoUniverseBefore);
    expect(await readStoredUniverse(deletedUniverseId)).toEqual(deletedUniverseBefore);
  });

  it("gives the same result with forged ownerId, userId, accountId and mode, and the stored owner and mode stay (FR-4, FR-9)", async () => {
    const { betoSessionToken } = await signUpAnaThenBeto();
    const anaUserId = await readUserId(ANA_EMAIL);
    const betoUserId = await readUserId(BETO_EMAIL);
    switchToSession(betoSessionToken);
    const plainUniverseId = await createUniverseThroughTheAction("Plain world", null, "READER");
    const forgedUniverseId = await createUniverseThroughTheAction("Forged world", null, "READER");
    const forgedKeys = { ownerId: anaUserId, userId: anaUserId, accountId: anaUserId, mode: "AUTHOR" };

    const plainResult = await editUniverseAction({
      universeId: plainUniverseId,
      name: "Edited world",
      description: "Edited.",
    });
    const forgedResult = await editUniverseAction({
      universeId: forgedUniverseId,
      name: "Edited world",
      description: "Edited.",
      ...forgedKeys,
    });

    expect(plainResult.ok).toBe(true);
    expect(forgedResult).toMatchObject({
      ok: true,
      value: { universe: { id: forgedUniverseId, name: "Edited world", mode: "READER" } },
    });
    expect(forgedResult.ok && Object.keys(forgedResult.value.universe).sort()).toEqual(
      plainResult.ok ? Object.keys(plainResult.value.universe).sort() : [],
    );
    expect(await readStoredUniverse(forgedUniverseId)).toMatchObject({
      ownerId: betoUserId,
      mode: "READER",
      name: "Edited world",
    });
    expect(await readStoredRowsClient().universe.count({ where: { ownerId: anaUserId } })).toBe(0);
  });

  it("changes nothing without a session, and invalid input does not turn the answer into a validation error (FR-10)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createUniverseThroughTheAction("Middle-earth", "An old world.", "READER");
    const storedBefore = await readStoredUniverse(universeId);
    emulatedBrowser.clear();

    const withValidInput = await editUniverseAction({ universeId, name: "Arda", description: null });
    const withInvalidInput = await editUniverseAction({ universeId: "bad", name: 12 });

    expect(withValidInput).toEqual({
      ok: false,
      error: { code: AUTHENTICATION_ERROR_CODE, message: ERROR_MESSAGE_BY_CODE[AUTHENTICATION_ERROR_CODE] },
    });
    expect(withInvalidInput).toEqual(withValidInput);
    expect(await readStoredUniverse(universeId)).toEqual(storedBefore);
  });

  it("changes nothing when the session cannot be checked, answering the infrastructure error (FR-10)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createUniverseThroughTheAction("Middle-earth", "An old world.", "READER");
    const storedBefore = await readStoredUniverse(universeId);
    vi.spyOn(getBetterAuthInstance().api, "getSession").mockRejectedValue(
      new Error("connection to db-host-7 refused"),
    );
    silenceServerLog();

    const result = await editUniverseAction({ universeId, name: "Arda", description: null });

    expect(result).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
    expect(await readStoredUniverse(universeId)).toEqual(storedBefore);
  });

  it.each(CROSS_SITE_REQUEST_EMULATIONS)(
    "rejects a request with $label, even for an own universe with a valid session, and changes nothing",
    async ({ emulate }) => {
      await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
      const universeId = await createUniverseThroughTheAction("Middle-earth", "An old world.", "READER");
      const storedBefore = await readStoredUniverse(universeId);
      emulate();

      const result = await editUniverseAction({ universeId, name: "Arda", description: null });

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: VALIDATION_ERROR_CODE,
          fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] },
        },
      });
      expect(await readStoredUniverse(universeId)).toEqual(storedBefore);
    },
  );

  it("answers the generic infrastructure result when the storage fails, changing nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createUniverseThroughTheAction("Middle-earth", "An old world.", "READER");
    const storedBefore = await readStoredUniverse(universeId);
    vi.spyOn(getPrismaClient().universe, "updateManyAndReturn").mockRejectedValue(
      new Error("connection to db-host-7 refused: update Universe"),
    );
    silenceServerLog();

    const result = await editUniverseAction({ universeId, name: "Arda", description: null });

    expect(result).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/db-host-7|update|stack|Universe/i);
    expect(await readStoredUniverse(universeId)).toEqual(storedBefore);
  });
});

describe("two accounts editing (spec 007a FR-9, NFR-2)", () => {
  it("never see each other's change, in their universes or in the name check", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    const anaActor = { userId: await readUserId(ANA_EMAIL), displayName: "Ana Torres", email: ANA_EMAIL };
    const betoActor = { userId: await readUserId(BETO_EMAIL), displayName: "Beto Ruiz", email: BETO_EMAIL };
    const betoUniverseId = await createUniverseThroughTheAction("Beto's world", null, "AUTHOR");
    switchToSession(anaSessionToken);
    const anaUniverseId = await createUniverseThroughTheAction("Ana's world", null, "READER");

    const anaEdit = await editUniverseAction({
      universeId: anaUniverseId,
      name: "Ana's secret world",
      description: "Only for Ana.",
    });
    switchToSession(betoSessionToken);
    const betoEdit = await editUniverseAction({
      universeId: betoUniverseId,
      name: "Beto's secret world",
      description: "Only for Beto.",
    });

    expect(anaEdit.ok).toBe(true);
    expect(betoEdit.ok).toBe(true);
    expect(await isUniverseNameInUseAction({ name: "Ana's secret world" })).toEqual({
      ok: true,
      value: { isInUse: false },
    });
    const betoUniverses = await createUniversesModule().loadWorkspaceUniverses(betoActor);
    expect(
      betoUniverses.universes.map((universe) => [universe.id, universe.name, universe.description]),
    ).toEqual([[betoUniverseId, "Beto's secret world", "Only for Beto."]]);
    switchToSession(anaSessionToken);
    expect(await isUniverseNameInUseAction({ name: "Beto's secret world" })).toEqual({
      ok: true,
      value: { isInUse: false },
    });
    const anaUniverses = await createUniversesModule().loadWorkspaceUniverses(anaActor);
    expect(
      anaUniverses.universes.map((universe) => [universe.id, universe.name, universe.description]),
    ).toEqual([[anaUniverseId, "Ana's secret world", "Only for Ana."]]);
  });
});
