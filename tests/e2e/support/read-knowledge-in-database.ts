import { withTestDatabaseClient } from "./with-test-database-client";

// What the test database holds about the entities of a universe and their first fragments, read
// outside the application, so a browser test can prove which points were stored (spec 006, FR-4,
// FR-5) before the details panel shows them. Test-only.

/** A point as stored: the title of its work and the label of its unit ("7"). */
export type StoredPoint = {
  readonly workTitle: string;
  readonly unitLabel: string;
};

export type StoredEntityWithFragments = {
  readonly name: string;
  readonly type: string;
  readonly introducedAt: StoredPoint;
  readonly fragments: readonly {
    readonly content: string;
    readonly status: string;
    readonly revealedAt: StoredPoint;
  }[];
};

type EntityRow = { id: string; name: string; type: string; workTitle: string; unitLabel: string };
type FragmentRow = { entityId: string; content: string; status: string; workTitle: string; unitLabel: string };

/** Every entity of the universe, oldest first, with each of its fragments and the points they were stored at. */
export async function readEntitiesOfUniverseInDatabase(universeId: string): Promise<StoredEntityWithFragments[]> {
  return withTestDatabaseClient(async (client) => {
    const entityRows = await client.query<EntityRow>(
      `SELECT e."id", e."name", e."type", w."title" AS "workTitle", u."label" AS "unitLabel"
       FROM "Entity" e
       JOIN "Work" w ON w."id" = e."boundaryWorkId"
       JOIN "NarrativeUnit" u ON u."id" = e."boundaryUnitId"
       WHERE e."universeId" = $1
       ORDER BY e."createdAt", e."id"`,
      [universeId],
    );
    const fragmentRows = await client.query<FragmentRow>(
      `SELECT k."entityId", k."content", k."status", w."title" AS "workTitle", u."label" AS "unitLabel"
       FROM "KnowledgeEntry" k
       JOIN "Work" w ON w."id" = k."boundaryWorkId"
       JOIN "NarrativeUnit" u ON u."id" = k."boundaryUnitId"
       WHERE k."universeId" = $1
       ORDER BY k."createdAt", k."id"`,
      [universeId],
    );

    return entityRows.rows.map((entityRow) => ({
      name: entityRow.name,
      type: entityRow.type,
      introducedAt: { workTitle: entityRow.workTitle, unitLabel: entityRow.unitLabel },
      fragments: fragmentRows.rows
        .filter((fragmentRow) => fragmentRow.entityId === entityRow.id)
        .map((fragmentRow) => ({
          content: fragmentRow.content,
          status: fragmentRow.status,
          revealedAt: { workTitle: fragmentRow.workTitle, unitLabel: fragmentRow.unitLabel },
        })),
    }));
  });
}
