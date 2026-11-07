/** One rejected field as the interface receives it. Same shape as a domain validation issue, without the field name. */
export type ActionFieldIssue = {
  readonly code: string;
  readonly minimumLength?: number;
  readonly maximumLength?: number;
};

/** The body of a failure, identical for every error kind. `fieldErrors` exists only for validation. */
export type ActionErrorBody = {
  readonly code: string;
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, readonly ActionFieldIssue[]>>;
};

/** What a Server Action returns: the value, or the failure built by the one error mapper. */
export type ActionResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ActionErrorBody };
