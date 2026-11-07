/**
 * The account on whose behalf a request acts. It is built only from the session of the request
 * (see `requireActingUser`), never from data the client sends.
 */
export type ActingUser = {
  readonly userId: string;
};
