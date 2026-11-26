// The browser never imports the knowledge module (its public interface also exports server-only
// wiring). The workspace page reads the field names, issue codes, media, entity types and limits
// from the module and hands them down as props in this shape (as the universe forms do).

/** The fields of the work creation form. */
export type WorkFormFieldName = "title" | "medium" | "unitCount";

/** The fields of the entity creation form, with its optional first fragment. */
export type EntityFormFieldName =
  | "name"
  | "type"
  | "boundaryWorkId"
  | "boundaryUnitNumber"
  | "fragmentContent"
  | "fragmentStatus"
  | "fragmentBoundaryWorkId"
  | "fragmentBoundaryUnitNumber";

/** The fields of the relationship creation form. */
export type RelationshipFormFieldName =
  | "sourceEntityId"
  | "targetEntityId"
  | "relationshipTypeId"
  | "status"
  | "boundaryWorkId"
  | "boundaryUnitNumber";

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
  readonly entity: {
    /** The input path each form field has in the issues the entity action returns (D17). */
    readonly fieldNames: Readonly<Record<EntityFormFieldName, string>>;
    /** The stable code of each issue the entity and fragment rules report. */
    readonly issueCodes: {
      readonly nameRequired: string;
      readonly nameTooLong: string;
      readonly nameInvalidCharacters: string;
      readonly typeInvalid: string;
      /** A work identifier that is not well formed, for either point. */
      readonly workIdInvalid: string;
      readonly unitNumberRequired: string;
      readonly unitNumberInvalid: string;
      readonly contentTooLong: string;
      readonly contentInvalidCharacters: string;
      readonly statusInvalid: string;
    };
    /** The statuses of a fragment, in the order the form offers them. */
    readonly statuses: readonly string[];
    readonly maximumNameLength: number;
    readonly maximumFragmentContentLength: number;
  };
  readonly relationship: {
    /** The input path each form field has in the issues the relationship action returns (D17). */
    readonly fieldNames: Readonly<Record<RelationshipFormFieldName, string>>;
    /** The stable code of each issue the relationship rules report. */
    readonly issueCodes: {
      /** An entity, relationship type or work identifier that is not well formed. */
      readonly itemIdInvalid: string;
      readonly unitNumberRequired: string;
      readonly unitNumberInvalid: string;
      readonly statusInvalid: string;
    };
    /** The code of the refusal of a relationship from an entity to itself, the one business rule of the form (FR-8). */
    readonly relatedToItselfCode: string;
    /** The statuses of a relationship, in the order the form offers them. */
    readonly statuses: readonly string[];
  };
  /** The types an entity can have, in the order the forms offer them. */
  readonly entityTypes: readonly string[];
};
