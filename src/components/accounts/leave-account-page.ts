/**
 * Leaves the page for `address` with a new document, replacing the current history entry. A new
 * document is what gives the clean start of the workspace (FR-32), keeps the form out of the
 * history (FR-30) and makes the browser ask the server again for the next page (FR-29). A client
 * navigation would keep in-memory state alive (specs/003-account-screens/plan.md, D6).
 *
 * The address is always one already checked on the server (the return destination, the workspace
 * root or the sign-in address); this function checks nothing.
 */
export function leaveAccountPage(address: string): void {
  window.location.replace(address);
}
