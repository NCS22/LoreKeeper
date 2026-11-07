export type ActiveSession = {
  readonly userId: string;
};

/**
 * Reads the valid session of the request being served. It takes no argument on purpose: nothing
 * the client sends (body, parameters, headers) can choose whose session is read (FR-21).
 * Returns `null` when the request has no valid session; throws `InfrastructureError` when the
 * session cannot be checked (FR-22), which is never the same as "signed out".
 */
export interface SessionReader {
  readActiveSession(): Promise<ActiveSession | null>;
}
