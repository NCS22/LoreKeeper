// Where the two test servers of `playwright.config.ts` listen, and a pattern for the calls a page
// makes to its own address. Kept in one place so the specs do not repeat addresses.

/** The server connected to the test database (`baseURL` of every test). */
export const HEALTHY_SERVER_ADDRESS = "http://localhost:3100";

/** The server whose data store cannot be reached. */
export const UNREACHABLE_DATA_SERVER_ADDRESS = "http://localhost:3101";

/** The Server Action calls that the workspace root makes (a sign-out from the menu is one). */
export const WORKSPACE_ROOT_ACTION_PATTERN = /^http:\/\/localhost:3100\/(\?.*)?$/;
