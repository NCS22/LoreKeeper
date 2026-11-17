import { describe, expect, it } from "vitest";
import type { RememberedUniverseRepository } from "@/modules/universes/domain/remembered-universe-repository";
import type { Universe } from "@/modules/universes/domain/universe";
import type { UniverseRepository } from "@/modules/universes/domain/universe-repository";
import { buildUniverse } from "../universe-repository-factories";
import { FIRST_OWNER_ID, SECOND_OWNER_ID } from "../universe-owners";

/** The two ports the universes module stores through, kept by one implementation. */
export type UniverseStorage = {
  readonly universeRepository: UniverseRepository;
  readonly rememberedUniverseRepository: RememberedUniverseRepository;
};

/** Builds an empty storage, optionally holding some universes already. */
export type UniverseStorageFactory = (
  startingUniverses?: readonly Universe[],
) => Promise<UniverseStorage>;

/**
 * The scenarios every storage of universes must satisfy, the fake and PostgreSQL alike
 * (NFR-1): the owner scope, the order, and the remembered universe.
 */
export function describeUniverseStorageContract(
  description: string,
  createStorage: UniverseStorageFactory,
): void {
  describe(`universe storage contract: ${description}`, () => {
    const oldestUniverse = buildUniverse({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Oldest universe",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    const newestUniverse = buildUniverse({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Newest universe",
      description: "Line one\nLine two",
      mode: "AUTHOR",
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    });
    const otherOwnerUniverse = buildUniverse({
      id: "00000000-0000-4000-8000-000000000003",
      ownerId: SECOND_OWNER_ID,
      name: "Other owner universe",
    });

    describe("universes", () => {
      it("lists nothing when the owner has no universes", async () => {
        const { universeRepository } = await createStorage();

        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([]);
      });

      it("lists the owner's universes oldest first, whatever the order they were stored in", async () => {
        const { universeRepository } = await createStorage([newestUniverse, oldestUniverse]);

        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([
          oldestUniverse,
          newestUniverse,
        ]);
      });

      it("orders universes created at the same instant by identifier ascending", async () => {
        const sameInstant = new Date("2026-03-01T10:00:00.000Z");
        const lowerIdentifier = buildUniverse({
          id: "00000000-0000-4000-8000-0000000000aa",
          createdAt: sameInstant,
          updatedAt: sameInstant,
        });
        const higherIdentifier = buildUniverse({
          id: "00000000-0000-4000-8000-0000000000bb",
          createdAt: sameInstant,
          updatedAt: sameInstant,
        });
        const { universeRepository } = await createStorage([higherIdentifier, lowerIdentifier]);

        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([
          lowerIdentifier,
          higherIdentifier,
        ]);
      });

      it("returns every field of an added universe unchanged", async () => {
        const { universeRepository } = await createStorage();

        await universeRepository.add(newestUniverse);

        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([newestUniverse]);
      });

      it("does not change the other universes when one is added", async () => {
        const { universeRepository } = await createStorage([oldestUniverse]);

        await universeRepository.add(newestUniverse);

        expect((await universeRepository.findAllOwnedBy(FIRST_OWNER_ID))[0]).toEqual(
          oldestUniverse,
        );
      });

      it("never lists the universes of another owner", async () => {
        const { universeRepository } = await createStorage([oldestUniverse, otherOwnerUniverse]);

        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([oldestUniverse]);
        expect(await universeRepository.findAllOwnedBy(SECOND_OWNER_ID)).toEqual([
          otherOwnerUniverse,
        ]);
      });

      it("finds an own universe by identifier", async () => {
        const { universeRepository } = await createStorage([oldestUniverse, newestUniverse]);

        expect(await universeRepository.findOwnedById(FIRST_OWNER_ID, newestUniverse.id)).toEqual(
          newestUniverse,
        );
      });

      it("answers null for a universe of another owner and for one that does not exist alike", async () => {
        const { universeRepository } = await createStorage([otherOwnerUniverse]);

        expect(
          await universeRepository.findOwnedById(FIRST_OWNER_ID, otherOwnerUniverse.id),
        ).toBeNull();
        expect(
          await universeRepository.findOwnedById(
            FIRST_OWNER_ID,
            "00000000-0000-4000-8000-0000000000ff",
          ),
        ).toBeNull();
      });

      it("does not let a returned date alter the stored universes", async () => {
        const { universeRepository } = await createStorage([oldestUniverse]);

        const [returnedUniverse] = await universeRepository.findAllOwnedBy(FIRST_OWNER_ID);
        returnedUniverse?.createdAt.setUTCFullYear(1999);
        returnedUniverse?.updatedAt.setUTCFullYear(1999);

        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([oldestUniverse]);
      });

      it("does not let the caller alter a stored universe through the object it added", async () => {
        const { universeRepository } = await createStorage();
        const universeToAdd = buildUniverse();

        await universeRepository.add(universeToAdd);
        universeToAdd.createdAt.setUTCFullYear(1999);

        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([buildUniverse()]);
      });
    });

    describe("remembered universe", () => {
      it("is none until one is saved", async () => {
        const { rememberedUniverseRepository } = await createStorage();

        expect(await rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBeNull();
      });

      it("returns the saved universe, the last write winning", async () => {
        const { rememberedUniverseRepository } = await createStorage([
          oldestUniverse,
          newestUniverse,
        ]);

        await rememberedUniverseRepository.saveRememberedUniverse(FIRST_OWNER_ID, oldestUniverse.id);
        await rememberedUniverseRepository.saveRememberedUniverse(FIRST_OWNER_ID, newestUniverse.id);

        expect(await rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBe(
          newestUniverse.id,
        );
      });

      it("never crosses to another owner", async () => {
        const { rememberedUniverseRepository } = await createStorage([
          oldestUniverse,
          otherOwnerUniverse,
        ]);

        await rememberedUniverseRepository.saveRememberedUniverse(FIRST_OWNER_ID, oldestUniverse.id);
        await rememberedUniverseRepository.saveRememberedUniverse(
          SECOND_OWNER_ID,
          otherOwnerUniverse.id,
        );

        expect(await rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBe(
          oldestUniverse.id,
        );
        expect(await rememberedUniverseRepository.findRememberedUniverseId(SECOND_OWNER_ID)).toBe(
          otherOwnerUniverse.id,
        );
      });
    });
  });
}
