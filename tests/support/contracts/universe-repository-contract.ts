import { describe, expect, it } from "vitest";
import type { RelationshipType } from "@/modules/universes/domain/relationship-type";
import type { RelationshipTypeRepository } from "@/modules/universes/domain/relationship-type-repository";
import type { RememberedUniverseRepository } from "@/modules/universes/domain/remembered-universe-repository";
import type { Universe } from "@/modules/universes/domain/universe";
import type { UniverseRepository } from "@/modules/universes/domain/universe-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { buildUniverse } from "../universe-repository-factories";
import { FIRST_OWNER_ID, SECOND_OWNER_ID } from "../universe-owners";

/** The three ports the universes module stores through, kept by one implementation. */
export type UniverseStorage = {
  readonly universeRepository: UniverseRepository;
  readonly rememberedUniverseRepository: RememberedUniverseRepository;
  readonly relationshipTypeRepository: RelationshipTypeRepository;
  /** Makes every following write of a relationship type fail, until `restoreRelationshipTypeWrites`. */
  readonly makeRelationshipTypeWritesFail: () => Promise<void>;
  readonly restoreRelationshipTypeWrites: () => Promise<void>;
};

/**
 * The eight predefined relationship types of spec 006 (FR-3), written here as literal values and
 * ordered by key as they are listed, so a wrong label in the seed constant or in the backfill of the
 * migration fails the tests.
 */
export const EXPECTED_PREDEFINED_RELATIONSHIP_TYPES = [
  { key: "ALLY_OF", label: "ally of", inverseLabel: "ally of", isSymmetric: true, isPredefined: true },
  { key: "ENEMY_OF", label: "enemy of", inverseLabel: "enemy of", isSymmetric: true, isPredefined: true },
  { key: "LEADER_OF", label: "leader of", inverseLabel: "led by", isSymmetric: false, isPredefined: true },
  { key: "LOCATED_IN", label: "located in", inverseLabel: "contains", isSymmetric: false, isPredefined: true },
  { key: "MEMBER_OF", label: "member of", inverseLabel: "has member", isSymmetric: false, isPredefined: true },
  { key: "PARENT_OF", label: "parent of", inverseLabel: "child of", isSymmetric: false, isPredefined: true },
  { key: "POSSESSES", label: "possesses", inverseLabel: "possessed by", isSymmetric: false, isPredefined: true },
  { key: "SIBLING_OF", label: "sibling of", inverseLabel: "sibling of", isSymmetric: true, isPredefined: true },
];

/** A type without the values the storage assigns, to compare it with the expected list. */
export function withoutStoredIdentifiers(relationshipType: RelationshipType) {
  return {
    key: relationshipType.key,
    label: relationshipType.label,
    inverseLabel: relationshipType.inverseLabel,
    isSymmetric: relationshipType.isSymmetric,
    isPredefined: relationshipType.isPredefined,
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

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

    describe("name and description update", () => {
      const editTime = new Date("2026-06-01T10:00:00.000Z");
      const nameAndDescriptionChange = {
        name: "Renamed universe",
        description: "A new description",
        updatedAt: editTime,
      };

      it("changes only the name, description and update time of an own universe and returns what a later read returns", async () => {
        const { universeRepository } = await createStorage([oldestUniverse, newestUniverse]);

        const updatedUniverse = await universeRepository.updateNameAndDescription(
          FIRST_OWNER_ID,
          newestUniverse.id,
          nameAndDescriptionChange,
        );

        const expectedUniverse: Universe = {
          ...newestUniverse,
          name: "Renamed universe",
          description: "A new description",
          updatedAt: editTime,
        };
        expect(updatedUniverse).toEqual(expectedUniverse);
        expect(await universeRepository.findOwnedById(FIRST_OWNER_ID, newestUniverse.id)).toEqual(
          expectedUniverse,
        );
      });

      it("clears the description when the change has none", async () => {
        const { universeRepository } = await createStorage([newestUniverse]);

        const updatedUniverse = await universeRepository.updateNameAndDescription(
          FIRST_OWNER_ID,
          newestUniverse.id,
          { name: newestUniverse.name, description: null, updatedAt: editTime },
        );

        expect(updatedUniverse?.description).toBeNull();
        expect(
          (await universeRepository.findOwnedById(FIRST_OWNER_ID, newestUniverse.id))?.description,
        ).toBeNull();
      });

      it("does not change the other universes of the owner or of another owner", async () => {
        const { universeRepository } = await createStorage([
          oldestUniverse,
          newestUniverse,
          otherOwnerUniverse,
        ]);

        await universeRepository.updateNameAndDescription(
          FIRST_OWNER_ID,
          newestUniverse.id,
          nameAndDescriptionChange,
        );

        expect((await universeRepository.findAllOwnedBy(FIRST_OWNER_ID))[0]).toEqual(oldestUniverse);
        expect(await universeRepository.findAllOwnedBy(SECOND_OWNER_ID)).toEqual([
          otherOwnerUniverse,
        ]);
      });

      it("keeps the relationship types of the universe as they were", async () => {
        const { universeRepository, relationshipTypeRepository } = await createStorage([
          newestUniverse,
        ]);
        const typesBefore = await relationshipTypeRepository.findAllInOwnedUniverse(
          FIRST_OWNER_ID,
          newestUniverse.id,
        );

        await universeRepository.updateNameAndDescription(
          FIRST_OWNER_ID,
          newestUniverse.id,
          nameAndDescriptionChange,
        );

        expect(
          await relationshipTypeRepository.findAllInOwnedUniverse(FIRST_OWNER_ID, newestUniverse.id),
        ).toEqual(typesBefore);
      });

      it("answers null for a universe of another owner, changing nothing", async () => {
        const { universeRepository } = await createStorage([oldestUniverse, otherOwnerUniverse]);

        expect(
          await universeRepository.updateNameAndDescription(
            FIRST_OWNER_ID,
            otherOwnerUniverse.id,
            nameAndDescriptionChange,
          ),
        ).toBeNull();
        expect(await universeRepository.findAllOwnedBy(SECOND_OWNER_ID)).toEqual([
          otherOwnerUniverse,
        ]);
        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([oldestUniverse]);
      });

      it("answers null for a universe that does not exist, changing nothing", async () => {
        const { universeRepository } = await createStorage([oldestUniverse, otherOwnerUniverse]);

        expect(
          await universeRepository.updateNameAndDescription(
            FIRST_OWNER_ID,
            "00000000-0000-4000-8000-0000000000ff",
            nameAndDescriptionChange,
          ),
        ).toBeNull();
        expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([oldestUniverse]);
        expect(await universeRepository.findAllOwnedBy(SECOND_OWNER_ID)).toEqual([
          otherOwnerUniverse,
        ]);
      });

      it("does not let the caller alter the stored universe through the change or the returned universe", async () => {
        const { universeRepository } = await createStorage([oldestUniverse]);
        const changeWithOwnDate = { ...nameAndDescriptionChange, updatedAt: new Date(editTime) };

        const updatedUniverse = await universeRepository.updateNameAndDescription(
          FIRST_OWNER_ID,
          oldestUniverse.id,
          changeWithOwnDate,
        );
        changeWithOwnDate.updatedAt.setUTCFullYear(1999);
        updatedUniverse?.updatedAt.setUTCFullYear(1999);
        updatedUniverse?.createdAt.setUTCFullYear(1999);

        expect(await universeRepository.findOwnedById(FIRST_OWNER_ID, oldestUniverse.id)).toEqual({
          ...oldestUniverse,
          name: "Renamed universe",
          description: "A new description",
          updatedAt: editTime,
        });
      });
    });

    describe("relationship types", () => {
      it("stores an added universe with exactly the eight predefined types, their labels and symmetric flags", async () => {
        const { universeRepository, relationshipTypeRepository } = await createStorage();

        await universeRepository.add(newestUniverse);

        const storedTypes = await relationshipTypeRepository.findAllInOwnedUniverse(
          FIRST_OWNER_ID,
          newestUniverse.id,
        );
        expect(storedTypes.map(withoutStoredIdentifiers)).toEqual(EXPECTED_PREDEFINED_RELATIONSHIP_TYPES);
        expect(storedTypes.every((storedType) => storedType.universeId === newestUniverse.id)).toBe(true);
        expect(storedTypes.every((storedType) => UUID_PATTERN.test(storedType.id))).toBe(true);
        expect(new Set(storedTypes.map((storedType) => storedType.id)).size).toBe(8);
      });

      it("gives every universe its own eight types and never a second copy", async () => {
        const { universeRepository, relationshipTypeRepository } = await createStorage([oldestUniverse]);

        await universeRepository.add(newestUniverse);

        const typesOfOldest = await relationshipTypeRepository.findAllInOwnedUniverse(
          FIRST_OWNER_ID,
          oldestUniverse.id,
        );
        const typesOfNewest = await relationshipTypeRepository.findAllInOwnedUniverse(
          FIRST_OWNER_ID,
          newestUniverse.id,
        );
        expect(typesOfOldest.map(withoutStoredIdentifiers)).toEqual(EXPECTED_PREDEFINED_RELATIONSHIP_TYPES);
        expect(typesOfNewest.map(withoutStoredIdentifiers)).toEqual(EXPECTED_PREDEFINED_RELATIONSHIP_TYPES);
        const identifiersOfOldest = new Set(typesOfOldest.map((storedType) => storedType.id));
        expect(typesOfNewest.some((storedType) => identifiersOfOldest.has(storedType.id))).toBe(false);
      });

      it("never lists the types of a universe of another owner, which looks the same as a nonexistent one", async () => {
        const { relationshipTypeRepository } = await createStorage([oldestUniverse, otherOwnerUniverse]);

        expect(
          await relationshipTypeRepository.findAllInOwnedUniverse(FIRST_OWNER_ID, otherOwnerUniverse.id),
        ).toEqual([]);
        expect(
          await relationshipTypeRepository.findAllInOwnedUniverse(
            FIRST_OWNER_ID,
            "00000000-0000-4000-8000-0000000000ff",
          ),
        ).toEqual([]);
        expect(
          await relationshipTypeRepository.findAllInOwnedUniverse(SECOND_OWNER_ID, oldestUniverse.id),
        ).toEqual([]);
        expect(
          (
            await relationshipTypeRepository.findAllInOwnedUniverse(SECOND_OWNER_ID, otherOwnerUniverse.id)
          ).map(withoutStoredIdentifiers),
        ).toEqual(EXPECTED_PREDEFINED_RELATIONSHIP_TYPES);
      });

      it("stores neither the universe nor any of its types when the types cannot be stored", async () => {
        const storage = await createStorage([oldestUniverse]);

        await storage.makeRelationshipTypeWritesFail();
        let failure: unknown;
        try {
          failure = await storage.universeRepository.add(newestUniverse).catch((error: unknown) => error);
        } finally {
          await storage.restoreRelationshipTypeWrites();
        }

        expect(failure).toBeInstanceOf(InfrastructureError);
        expect(await storage.universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([oldestUniverse]);
        expect(
          await storage.relationshipTypeRepository.findAllInOwnedUniverse(FIRST_OWNER_ID, newestUniverse.id),
        ).toEqual([]);
        expect(
          await storage.relationshipTypeRepository.findAllInOwnedUniverse(FIRST_OWNER_ID, oldestUniverse.id),
        ).toHaveLength(8);
      });

      it("stores the universe with its eight types when it is added again after a failed attempt", async () => {
        const storage = await createStorage();

        await storage.makeRelationshipTypeWritesFail();
        try {
          await storage.universeRepository.add(newestUniverse).catch(() => undefined);
        } finally {
          await storage.restoreRelationshipTypeWrites();
        }
        await storage.universeRepository.add(newestUniverse);

        expect(await storage.universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([newestUniverse]);
        expect(
          (
            await storage.relationshipTypeRepository.findAllInOwnedUniverse(FIRST_OWNER_ID, newestUniverse.id)
          ).map(withoutStoredIdentifiers),
        ).toEqual(EXPECTED_PREDEFINED_RELATIONSHIP_TYPES);
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
