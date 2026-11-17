// The browser never imports the universes module (its public interface also exports server-only
// wiring). A server page reads the field names, issue codes and modes from the module and hands them
// down as props in this shape (specs/003-account-screens/plan.md, D13).

/** The fields of the universe creation form. */
export type UniverseFormFieldName = "name" | "description" | "mode";

export type UniverseFormVocabulary = {
  /** The name each form field has in the issues the actions return. */
  readonly fieldNames: Readonly<Record<UniverseFormFieldName, string>>;
  /** The stable code of each issue the universe rules report. */
  readonly issueCodes: {
    readonly nameRequired: string;
    readonly nameTooLong: string;
    readonly nameInvalidCharacters: string;
    readonly descriptionTooLong: string;
    readonly descriptionInvalidCharacters: string;
    readonly modeInvalid: string;
  };
  /** The modes a universe can have, in the order the form offers them. */
  readonly modes: readonly string[];
  /** The mode selected when the form opens. */
  readonly defaultMode: string;
};
