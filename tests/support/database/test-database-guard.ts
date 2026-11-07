const LOCAL_HOST_NAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const DEFAULT_POSTGRES_PORT = "5432";
// Identifiers cannot be bound as parameters, so the name is also what makes quoting it in
// `CREATE DATABASE` safe: letters, digits and underscores only.
const SAFE_DATABASE_NAME_PATTERN = /^[A-Za-z0-9_]+$/;
const TEST_DATABASE_NAME_SUFFIX = "_test";
const TEST_DATABASE_NAME_PREFIX = "lorekeeper_test";
// Query parameters that move the connection somewhere else than the host, port and database written
// in the URL itself. The `pg` driver (pg-connection-string) lets `?host=` and `?port=` win over the
// authority part of the URL, and other tools read `hostaddr`, `dbname` and `database` the same way.
const LOCATION_OVERRIDING_QUERY_PARAMETERS = new Set(["host", "hostaddr", "port", "dbname", "database"]);

type DatabaseLocation = {
  readonly host: string;
  readonly port: string;
  readonly databaseName: string;
};

/**
 * Checks that the address in `TEST_DATABASE_URL` points at a database the tests may empty, and
 * returns the database name. The tests delete every user, so the address is refused unless:
 * - it has no query string at all (`?host=other` would send the connection somewhere else than the
 *   host the guard checked, and no test database needs connection parameters);
 * - the host is this machine (`localhost`, `127.0.0.1` or `::1`);
 * - the name ends with `_test` or starts with `lorekeeper_test` (letters, digits, underscores);
 * - it is not the same database (host, port and name) as `developmentDatabaseUrl`, when given. That
 *   comparison is refused too when `DATABASE_URL` overrides its host, port or database name in the
 *   query string, because then its real location is not the one written in the URL.
 *
 * Every error names only the variable and the rule, never an address, a user or a password.
 */
export function readSafeTestDatabaseName(
  testDatabaseUrl: string,
  developmentDatabaseUrl?: string,
): string {
  const parsedTestUrl = parseDatabaseUrl(testDatabaseUrl, "TEST_DATABASE_URL");
  if (parsedTestUrl.search !== "") {
    throw new Error(
      "TEST_DATABASE_URL must not have a query string: parameters such as host, port or user can send the connection somewhere else.",
    );
  }
  const testDatabase = readDatabaseLocation(parsedTestUrl, "TEST_DATABASE_URL");

  if (!LOCAL_HOST_NAMES.has(testDatabase.host)) {
    throw new Error("The host in TEST_DATABASE_URL must be this machine (localhost, 127.0.0.1 or ::1).");
  }
  if (!looksLikeTestDatabaseName(testDatabase.databaseName)) {
    throw new Error(
      `The database name in TEST_DATABASE_URL must end with "${TEST_DATABASE_NAME_SUFFIX}" or start with "${TEST_DATABASE_NAME_PREFIX}" (letters, digits and underscores only).`,
    );
  }
  if (developmentDatabaseUrl) {
    const parsedDevelopmentUrl = parseDatabaseUrl(developmentDatabaseUrl, "DATABASE_URL");
    if (overridesItsLocationInTheQuery(parsedDevelopmentUrl)) {
      throw new Error(
        "DATABASE_URL has host, hostaddr, port, dbname or database in its query string, so it cannot be compared safely with TEST_DATABASE_URL. Write them in the URL itself.",
      );
    }
    const developmentDatabase = readDatabaseLocation(parsedDevelopmentUrl, "DATABASE_URL");
    if (isSameDatabase(testDatabase, developmentDatabase)) {
      throw new Error("TEST_DATABASE_URL points at the same database as DATABASE_URL.");
    }
  }
  return testDatabase.databaseName;
}

function looksLikeTestDatabaseName(databaseName: string): boolean {
  if (!SAFE_DATABASE_NAME_PATTERN.test(databaseName)) {
    return false;
  }
  const lowerCaseName = databaseName.toLowerCase();
  return (
    lowerCaseName.endsWith(TEST_DATABASE_NAME_SUFFIX) || lowerCaseName.startsWith(TEST_DATABASE_NAME_PREFIX)
  );
}

function parseDatabaseUrl(databaseUrl: string, variableName: string): URL {
  try {
    return new URL(databaseUrl);
  } catch {
    throw new Error(`${variableName} is not a valid URL.`);
  }
}

function overridesItsLocationInTheQuery(parsedUrl: URL): boolean {
  return [...parsedUrl.searchParams.keys()].some((parameterName) =>
    LOCATION_OVERRIDING_QUERY_PARAMETERS.has(parameterName.toLowerCase()),
  );
}

function readDatabaseLocation(parsedUrl: URL, variableName: string): DatabaseLocation {
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
  } catch {
    throw new Error(`The database name in ${variableName} is not valid.`);
  }
  return {
    host: parsedUrl.hostname.toLowerCase(),
    port: parsedUrl.port || DEFAULT_POSTGRES_PORT,
    databaseName,
  };
}

function isSameDatabase(first: DatabaseLocation, second: DatabaseLocation): boolean {
  return (
    isSameHost(first.host, second.host) &&
    first.port === second.port &&
    first.databaseName === second.databaseName
  );
}

// `localhost`, `127.0.0.1` and `::1` are the same machine, so they are the same host.
function isSameHost(firstHost: string, secondHost: string): boolean {
  if (LOCAL_HOST_NAMES.has(firstHost) && LOCAL_HOST_NAMES.has(secondHost)) {
    return true;
  }
  return firstHost === secondHost;
}
