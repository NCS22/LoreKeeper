/**
 * The account on whose behalf a request acts. It is built only from the session of the request
 * (see `requireActingUser`), never from data the client sends. It carries the three values of the
 * account that features may show or use: the identifier, the display name and the email as stored.
 */
export type ActingUser = {
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
};
