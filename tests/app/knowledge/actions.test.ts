import { describe, expect, it, vi } from "vitest";
import { createWorkAction, loadUniverseKnowledgeAction } from "@/app/knowledge/actions";
import { createUniverseAction } from "@/app/universes/actions";
import { createAccountsModule } from "@/modules/accounts";
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
const NOT_FOUND_RESULT = {
  ok: false,
  error: { code: NOT_FOUND_ERROR_CODE, message: ERROR_MESSAGE_BY_CODE[NOT_FOUND_ERROR_CODE] },
};

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

/** Signs Ana up and then Beto, and leaves the browser with Beto's session. */
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

/** Creates a universe for the account of the current session and returns its identifier. */
async function createOwnUniverse(name = "Middle-earth"): Promise<string> {
  const creation = await createUniverseAction({ name, description: null, mode: "READER" });
  if (!creation.ok) {
    throw new Error("The universe of the test could not be created.");
  }
  return creation.value.universe.id;
}

async function countStoredWorks(): Promise<number> {
  return readStoredRowsClient().work.count();
}

async function readStoredUnitLabels(): Promise<string[]> {
  const storedUnits = await readStoredRowsClient().narrativeUnit.findMany({ orderBy: { ordinal: "asc" } });
  return storedUnits.map((unit) => unit.label);
}

function silenceServerLog(): unknown[][] {
  const loggedLines: unknown[][] = [];
  vi.spyOn(console, "error").mockImplementation((...lineParts: unknown[]) => {
    loggedLines.push(lineParts);
  });
  return loggedLines;
}

function buildWorkInput(universeId: string) {
  return { universeId, title: "The Long Road", medium: "NOVEL", unitCount: "3" };
}

type ActionUnderTest = {
  readonly label: string;
  readonly run: () => Promise<unknown>;
};

/** One call to each action with input whose shape is right. */
const EVERY_ACTION: readonly ActionUnderTest[] = [
  { label: "createWorkAction", run: () => createWorkAction(buildWorkInput(NONEXISTENT_UNIVERSE_ID)) },
  {
    label: "loadUniverseKnowledgeAction",
    run: () => loadUniverseKnowledgeAction({ universeId: NONEXISTENT_UNIVERSE_ID }),
  },
];

describe("with a valid session", () => {
  it("createWorkAction stores the work with units 1 to N in an own universe and returns it (FR-1)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    const result = await createWorkAction({ ...buildWorkInput(universeId), title: "  The Long Road " });

    expect(result).toMatchObject({
      ok: true,
      value: {
        work: { title: "The Long Road", medium: "NOVEL", unitWording: "chapter", unitCount: 3 },
      },
    });
    const storedWorks = await readStoredRowsClient().work.findMany();
    expect(storedWorks).toHaveLength(1);
    expect(storedWorks[0]?.universeId).toBe(universeId);
    expect(result.ok && result.value.work.id).toBe(storedWorks[0]?.id);
    expect(await readStoredUnitLabels()).toEqual(["1", "2", "3"]);
  });

  it("loadUniverseKnowledgeAction lists the works of an own universe in creation order (FR-2)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    await createWorkAction({ ...buildWorkInput(universeId), title: "First", unitCount: "120" });
    await createWorkAction({ ...buildWorkInput(universeId), title: "Second", medium: "ANIME", unitCount: "24" });

    const result = await loadUniverseKnowledgeAction({ universeId });

    expect(result).toMatchObject({
      ok: true,
      value: {
        works: [
          { title: "First", medium: "NOVEL", unitWording: "chapter", unitCount: 120 },
          { title: "Second", medium: "ANIME", unitWording: "episode", unitCount: 24 },
        ],
      },
    });
  });

  it("loadUniverseKnowledgeAction lists no works for an own universe without works", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    expect(await loadUniverseKnowledgeAction({ universeId })).toEqual({ ok: true, value: { works: [] } });
  });

  it("createWorkAction reports every failing field together, keyed by field, and stores nothing (FR-1)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    const result = await createWorkAction({ universeId, title: "   ", medium: "PODCAST", unitCount: "1e3" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[VALIDATION_ERROR_CODE],
        fieldErrors: {
          title: [{ code: "TITLE_REQUIRED" }],
          medium: [{ code: "MEDIUM_INVALID" }],
          unitCount: [{ code: "UNIT_COUNT_INVALID" }],
        },
      },
    });
    expect(await countStoredWorks()).toBe(0);
  });

  it.each(["0", "5001", "+12", "7.0", "99999999999999999999"])(
    "createWorkAction refuses the number of units %j through a direct call and stores nothing",
    async (unitCount) => {
      await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
      const universeId = await createOwnUniverse();

      const result = await createWorkAction({ ...buildWorkInput(universeId), unitCount });

      expect(result).toMatchObject({
        ok: false,
        error: { code: VALIDATION_ERROR_CODE, fieldErrors: { unitCount: [{}] } },
      });
      expect(await countStoredWorks()).toBe(0);
    },
  );

  it("createWorkAction reports a number of units that is not text as a shape failure on that field", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    const result = await createWorkAction({ ...buildWorkInput(universeId), unitCount: 12 });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: { unitCount: [{ code: INVALID_INPUT_ISSUE_CODE }] },
      },
    });
    expect(await countStoredWorks()).toBe(0);
  });
});

describe("without a session (FR-11)", () => {
  it.each(EVERY_ACTION)("$label answers the authentication error", async ({ run }) => {
    expect(await run()).toEqual({
      ok: false,
      error: {
        code: AUTHENTICATION_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[AUTHENTICATION_ERROR_CODE],
      },
    });
  });

  it("reads the session before the input, so invalid input does not turn the answer into a validation error", async () => {
    expect(await createWorkAction("not even an object")).toMatchObject({
      ok: false,
      error: { code: AUTHENTICATION_ERROR_CODE },
    });
    expect(await loadUniverseKnowledgeAction(null)).toMatchObject({
      ok: false,
      error: { code: AUTHENTICATION_ERROR_CODE },
    });
    expect(await countStoredWorks()).toBe(0);
  });
});

describe("when the session cannot be checked", () => {
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
    },
  );
});

describe("when the request comes from another site", () => {
  it.each(CROSS_SITE_REQUEST_EMULATIONS)(
    "every action rejects a request with $label, even with a valid session, and stores nothing",
    async ({ emulate }) => {
      await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
      const universeId = await createOwnUniverse();
      emulate();

      const results = [
        await createWorkAction(buildWorkInput(universeId)),
        await loadUniverseKnowledgeAction({ universeId }),
      ];

      for (const result of results) {
        expect(result).toMatchObject({
          ok: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] },
          },
        });
      }
      expect(await countStoredWorks()).toBe(0);
    },
  );
});

describe("another account's universe, a nonexistent one and forged data (FR-11, NFR-2)", () => {
  it("createWorkAction answers the same not found for a universe of another account and a nonexistent one, storing nothing", async () => {
    const { anaSessionToken } = await signUpAnaThenBeto();
    const betoUniverseId = await createOwnUniverse("Beto's world");
    switchToSession(anaSessionToken);

    const foreignResult = await createWorkAction(buildWorkInput(betoUniverseId));
    const nonexistentResult = await createWorkAction(buildWorkInput(NONEXISTENT_UNIVERSE_ID));

    expect(foreignResult).toEqual(NOT_FOUND_RESULT);
    expect(nonexistentResult).toEqual(foreignResult);
    expect(JSON.stringify(foreignResult)).not.toContain(betoUniverseId);
    expect(await countStoredWorks()).toBe(0);
  });

  it("loadUniverseKnowledgeAction answers the same not found for a universe of another account and a nonexistent one", async () => {
    const { anaSessionToken } = await signUpAnaThenBeto();
    const betoUniverseId = await createOwnUniverse("Beto's world");
    await createWorkAction({ ...buildWorkInput(betoUniverseId), title: "Beto's secret work" });
    switchToSession(anaSessionToken);

    const foreignResult = await loadUniverseKnowledgeAction({ universeId: betoUniverseId });
    const nonexistentResult = await loadUniverseKnowledgeAction({ universeId: NONEXISTENT_UNIVERSE_ID });

    expect(foreignResult).toEqual(NOT_FOUND_RESULT);
    expect(nonexistentResult).toEqual(foreignResult);
    expect(JSON.stringify(foreignResult)).not.toMatch(/secret work/);
  });

  it("both actions answer a malformed universe identifier with the validation error on universeId", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);

    for (const result of [
      await createWorkAction(buildWorkInput("not-an-identifier")),
      await loadUniverseKnowledgeAction({ universeId: "not-an-identifier" }),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        error: { code: VALIDATION_ERROR_CODE, fieldErrors: { universeId: [{ code: "UNIVERSE_ID_INVALID" }] } },
      });
    }
  });

  it("createWorkAction ignores a forged owner and unit labels, orders or kinds sent with the input", async () => {
    const { betoSessionToken, anaSessionToken } = await signUpAnaThenBeto();
    const betoUserId = (await readStoredRowsClient().user.findUniqueOrThrow({ where: { email: BETO_EMAIL } })).id;
    switchToSession(anaSessionToken);
    const anaUniverseId = await createOwnUniverse("Ana's world");
    switchToSession(betoSessionToken);
    const betoUniverseId = await createOwnUniverse("Beto's world");
    const forgedInput = {
      ...buildWorkInput(betoUniverseId),
      ownerId: anaUniverseId,
      userId: anaUniverseId,
      id: NONEXISTENT_UNIVERSE_ID,
      unitKind: "EPISODE",
      units: [{ label: "Prologue", ordinal: 1 }],
      labels: ["Prologue", "Interlude", "Epilogue"],
    };

    const plainResult = await createWorkAction(buildWorkInput(betoUniverseId));
    const forgedResult = await createWorkAction(forgedInput);

    expect(forgedResult.ok && Object.keys(forgedResult.value.work).sort()).toEqual(
      plainResult.ok ? Object.keys(plainResult.value.work).sort() : [],
    );
    expect(forgedResult.ok && forgedResult.value.work.id).not.toBe(NONEXISTENT_UNIVERSE_ID);
    expect(forgedResult.ok && forgedResult.value.work.unitWording).toBe("chapter");
    const storedWorks = await readStoredRowsClient().work.findMany({ include: { universe: true } });
    expect(storedWorks).toHaveLength(2);
    expect(storedWorks.every((storedWork) => storedWork.universe.ownerId === betoUserId)).toBe(true);
    expect(await readStoredUnitLabels()).toEqual(["1", "1", "2", "2", "3", "3"]);
  });

  it("two accounts never see each other's works", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    switchToSession(anaSessionToken);
    const anaUniverseId = await createOwnUniverse("Ana's world");
    await createWorkAction({ ...buildWorkInput(anaUniverseId), title: "Ana's work" });
    switchToSession(betoSessionToken);
    const betoUniverseId = await createOwnUniverse("Beto's world");
    await createWorkAction({ ...buildWorkInput(betoUniverseId), title: "Beto's work" });

    const betoLoad = await loadUniverseKnowledgeAction({ universeId: betoUniverseId });
    switchToSession(anaSessionToken);
    const anaLoad = await loadUniverseKnowledgeAction({ universeId: anaUniverseId });

    expect(betoLoad.ok && betoLoad.value.works.map((work) => work.title)).toEqual(["Beto's work"]);
    expect(anaLoad.ok && anaLoad.value.works.map((work) => work.title)).toEqual(["Ana's work"]);
  });
});

describe("when the storage fails", () => {
  it("createWorkAction answers the generic infrastructure result with no internals, logs it once and stores nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    vi.spyOn(getPrismaClient().work, "create").mockRejectedValue(
      new Error("connection to db-host-7 refused: insert into Work"),
    );
    const loggedLines = silenceServerLog();

    const result = await createWorkAction(buildWorkInput(universeId));

    expect(result).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/db-host-7|insert|stack|Work/i);
    expect(loggedLines).toHaveLength(1);
    expect(await countStoredWorks()).toBe(0);
  });

  it("loadUniverseKnowledgeAction answers the generic infrastructure result", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    vi.spyOn(getPrismaClient().work, "findMany").mockRejectedValue(new Error("connection to db-host-7 refused"));
    silenceServerLog();

    expect(await loadUniverseKnowledgeAction({ universeId })).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
  });
});
