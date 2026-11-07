// Values the "database" test project hands to its tests (see vitest.config.mts and global-setup.ts).
declare module "vitest" {
  export interface ProvidedContext {
    /** Address of the test database, or undefined when `TEST_DATABASE_URL` is not set. */
    testDatabaseUrl: string | undefined;
    /** Why the test database could not be prepared, or undefined when it is ready. */
    testDatabaseSetupError: string | undefined;
  }
}

export {};
