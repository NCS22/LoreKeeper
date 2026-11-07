/**
 * What the log may know besides the error itself: the stable code the failure was answered with.
 * It has no room for request bodies, form values or credentials, on purpose: the type rejects
 * any other property.
 */
export type ServerErrorContext = {
  readonly errorCode: string;
};

/**
 * Writes an error to the server log with its full detail (message, stack and `cause` chain).
 * Callers pass the error, never the request that produced it.
 */
export function logServerError(error: unknown, context: ServerErrorContext): void {
  console.error(`[server-error] ${context.errorCode}`, error);
}
