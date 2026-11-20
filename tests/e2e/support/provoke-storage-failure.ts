import { randomUUID } from "node:crypto";
import { readAccountIdInDatabase } from "./read-universes-in-database";
import { withTestDatabaseClient } from "./with-test-database-client";

// Failures of the stored universes are provoked outside the application (spec 003 D10, spec 004 D12):
// the test connects to the TEST database only (`withTestDatabaseClient` refuses any other address),
// installs a trigger on `Universe` or `RememberedUniverse` that fails, or sleeps, only for the rows of
// the account of that test, and removes it afterwards. The global setup drops any left over. Nothing
// is added to the application or to the migrations, so nothing exists in a production configuration.

/** Every function and trigger this file creates starts with this text, so leftovers can be found. */
export const STORAGE_FAILURE_OBJECT_PREFIX = "e2e_storage_failure_";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type StorageFailureBehavior =
  // The write is refused with a database error.
  | { readonly kind: "fail" }
  // The write waits this many real seconds and then goes through: an answer that arrives very late.
  // The sleep is bounded because removing a trigger waits for the writes that are still running.
  | { readonly kind: "sleep"; readonly seconds: number };

export type StorageFailureOptions = {
  readonly accountEmail: string;
  readonly table: "Universe" | "RememberedUniverse";
  readonly behavior: StorageFailureBehavior;
};

export type InstalledStorageFailure = {
  /** Removes the trigger and its function. Safe to call more than once. */
  readonly remove: () => Promise<void>;
};

/** The condition on the new row that limits the trigger to the account of the test. */
function buildAccountCondition(table: StorageFailureOptions["table"], accountId: string): string {
  const ownerColumn = table === "Universe" ? "ownerId" : "userId";
  return `NEW."${ownerColumn}" = '${accountId}'`;
}

function buildTriggerFunctionBody(behavior: StorageFailureBehavior): string {
  if (behavior.kind === "fail") {
    return "BEGIN RAISE EXCEPTION 'storage failure provoked by an end-to-end test'; END;";
  }
  if (!Number.isFinite(behavior.seconds) || behavior.seconds <= 0 || behavior.seconds > 60) {
    throw new Error("A sleeping storage failure waits between 0 and 60 seconds.");
  }
  return `BEGIN PERFORM pg_sleep(${behavior.seconds}); RETURN NEW; END;`;
}

/** Installs the trigger for the account of the test; the caller removes it in a `finally` block. */
export async function provokeStorageFailure(options: StorageFailureOptions): Promise<InstalledStorageFailure> {
  const accountId = await readAccountIdInDatabase(options.accountEmail);
  // The value goes into the trigger's `WHEN` clause, which cannot take parameters: it must be a plain uuid.
  if (!UUID_PATTERN.test(accountId)) {
    throw new Error("The account identifier is not a uuid.");
  }
  const objectName = `${STORAGE_FAILURE_OBJECT_PREFIX}${randomUUID().replaceAll("-", "")}`;
  const triggerEvents = options.table === "Universe" ? "INSERT" : "INSERT OR UPDATE";

  await withTestDatabaseClient(async (client) => {
    await client.query(
      `CREATE FUNCTION ${objectName}() RETURNS trigger LANGUAGE plpgsql AS $body$ ${buildTriggerFunctionBody(options.behavior)} $body$`,
    );
    await client.query(
      `CREATE TRIGGER ${objectName} BEFORE ${triggerEvents} ON "${options.table}"
       FOR EACH ROW WHEN (${buildAccountCondition(options.table, accountId)})
       EXECUTE FUNCTION ${objectName}()`,
    );
  });

  return {
    remove: async () => {
      await withTestDatabaseClient(async (client) => {
        // Dropping the function with CASCADE drops the trigger that uses it.
        await client.query(`DROP FUNCTION IF EXISTS ${objectName}() CASCADE`);
      });
    },
  };
}

/** Drops every storage failure left over by a test that did not finish; the global setup runs it. */
export async function dropLeftoverStorageFailuresInDatabase(): Promise<void> {
  await withTestDatabaseClient(async (client) => {
    const leftovers = await client.query<{ functionName: string }>(
      `SELECT "proname" AS "functionName" FROM "pg_proc"
       WHERE "proname" LIKE $1 AND "pronamespace" = 'public'::regnamespace`,
      [`${STORAGE_FAILURE_OBJECT_PREFIX}%`],
    );
    for (const leftover of leftovers.rows) {
      // The name came from the database and starts with the prefix; quote it anyway.
      await client.query(`DROP FUNCTION IF EXISTS "${leftover.functionName.replaceAll('"', '""')}"() CASCADE`);
    }
  });
}
