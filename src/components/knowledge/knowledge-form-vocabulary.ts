// The browser never imports the knowledge module (its public interface also exports server-only
// wiring). The workspace page reads the field names, issue codes, media, entity types and limits
// from the module and hands them down as props in this shape (as the universe forms do).

/** The fields of the work creation form. */
export type WorkFormFieldName = "title" | "medium" | "unitCount";

export type KnowledgeFormVocabulary = {
  readonly work: {
    /** The name each form field has in the issues the actions return. */
    readonly fieldNames: Readonly<Record<WorkFormFieldName, string>>;
    /** The stable code of each issue the work rules report. */
    readonly issueCodes: {
      readonly titleRequired: string;
      readonly titleTooLong: string;
      readonly titleInvalidCharacters: string;
      readonly mediumInvalid: string;
      readonly unitCountRequired: string;
      readonly unitCountInvalid: string;
      readonly unitCountOutOfRange: string;
    };
    /** The media a work can have, in the order the form offers them; the first is selected when it opens. */
    readonly mediums: readonly string[];
    readonly maximumTitleLength: number;
    readonly maximumUnitCount: number;
  };
  /** The types an entity can have, in the order the forms offer them. */
  readonly entityTypes: readonly string[];
};
