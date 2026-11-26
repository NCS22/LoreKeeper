import { describe, expect, it, vi } from "vitest";
import {
  createEntityAction,
  createRelationshipAction,
  createWorkAction,
  loadEntityDetailsAction,
  loadUniverseKnowledgeAction,
} from "@/app/knowledge/actions";
import { createUniverseAction } from "@/app/universes/actions";
import { createAccountsModule } from "@/modules/accounts";
import {
  AUTHENTICATION_ERROR_CODE,
  BUSINESS_RULE_VIOLATION_ERROR_CODE,
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
const NONEXISTENT_ENTITY_ID = "5a1d7c3e-2b4f-4a6e-9c8d-1e2f3a4b5c6d";
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

function buildEntityInput(universeId: string, workId: string) {
  return { universeId, name: "Frodo", type: "CHARACTER", boundary: { workId, unitNumber: "2" } };
}

type RelationshipReferences = {
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly relationshipTypeId: string;
  readonly workId: string;
};

function buildRelationshipInput(universeId: string, references: RelationshipReferences) {
  return {
    universeId,
    sourceEntityId: references.sourceEntityId,
    targetEntityId: references.targetEntityId,
    relationshipTypeId: references.relationshipTypeId,
    status: "CONFIRMED",
    boundary: { workId: references.workId, unitNumber: "2" },
  };
}

/** Creates a work of three units in a universe of the current session and returns its identifier. */
async function createOwnWork(universeId: string, title = "The Long Road"): Promise<string> {
  const creation = await createWorkAction({ ...buildWorkInput(universeId), title });
  if (!creation.ok) {
    throw new Error("The work of the test could not be created.");
  }
  return creation.value.work.id;
}

async function countStoredEntities(): Promise<number> {
  return readStoredRowsClient().entity.count();
}

async function countStoredFragments(): Promise<number> {
  return readStoredRowsClient().knowledgeEntry.count();
}

async function readStoredUnitLabel(unitId: string): Promise<string | undefined> {
  const storedUnit = await readStoredRowsClient().narrativeUnit.findUnique({ where: { id: unitId } });
  return storedUnit?.label;
}

type ActionUnderTest = {
  readonly label: string;
  readonly run: () => Promise<unknown>;
};

/** One call to each action with input whose shape is right. */
const EVERY_ACTION: readonly ActionUnderTest[] = [
  { label: "createWorkAction", run: () => createWorkAction(buildWorkInput(NONEXISTENT_UNIVERSE_ID)) },
  {
    label: "createEntityAction",
    run: () => createEntityAction(buildEntityInput(NONEXISTENT_UNIVERSE_ID, NONEXISTENT_UNIVERSE_ID)),
  },
  {
    label: "loadUniverseKnowledgeAction",
    run: () => loadUniverseKnowledgeAction({ universeId: NONEXISTENT_UNIVERSE_ID }),
  },
  {
    label: "createRelationshipAction",
    run: () =>
      createRelationshipAction(
        buildRelationshipInput(NONEXISTENT_UNIVERSE_ID, {
          sourceEntityId: NONEXISTENT_UNIVERSE_ID,
          targetEntityId: NONEXISTENT_ENTITY_ID,
          relationshipTypeId: NONEXISTENT_UNIVERSE_ID,
          workId: NONEXISTENT_UNIVERSE_ID,
        }),
      ),
  },
  {
    label: "loadEntityDetailsAction",
    run: () => loadEntityDetailsAction({ universeId: NONEXISTENT_UNIVERSE_ID, entityId: NONEXISTENT_ENTITY_ID }),
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

  it("loadUniverseKnowledgeAction lists no works and no entities for an own universe without them", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    expect(await loadUniverseKnowledgeAction({ universeId })).toEqual({
      ok: true,
      value: { works: [], entities: [], relationshipTypes: expect.any(Array) },
    });
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

describe("createEntityAction with a valid session (FR-4, FR-5, FR-6)", () => {
  it("stores an entity without a fragment at the chosen unit and lists it through the load action", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);

    const result = await createEntityAction({ ...buildEntityInput(universeId, workId), name: "  Frodo " });

    expect(result).toMatchObject({
      ok: true,
      value: { entity: { name: "Frodo", type: "CHARACTER" }, similarEntityName: null },
    });
    const [storedEntity] = await readStoredRowsClient().entity.findMany();
    expect(result.ok && result.value.entity.id).toBe(storedEntity?.id);
    expect(storedEntity).toMatchObject({ universeId, boundaryWorkId: workId, attributes: {} });
    expect(await readStoredUnitLabel(storedEntity?.boundaryUnitId ?? "")).toBe("2");
    expect(await countStoredFragments()).toBe(0);

    const load = await loadUniverseKnowledgeAction({ universeId });
    expect(load.ok && load.value.entities).toEqual([result.ok && result.value.entity]);
  });

  it("loadUniverseKnowledgeAction lists the entities in creation order", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);
    await createEntityAction({ ...buildEntityInput(universeId, workId), name: "First" });
    await createEntityAction({ ...buildEntityInput(universeId, workId), name: "Second", type: "LOCATION" });

    const load = await loadUniverseKnowledgeAction({ universeId });

    expect(load.ok && load.value.entities.map((entity) => [entity.name, entity.type])).toEqual([
      ["First", "CHARACTER"],
      ["Second", "LOCATION"],
    ]);
  });

  it("stores the first fragment with the entity, at the point of the entity when it brings none", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);

    await createEntityAction({
      ...buildEntityInput(universeId, workId),
      fragment: { content: " Carries the ring. ", status: "CONFIRMED" },
    });

    const [storedEntity] = await readStoredRowsClient().entity.findMany();
    const storedFragments = await readStoredRowsClient().knowledgeEntry.findMany();
    expect(storedFragments).toHaveLength(1);
    expect(storedFragments[0]).toMatchObject({
      content: "Carries the ring.",
      status: "CONFIRMED",
      entityId: storedEntity?.id,
      boundaryWorkId: workId,
      boundaryUnitId: storedEntity?.boundaryUnitId,
    });
  });

  it("stores the first fragment at its own point when it brings one", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);

    await createEntityAction({
      ...buildEntityInput(universeId, workId),
      fragment: { content: "Leaves the Shire.", status: "SPECULATION", boundary: { workId, unitNumber: " 03 " } },
    });

    const [storedFragment] = await readStoredRowsClient().knowledgeEntry.findMany();
    expect(await readStoredUnitLabel(storedFragment?.boundaryUnitId ?? "")).toBe("3");
  });

  it("drops a fragment with empty content before its other fields are read, whatever they hold, and stores the entity alone", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);

    const result = await createEntityAction({
      ...buildEntityInput(universeId, workId),
      fragment: { content: "   ", status: 42, boundary: { workId: 7, unitNumber: ["x"] } },
    });

    expect(result).toMatchObject({ ok: true, value: { entity: { name: "Frodo" } } });
    expect(await countStoredEntities()).toBe(1);
    expect(await countStoredFragments()).toBe(0);
  });

  it("reports every failing field together, keyed by its input path, and stores nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);

    const result = await createEntityAction({
      universeId,
      name: "",
      type: "EVENT",
      boundary: { workId, unitNumber: "1e3" },
      fragment: { content: "a".repeat(5001), status: "RUMOR", boundary: { workId: "bad", unitNumber: "+7" } },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[VALIDATION_ERROR_CODE],
        fieldErrors: {
          name: [{ code: "NAME_REQUIRED" }],
          type: [{ code: "TYPE_INVALID" }],
          "boundary.unitNumber": [{ code: "UNIT_NUMBER_INVALID" }],
          "fragment.content": [{ code: "CONTENT_TOO_LONG", maximumLength: 5000 }],
          "fragment.status": [{ code: "STATUS_INVALID" }],
          "fragment.boundary.workId": [{ code: "ID_INVALID" }],
          "fragment.boundary.unitNumber": [{ code: "UNIT_NUMBER_INVALID" }],
        },
      },
    });
    expect(await countStoredEntities()).toBe(0);
  });

  it("refuses a fragment without a status through a direct call and stores nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);

    const result = await createEntityAction({
      ...buildEntityInput(universeId, workId),
      fragment: { content: "A note." },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: VALIDATION_ERROR_CODE, fieldErrors: { "fragment.status": [{ code: "STATUS_INVALID" }] } },
    });
    expect(await countStoredEntities()).toBe(0);
  });

  it("reports a boundary that is not an object as a shape failure on that field", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    const result = await createEntityAction({ ...buildEntityInput(universeId, universeId), boundary: "chapter 2" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: VALIDATION_ERROR_CODE, fieldErrors: { boundary: [{ code: INVALID_INPUT_ISSUE_CODE }] } },
    });
    expect(await countStoredEntities()).toBe(0);
  });

  it("creates an entity with the name of an existing one of the same type and names the oldest in the notice", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);
    await createEntityAction({ ...buildEntityInput(universeId, workId), name: "Éowyn" });
    await createEntityAction({ ...buildEntityInput(universeId, workId), name: "EOWYN" });

    const sameType = await createEntityAction({ ...buildEntityInput(universeId, workId), name: " eowyn " });
    const otherType = await createEntityAction({
      ...buildEntityInput(universeId, workId),
      name: "Eowyn",
      type: "CONCEPT",
    });

    expect(sameType).toMatchObject({ ok: true, value: { similarEntityName: "Éowyn" } });
    expect(otherType).toMatchObject({ ok: true, value: { similarEntityName: null } });
    expect(await countStoredEntities()).toBe(4);
  });
});

describe("createEntityAction with another account's items, nonexistent ones and forged data (FR-8, NFR-2)", () => {
  it("answers the same not found for a universe of another account and a nonexistent one, storing nothing", async () => {
    const { anaSessionToken } = await signUpAnaThenBeto();
    const betoUniverseId = await createOwnUniverse("Beto's world");
    const betoWorkId = await createOwnWork(betoUniverseId);
    switchToSession(anaSessionToken);

    const foreignResult = await createEntityAction(buildEntityInput(betoUniverseId, betoWorkId));
    const nonexistentResult = await createEntityAction(buildEntityInput(NONEXISTENT_UNIVERSE_ID, betoWorkId));

    expect(foreignResult).toEqual(NOT_FOUND_RESULT);
    expect(nonexistentResult).toEqual(foreignResult);
    expect(JSON.stringify(foreignResult)).not.toContain(betoUniverseId);
    expect(await countStoredEntities()).toBe(0);
  });

  it("answers one and the same not found for every boundary that is not a unit of a work of the universe, storing nothing", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    switchToSession(betoSessionToken);
    const betoUniverseId = await createOwnUniverse("Beto's world");
    const betoWorkId = await createOwnWork(betoUniverseId);
    switchToSession(anaSessionToken);
    const anaUniverseId = await createOwnUniverse("Ana's world");
    const anaWorkId = await createOwnWork(anaUniverseId);
    const anaOtherUniverseId = await createOwnUniverse("Ana's other world");
    const anaOtherUniverseWorkId = await createOwnWork(anaOtherUniverseId);
    const badBoundaries = [
      { workId: betoWorkId, unitNumber: "1" },
      { workId: anaOtherUniverseWorkId, unitNumber: "1" },
      { workId: NONEXISTENT_UNIVERSE_ID, unitNumber: "1" },
      { workId: anaWorkId, unitNumber: "0" },
      { workId: anaWorkId, unitNumber: "4" },
      { workId: anaWorkId, unitNumber: "99999999999999999999" },
    ];

    const results: unknown[] = [];
    for (const badBoundary of badBoundaries) {
      results.push(await createEntityAction({ ...buildEntityInput(anaUniverseId, anaWorkId), boundary: badBoundary }));
      results.push(
        await createEntityAction({
          ...buildEntityInput(anaUniverseId, anaWorkId),
          fragment: { content: "A note.", status: "USER_NOTE", boundary: badBoundary },
        }),
      );
    }

    expect(results).toHaveLength(badBoundaries.length * 2);
    for (const result of results) {
      expect(result).toEqual(NOT_FOUND_RESULT);
    }
    expect(await countStoredEntities()).toBe(0);
    expect(await countStoredFragments()).toBe(0);
  });

  it("answers a malformed work identifier with the validation error on that field", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    const result = await createEntityAction(buildEntityInput(universeId, "not-an-identifier"));

    expect(result).toMatchObject({
      ok: false,
      error: { code: VALIDATION_ERROR_CODE, fieldErrors: { "boundary.workId": [{ code: "ID_INVALID" }] } },
    });
  });

  it("createEntityAction ignores a forged owner, attributes, a description and identifiers sent with the input", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    const betoUserId = (await readStoredRowsClient().user.findUniqueOrThrow({ where: { email: BETO_EMAIL } })).id;
    switchToSession(anaSessionToken);
    const anaUniverseId = await createOwnUniverse("Ana's world");
    switchToSession(betoSessionToken);
    const betoUniverseId = await createOwnUniverse("Beto's world");
    const betoWorkId = await createOwnWork(betoUniverseId);

    const result = await createEntityAction({
      ...buildEntityInput(betoUniverseId, betoWorkId),
      id: NONEXISTENT_UNIVERSE_ID,
      ownerId: anaUniverseId,
      userId: anaUniverseId,
      attributes: { power: 9000 },
      description: "A hobbit of the Shire.",
      normalizedName: "someone else",
      boundary: { workId: betoWorkId, unitNumber: "2", unitId: NONEXISTENT_UNIVERSE_ID },
      fragment: { content: "A note.", status: "USER_NOTE", universeId: anaUniverseId, entityId: NONEXISTENT_UNIVERSE_ID },
    });

    expect(result.ok && Object.keys(result.value.entity).sort()).toEqual(["createdAt", "id", "name", "type"]);
    expect(result.ok && result.value.entity.id).not.toBe(NONEXISTENT_UNIVERSE_ID);
    const storedEntities = await readStoredRowsClient().entity.findMany({ include: { universe: true } });
    expect(storedEntities).toHaveLength(1);
    expect(storedEntities[0]).toMatchObject({ attributes: {}, normalizedName: "frodo", universeId: betoUniverseId });
    expect(storedEntities[0]?.universe.ownerId).toBe(betoUserId);
    const storedFragments = await readStoredRowsClient().knowledgeEntry.findMany();
    expect(storedFragments.map((fragment) => [fragment.universeId, fragment.entityId])).toEqual([
      [betoUniverseId, storedEntities[0]?.id],
    ]);
  });

  it("two accounts never see each other's entities, and a name of the other account gives no notice", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    switchToSession(anaSessionToken);
    const anaUniverseId = await createOwnUniverse("Ana's world");
    const anaWorkId = await createOwnWork(anaUniverseId);
    await createEntityAction({ ...buildEntityInput(anaUniverseId, anaWorkId), name: "Gandalf" });
    switchToSession(betoSessionToken);
    const betoUniverseId = await createOwnUniverse("Beto's world");
    const betoWorkId = await createOwnWork(betoUniverseId);

    const betoCreation = await createEntityAction({ ...buildEntityInput(betoUniverseId, betoWorkId), name: "Gandalf" });
    const betoLoad = await loadUniverseKnowledgeAction({ universeId: betoUniverseId });
    switchToSession(anaSessionToken);
    const anaLoad = await loadUniverseKnowledgeAction({ universeId: anaUniverseId });

    const betoEntityIds = betoLoad.ok ? betoLoad.value.entities.map((entity) => entity.id) : [];
    const anaEntityIds = anaLoad.ok ? anaLoad.value.entities.map((entity) => entity.id) : [];
    expect(betoCreation).toMatchObject({ ok: true, value: { similarEntityName: null } });
    expect(betoEntityIds).toEqual([betoCreation.ok ? betoCreation.value.entity.id : "missing"]);
    expect(anaEntityIds).toHaveLength(1);
    expect(anaEntityIds).not.toContain(betoEntityIds[0]);
  });
});

describe("createEntityAction when the storage fails or the request comes from another site", () => {
  it("answers the generic infrastructure result with no internals, logs it once and stores nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();
    const workId = await createOwnWork(universeId);
    vi.spyOn(getPrismaClient().entity, "create").mockRejectedValue(
      new Error("connection to db-host-7 refused: insert into Entity"),
    );
    const loggedLines = silenceServerLog();

    const result = await createEntityAction(buildEntityInput(universeId, workId));

    expect(result).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/db-host-7|insert|stack|Entity/i);
    expect(loggedLines).toHaveLength(1);
    expect(await countStoredEntities()).toBe(0);
  });

  it.each(CROSS_SITE_REQUEST_EMULATIONS)(
    "rejects a request with $label, even with a valid session, and stores nothing",
    async ({ emulate }) => {
      await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
      const universeId = await createOwnUniverse();
      const workId = await createOwnWork(universeId);
      emulate();

      expect(await createEntityAction(buildEntityInput(universeId, workId))).toMatchObject({
        ok: false,
        error: { code: VALIDATION_ERROR_CODE, fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] } },
      });
      expect(await countStoredEntities()).toBe(0);
    },
  );
});

async function countStoredRelationships(): Promise<number> {
  return readStoredRowsClient().relationship.count();
}

/** Creates an entity at unit 2 of the work, in a universe of the current session, and returns its identifier. */
async function createOwnEntity(universeId: string, workId: string, name: string, fragmentContent = ""): Promise<string> {
  const creation = await createEntityAction({
    ...buildEntityInput(universeId, workId),
    name,
    fragment: { content: fragmentContent, status: "USER_NOTE" },
  });
  if (!creation.ok) {
    throw new Error("The entity of the test could not be created.");
  }
  return creation.value.entity.id;
}

/** The identifier of the type with that key in the catalog of a universe of the current session. */
async function findOwnRelationshipTypeId(universeId: string, relationshipTypeKey: string): Promise<string> {
  const load = await loadUniverseKnowledgeAction({ universeId });
  const relationshipType = load.ok
    ? load.value.relationshipTypes.find((candidate) => candidate.key === relationshipTypeKey)
    : undefined;
  if (relationshipType === undefined) {
    throw new Error(`The universe of the test has no type ${relationshipTypeKey}.`);
  }
  return relationshipType.id;
}

/** A universe of the current session with a work, Frodo (with a first fragment) and The Fellowship. */
async function prepareOwnRelationshipWorld(universeName = "Middle-earth") {
  const universeId = await createOwnUniverse(universeName);
  const workId = await createOwnWork(universeId);
  const frodoId = await createOwnEntity(universeId, workId, "Frodo", "Carries the ring.\nTo Mordor.");
  const fellowshipId = await createOwnEntity(universeId, workId, "The Fellowship");
  const memberOfTypeId = await findOwnRelationshipTypeId(universeId, "MEMBER_OF");
  const references: RelationshipReferences = {
    sourceEntityId: frodoId,
    targetEntityId: fellowshipId,
    relationshipTypeId: memberOfTypeId,
    workId,
  };
  return { universeId, workId, frodoId, fellowshipId, memberOfTypeId, references };
}

describe("createRelationshipAction and loadEntityDetailsAction with a valid session (FR-7, FR-10)", () => {
  it("stores one relationship that the details of each of its entities read with the right label", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const world = await prepareOwnRelationshipWorld();

    const creation = await createRelationshipAction(buildRelationshipInput(world.universeId, world.references));
    const frodoDetails = await loadEntityDetailsAction({ universeId: world.universeId, entityId: world.frodoId });
    const fellowshipDetails = await loadEntityDetailsAction({
      universeId: world.universeId,
      entityId: world.fellowshipId,
    });

    const relationshipId = creation.ok ? creation.value.relationship.id : "missing";
    expect(creation).toEqual({
      ok: true,
      value: { relationship: { id: relationshipId, sourceEntityId: world.frodoId, targetEntityId: world.fellowshipId } },
    });
    const point = { workId: world.workId, workTitle: "The Long Road", unitWording: "chapter", unitLabel: "2" };
    expect(frodoDetails).toEqual({
      ok: true,
      value: {
        entity: {
          id: world.frodoId,
          name: "Frodo",
          type: "CHARACTER",
          introducedAt: point,
          firstFragment: { content: "Carries the ring.\nTo Mordor.", status: "USER_NOTE", point },
          relationships: [
            {
              id: relationshipId,
              status: "CONFIRMED",
              point,
              subjectName: "Frodo",
              label: "member of",
              otherName: "The Fellowship",
            },
          ],
        },
      },
    });
    expect(fellowshipDetails).toMatchObject({
      ok: true,
      value: {
        entity: {
          firstFragment: null,
          relationships: [{ id: relationshipId, subjectName: "The Fellowship", label: "has member", otherName: "Frodo" }],
        },
      },
    });
    expect(await countStoredRelationships()).toBe(1);
  });

  it("loadUniverseKnowledgeAction lists the eight relationship types of the universe ordered by key", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    const load = await loadUniverseKnowledgeAction({ universeId });

    const relationshipTypes = load.ok ? load.value.relationshipTypes : [];
    expect(relationshipTypes.map((relationshipType) => relationshipType.key)).toEqual([
      "ALLY_OF",
      "ENEMY_OF",
      "LEADER_OF",
      "LOCATED_IN",
      "MEMBER_OF",
      "PARENT_OF",
      "POSSESSES",
      "SIBLING_OF",
    ]);
    expect(relationshipTypes.find((relationshipType) => relationshipType.key === "MEMBER_OF")).toEqual({
      id: expect.any(String),
      key: "MEMBER_OF",
      label: "member of",
      inverseLabel: "has member",
      isSymmetric: false,
    });
  });

  it("answers an entity related to itself with the business rule violation and stores nothing (FR-8)", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const world = await prepareOwnRelationshipWorld();

    const result = await createRelationshipAction(
      buildRelationshipInput(world.universeId, { ...world.references, targetEntityId: world.frodoId }),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: BUSINESS_RULE_VIOLATION_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[BUSINESS_RULE_VIOLATION_ERROR_CODE],
      },
    });
    expect(await countStoredRelationships()).toBe(0);
  });

  it("reports every failing field together, keyed by its input path, and stores nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const world = await prepareOwnRelationshipWorld();
    const result = await createRelationshipAction({
      ...buildRelationshipInput(world.universeId, { ...world.references, relationshipTypeId: "MEMBER_OF" }),
      status: undefined,
      boundary: { workId: world.workId, unitNumber: "7.0" },
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: VALIDATION_ERROR_CODE,
        fieldErrors: {
          relationshipTypeId: [{ code: "ID_INVALID" }],
          status: [{ code: "STATUS_INVALID" }],
          "boundary.unitNumber": [{ code: "UNIT_NUMBER_INVALID" }],
        },
      },
    });
    expect(await countStoredRelationships()).toBe(0);
  });

  it("reports a boundary that is not an object as a shape failure on that field", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const world = await prepareOwnRelationshipWorld();

    const result = await createRelationshipAction({
      ...buildRelationshipInput(world.universeId, world.references),
      boundary: "2",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: VALIDATION_ERROR_CODE, fieldErrors: { boundary: [{ code: INVALID_INPUT_ISSUE_CODE }] } },
    });
    expect(await countStoredRelationships()).toBe(0);
  });

  it("loadEntityDetailsAction answers a malformed entity identifier with the validation error on entityId", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const universeId = await createOwnUniverse();

    expect(await loadEntityDetailsAction({ universeId, entityId: "frodo" })).toMatchObject({
      ok: false,
      error: { code: VALIDATION_ERROR_CODE, fieldErrors: { entityId: [{ code: "ID_INVALID" }] } },
    });
  });
});

describe("createRelationshipAction and loadEntityDetailsAction with another account's items, nonexistent ones and forged data (FR-8, NFR-2)", () => {
  it("createRelationshipAction answers one and the same not found for a foreign or nonexistent universe and for every reference of another account or universe, storing nothing", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    switchToSession(betoSessionToken);
    const beto = await prepareOwnRelationshipWorld("Beto's world");
    switchToSession(anaSessionToken);
    const ana = await prepareOwnRelationshipWorld("Ana's world");
    const anaOther = await prepareOwnRelationshipWorld("Ana's other world");
    const badInputs = [
      buildRelationshipInput(beto.universeId, beto.references),
      buildRelationshipInput(NONEXISTENT_UNIVERSE_ID, ana.references),
      ...[beto, anaOther].flatMap((other) => [
        buildRelationshipInput(ana.universeId, { ...ana.references, sourceEntityId: other.frodoId }),
        buildRelationshipInput(ana.universeId, { ...ana.references, targetEntityId: other.fellowshipId }),
        buildRelationshipInput(ana.universeId, { ...ana.references, relationshipTypeId: other.memberOfTypeId }),
        buildRelationshipInput(ana.universeId, { ...ana.references, workId: other.workId }),
      ]),
      buildRelationshipInput(ana.universeId, { ...ana.references, sourceEntityId: NONEXISTENT_ENTITY_ID }),
      buildRelationshipInput(ana.universeId, { ...ana.references, relationshipTypeId: NONEXISTENT_ENTITY_ID }),
      buildRelationshipInput(ana.universeId, { ...ana.references, workId: NONEXISTENT_ENTITY_ID }),
      { ...buildRelationshipInput(ana.universeId, ana.references), boundary: { workId: ana.workId, unitNumber: "4" } },
    ];

    const results: unknown[] = [];
    for (const badInput of badInputs) {
      results.push(await createRelationshipAction(badInput));
    }

    expect(results).toHaveLength(badInputs.length);
    for (const result of results) {
      expect(result).toEqual(NOT_FOUND_RESULT);
    }
    expect(await countStoredRelationships()).toBe(0);
  });

  it("loadEntityDetailsAction answers the same not found for an entity of another account, of another own universe, a nonexistent one and a universe of another account", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    switchToSession(betoSessionToken);
    const beto = await prepareOwnRelationshipWorld("Beto's world");
    await createRelationshipAction(buildRelationshipInput(beto.universeId, beto.references));
    switchToSession(anaSessionToken);
    const ana = await prepareOwnRelationshipWorld("Ana's world");
    const anaOther = await prepareOwnRelationshipWorld("Ana's other world");

    const results = [
      await loadEntityDetailsAction({ universeId: ana.universeId, entityId: beto.frodoId }),
      await loadEntityDetailsAction({ universeId: beto.universeId, entityId: beto.frodoId }),
      await loadEntityDetailsAction({ universeId: ana.universeId, entityId: anaOther.frodoId }),
      await loadEntityDetailsAction({ universeId: ana.universeId, entityId: NONEXISTENT_ENTITY_ID }),
    ];

    for (const result of results) {
      expect(result).toEqual(NOT_FOUND_RESULT);
      expect(JSON.stringify(result)).not.toMatch(/Carries the ring|Frodo/);
    }
  });

  it("createRelationshipAction ignores a forged owner, a description and identifiers sent with the input", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    switchToSession(anaSessionToken);
    const anaUniverseId = await createOwnUniverse("Ana's world");
    switchToSession(betoSessionToken);
    const beto = await prepareOwnRelationshipWorld("Beto's world");

    const result = await createRelationshipAction({
      ...buildRelationshipInput(beto.universeId, beto.references),
      id: NONEXISTENT_ENTITY_ID,
      ownerId: anaUniverseId,
      userId: anaUniverseId,
      description: "Joined at Rivendell.",
      createdAt: "2020-01-01T00:00:00.000Z",
      boundary: { workId: beto.workId, unitNumber: "2", unitId: NONEXISTENT_ENTITY_ID },
    });

    expect(result.ok && Object.keys(result.value.relationship).sort()).toEqual([
      "id",
      "sourceEntityId",
      "targetEntityId",
    ]);
    const storedRelationships = await readStoredRowsClient().relationship.findMany();
    expect(storedRelationships).toHaveLength(1);
    expect(storedRelationships[0]).toMatchObject({ universeId: beto.universeId, status: "CONFIRMED" });
    expect(storedRelationships[0]?.id).not.toBe(NONEXISTENT_ENTITY_ID);
    expect(storedRelationships[0]?.createdAt.toISOString()).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("two accounts never see each other's relationships", async () => {
    const { anaSessionToken, betoSessionToken } = await signUpAnaThenBeto();
    switchToSession(anaSessionToken);
    const ana = await prepareOwnRelationshipWorld("Ana's world");
    switchToSession(betoSessionToken);
    const beto = await prepareOwnRelationshipWorld("Beto's world");
    await createRelationshipAction(buildRelationshipInput(beto.universeId, beto.references));
    await createRelationshipAction(buildRelationshipInput(beto.universeId, beto.references));

    const betoDetails = await loadEntityDetailsAction({ universeId: beto.universeId, entityId: beto.frodoId });
    switchToSession(anaSessionToken);
    const anaDetails = await loadEntityDetailsAction({ universeId: ana.universeId, entityId: ana.frodoId });

    expect(betoDetails.ok && betoDetails.value.entity.relationships).toHaveLength(2);
    expect(anaDetails.ok && anaDetails.value.entity.relationships).toEqual([]);
  });
});

describe("createRelationshipAction and loadEntityDetailsAction when the storage fails or the request comes from another site", () => {
  it("createRelationshipAction answers the generic infrastructure result with no internals, logs it once and stores nothing", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const world = await prepareOwnRelationshipWorld();
    vi.spyOn(getPrismaClient().relationship, "create").mockRejectedValue(
      new Error("connection to db-host-7 refused: insert into Relationship"),
    );
    const loggedLines = silenceServerLog();

    const result = await createRelationshipAction(buildRelationshipInput(world.universeId, world.references));

    expect(result).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/db-host-7|insert|stack|Relationship/i);
    expect(loggedLines).toHaveLength(1);
    expect(await countStoredRelationships()).toBe(0);
  });

  it("loadEntityDetailsAction answers the generic infrastructure result", async () => {
    await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
    const world = await prepareOwnRelationshipWorld();
    vi.spyOn(getPrismaClient().relationship, "findMany").mockRejectedValue(new Error("connection to db-host-7 refused"));
    silenceServerLog();

    expect(await loadEntityDetailsAction({ universeId: world.universeId, entityId: world.frodoId })).toEqual({
      ok: false,
      error: {
        code: INFRASTRUCTURE_ERROR_CODE,
        message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
      },
    });
  });

  it.each(CROSS_SITE_REQUEST_EMULATIONS)(
    "both actions reject a request with $label, even with a valid session, and store nothing",
    async ({ emulate }) => {
      await signUpThroughTheUseCase("Ana Torres", ANA_EMAIL);
      const world = await prepareOwnRelationshipWorld();
      emulate();

      const results = [
        await createRelationshipAction(buildRelationshipInput(world.universeId, world.references)),
        await loadEntityDetailsAction({ universeId: world.universeId, entityId: world.frodoId }),
      ];

      for (const result of results) {
        expect(result).toMatchObject({
          ok: false,
          error: { code: VALIDATION_ERROR_CODE, fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] } },
        });
      }
      expect(await countStoredRelationships()).toBe(0);
    },
  );
});
