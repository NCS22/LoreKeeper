import { PREDEFINED_RELATIONSHIP_TYPES } from "../../../src/modules/universes/domain/predefined-relationship-types";
import { withTestDatabaseClient } from "./with-test-database-client";

// Universes written straight into the test database, as the application's creation would store them
// (with their eight predefined relationship types, spec 006 FR-3), so a test that is not about creating a universe (or that needs many of them) starts quickly. They
// stand for data that exists before the person opens the page. Test-only; the application has no
// knowledge of them (plan D12).

export type SeededUniverseDescription = {
  readonly name: string;
  readonly description?: string | null;
  readonly mode?: "READER" | "AUTHOR";
};

export type SeededUniverse = {
  readonly id: string;
  readonly name: string;
};

const ONE_SECOND_IN_MILLISECONDS = 1_000;

/**
 * Stores the universes for the account with this (comparable) email, oldest first: each one is created
 * one second after the one before it, all in the past, so the creation order is exactly the order of
 * the list given, each with the eight predefined relationship types. Nothing is remembered for the
 * account. Returns them in the same order.
 */
export async function seedUniversesInDatabase(
  accountEmail: string,
  universes: readonly SeededUniverseDescription[],
): Promise<SeededUniverse[]> {
  const firstCreationTime = Date.now() - (universes.length + 1) * ONE_SECOND_IN_MILLISECONDS;
  return withTestDatabaseClient(async (client) => {
    const owner = await client.query<{ id: string }>('SELECT "id" FROM "User" WHERE "email" = $1', [accountEmail]);
    if (owner.rows.length !== 1) {
      throw new Error("The account to seed universes for does not exist in the test database.");
    }
    const ownerId = owner.rows[0].id;

    const seededUniverses: SeededUniverse[] = [];
    for (const [position, universe] of universes.entries()) {
      const creationTime = new Date(firstCreationTime + position * ONE_SECOND_IN_MILLISECONDS);
      const insertedUniverse = await client.query<{ id: string }>(
        `INSERT INTO "Universe" ("ownerId", "name", "description", "mode", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4::"UniverseMode", $5, $5) RETURNING "id"`,
        [ownerId, universe.name, universe.description ?? null, universe.mode ?? "READER", creationTime],
      );
      const universeId = insertedUniverse.rows[0].id;
      for (const predefinedType of PREDEFINED_RELATIONSHIP_TYPES) {
        await client.query(
          `INSERT INTO "RelationshipType"
             ("universeId", "key", "label", "inverseLabel", "isSymmetric", "isPredefined", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, true, $6, $6)`,
          [universeId, predefinedType.key, predefinedType.label, predefinedType.inverseLabel, predefinedType.isSymmetric, creationTime],
        );
      }
      seededUniverses.push({ id: universeId, name: universe.name });
    }
    return seededUniverses;
  });
}
