"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { RelationshipFieldMessages } from "@/components/knowledge/interpret-knowledge-action-result";
import { useKnowledge, type RelationshipFormValues } from "@/components/knowledge/knowledge-provider";
import { PointField, proposePointForWork, type PointValue } from "@/components/knowledge/point-field";
import { CREATION_NOTICE_CODES, type CreationNoticeCode } from "@/components/universes/universe-creation-state";
import { useUniverses } from "@/components/universes/universes-provider";
import type { EntitySummaryDto, KnowledgeStatus, RelationshipTypeDto, WorkDto } from "@/modules/knowledge";
import type { UniverseMode } from "@/modules/universes";

const ENTITY_TYPE_LABELS: Readonly<Record<string, string>> = en.knowledge.entityTypes;
const STATUS_TEXTS: Readonly<Record<string, { label: string; explanation: string }>> = en.entityCreation.statuses;

/** The status the form proposes for a relationship (FR-7). */
const PROPOSED_RELATIONSHIP_STATUS: KnowledgeStatus = "USER_NOTE";

/** The fewest entities a relationship needs: a source and a different target (FR-7). */
const ENTITIES_NEEDED_FOR_A_RELATIONSHIP = 2;

const NO_WORKS: readonly WorkDto[] = [];
const NO_ENTITIES: readonly EntitySummaryDto[] = [];
const NO_RELATIONSHIP_TYPES: readonly RelationshipTypeDto[] = [];

// The messages of a creation that did not succeed; the confirmation of a late success is shown by the
// workspace, because the success closes this form.
const FAILURE_NOTICE_TEXT_BY_CODE: Readonly<
  Record<Exclude<CreationNoticeCode, typeof CREATION_NOTICE_CODES.confirmedAfterDelay>, string>
> = {
  [CREATION_NOTICE_CODES.failed]: en.relationshipCreation.notices.failed,
  [CREATION_NOTICE_CODES.resultUnknown]: en.relationshipCreation.notices.resultUnknown,
  [CREATION_NOTICE_CODES.signInAgain]: en.relationshipCreation.notices.signInAgain,
};

const SELECT_CLASS_NAME = cn(
  "border-line-control bg-surface rounded-control h-8 w-full min-w-0 border px-2 text-sm",
  "transition-colors duration-(--motion-fast) ease-standard aria-invalid:border-danger",
);

type RelationshipCreationFormProps = {
  universeMode: UniverseMode;
  /** The entity selected in the details panel, proposed as the source (FR-10); null proposes the first one. */
  proposedSourceEntityId: string | null;
  /** Receives the reading of the created relationship from its source, for the announcement. */
  onCreated: (createdReading: { sourceName: string; label: string; targetName: string }) => void;
  onCancel: () => void;
};

// The relationship form (spec 006, FR-7): a source and a target entity of the universe, one of its
// relationship types, a status ("My note" proposed) and the point where it is known, independent of the
// points of the entities. While the universe has fewer than two entities a message replaces it. The
// server decides every rule, an entity related to itself included. Mounted fresh every time it opens;
// unmounted, with its typed values, when the selected universe changes (FR-12).
export function RelationshipCreationForm({
  universeMode,
  proposedSourceEntityId,
  onCreated,
  onCancel,
}: RelationshipCreationFormProps) {
  const { knowledgeLoad } = useKnowledge();
  const entities = knowledgeLoad?.phase === "loaded" ? knowledgeLoad.knowledge.entities : NO_ENTITIES;

  if (entities.length < ENTITIES_NEEDED_FOR_A_RELATIONSHIP) {
    return (
      <div className="mx-auto flex min-w-0 max-w-xl flex-col items-start gap-4 p-6">
        <h2 className="font-serif text-xl">{en.relationshipCreation.title}</h2>
        <p className="text-ink-muted text-sm">{en.relationshipCreation.twoEntitiesNeeded}</p>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {en.relationshipCreation.cancel}
        </Button>
      </div>
    );
  }

  return (
    <RelationshipFields
      universeMode={universeMode}
      proposedSourceEntityId={proposedSourceEntityId}
      onCreated={onCreated}
      onCancel={onCancel}
    />
  );
}

function RelationshipFields({ universeMode, proposedSourceEntityId, onCreated, onCancel }: RelationshipCreationFormProps) {
  const { vocabulary, knowledgeLoad, createRelationship, isCreationBlocked, creationNoticeCode, dismissCreationNotice } =
    useKnowledge();
  const { signInAddress } = useUniverses();
  const knowledge = knowledgeLoad?.phase === "loaded" ? knowledgeLoad.knowledge : null;
  const works = knowledge?.works ?? NO_WORKS;
  const entities = knowledge?.entities ?? NO_ENTITIES;
  const relationshipTypes = knowledge?.relationshipTypes ?? NO_RELATIONSHIP_TYPES;
  const [sourceEntityId, setSourceEntityId] = useState<string>(
    () => entities.find((entity) => entity.id === proposedSourceEntityId)?.id ?? entities[0]?.id ?? "",
  );
  const [targetEntityId, setTargetEntityId] = useState<string>(
    () => entities.find((entity) => entity.id !== sourceEntityId)?.id ?? "",
  );
  const [relationshipTypeId, setRelationshipTypeId] = useState<string>(relationshipTypes[0]?.id ?? "");
  const [status, setStatus] = useState<string>(PROPOSED_RELATIONSHIP_STATUS);
  const [point, setPoint] = useState<PointValue>(() => proposePointForWork(works[0], universeMode));
  const [fieldErrors, setFieldErrors] = useState<RelationshipFieldMessages>({});
  const failureNoticeCode = creationNoticeCode === CREATION_NOTICE_CODES.confirmedAfterDelay ? null : creationNoticeCode;
  const failureNoticeRef = useRef<HTMLParagraphElement>(null);
  const lastSeenNoticeCodeRef = useRef(failureNoticeCode);
  const isMountedRef = useRef(false);
  const sourceSelectRef = useRef<HTMLSelectElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const targetSelectRef = useRef<HTMLSelectElement>(null);
  const statusFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const workSelectRef = useRef<HTMLSelectElement>(null);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const fieldIdPrefix = useId();
  const statusErrorId = `${fieldIdPrefix}-status-error`;

  useEffect(() => {
    isMountedRef.current = true;
    sourceSelectRef.current?.focus();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // A message left by an earlier form does not belong to this one.
  useEffect(() => {
    dismissCreationNotice();
  }, [dismissCreationNotice]);

  // A failure message takes focus when it appears, as in the universe form (004 NFR-4).
  useEffect(() => {
    if (failureNoticeCode !== null && failureNoticeCode !== lastSeenNoticeCodeRef.current) {
      failureNoticeRef.current?.focus();
    }
    lastSeenNoticeCodeRef.current = failureNoticeCode;
  }, [failureNoticeCode]);

  function clearFieldErrors(...fields: (keyof RelationshipFieldMessages)[]) {
    setFieldErrors((current) => {
      const remaining = { ...current };
      for (const field of fields) delete remaining[field];
      return remaining;
    });
  }

  function focusFirstInvalidField(errors: RelationshipFieldMessages) {
    const fieldsInOrder: [keyof RelationshipFieldMessages, () => HTMLElement | null | undefined][] = [
      ["sourceEntityId", () => sourceSelectRef.current],
      ["relationshipTypeId", () => typeSelectRef.current],
      ["targetEntityId", () => targetSelectRef.current],
      ["status", () => statusFieldsetRef.current?.querySelector<HTMLElement>("[role=radio]")],
      ["boundaryWorkId", () => workSelectRef.current],
      ["boundaryUnitNumber", () => unitInputRef.current],
    ];
    const firstInvalidField = fieldsInOrder.find(([field]) => errors[field] !== undefined);
    firstInvalidField?.[1]()?.focus();
  }

  function readFormValues(): RelationshipFormValues {
    return {
      sourceEntityId,
      targetEntityId,
      relationshipTypeId,
      status,
      boundary: { workId: point.workId, unitNumber: point.typedUnitNumber },
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The provider ignores a second submission while one is waiting; the other ends are shown as a notice.
    setFieldErrors({});
    const submittedValues = readFormValues();
    const outcome = await createRelationship(submittedValues);
    // A late answer may arrive after the form was closed: then it has nothing to do here.
    if (!isMountedRef.current) return;
    if (outcome?.status === "created") {
      onCreated({
        sourceName: entities.find((entity) => entity.id === submittedValues.sourceEntityId)?.name ?? "",
        label: relationshipTypes.find((type) => type.id === submittedValues.relationshipTypeId)?.label ?? "",
        targetName: entities.find((entity) => entity.id === submittedValues.targetEntityId)?.name ?? "",
      });
    } else if (outcome?.status === "field-errors") {
      setFieldErrors(outcome.messagesByField);
      focusFirstInvalidField(outcome.messagesByField);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <form
        noValidate
        aria-busy={isCreationBlocked}
        onSubmit={handleSubmit}
        className="animate-in fade-in-0 slide-in-from-bottom-1 mx-auto flex min-w-0 max-w-xl flex-col gap-5 p-6 duration-(--motion-base)"
      >
        <h2 className="font-serif text-xl">{en.relationshipCreation.title}</h2>

        <EntityChoice
          label={en.relationshipCreation.sourceLabel}
          entities={entities}
          value={sourceEntityId}
          onChange={(entityId) => {
            setSourceEntityId(entityId);
            clearFieldErrors("sourceEntityId", "targetEntityId");
          }}
          errorMessage={fieldErrors.sourceEntityId}
          selectRef={sourceSelectRef}
        />

        <SelectField
          label={en.relationshipCreation.typeLabel}
          value={relationshipTypeId}
          onChange={(typeId) => {
            setRelationshipTypeId(typeId);
            clearFieldErrors("relationshipTypeId");
          }}
          errorMessage={fieldErrors.relationshipTypeId}
          selectRef={typeSelectRef}
        >
          {relationshipTypes.map((relationshipType) => (
            <option key={relationshipType.id} value={relationshipType.id}>
              {relationshipType.label}
            </option>
          ))}
        </SelectField>

        <EntityChoice
          label={en.relationshipCreation.targetLabel}
          entities={entities}
          value={targetEntityId}
          onChange={(entityId) => {
            setTargetEntityId(entityId);
            clearFieldErrors("targetEntityId");
          }}
          errorMessage={fieldErrors.targetEntityId}
          selectRef={targetSelectRef}
        />

        <fieldset
          ref={statusFieldsetRef}
          className="flex min-w-0 flex-col gap-2"
          aria-describedby={fieldErrors.status === undefined ? undefined : statusErrorId}
        >
          <legend className="text-sm font-medium">{en.relationshipCreation.statusLegend}</legend>
          <RadioGroup
            name="relationshipStatus"
            value={status}
            onValueChange={(chosenStatus) => {
              setStatus(chosenStatus);
              clearFieldErrors("status");
            }}
            className="gap-1"
          >
            {vocabulary.relationship.statuses.map((statusOption) => (
              <label
                key={statusOption}
                className="group rounded-control hover:bg-hover has-[[data-state=checked]]:bg-selection flex cursor-pointer items-start gap-3 px-2 py-1.5"
              >
                <RadioGroupItem
                  value={statusOption}
                  className="border-line-control data-[state=checked]:border-accent data-[state=checked]:bg-accent rounded-pill mt-0.5 size-4 shrink-0 border"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{STATUS_TEXTS[statusOption]?.label ?? statusOption}</span>
                  {/* On the selection background ink-muted falls below 4.5:1 in some presets, so it switches to ink. */}
                  <span className="text-ink-muted group-has-[[data-state=checked]]:text-ink text-sm">
                    {STATUS_TEXTS[statusOption]?.explanation}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
          <FieldError id={statusErrorId} message={fieldErrors.status} />
        </fieldset>

        <PointField
          legend={en.relationshipCreation.pointLegend}
          works={works}
          universeMode={universeMode}
          value={point}
          onChange={(chosenPoint) => {
            setPoint(chosenPoint);
            clearFieldErrors("boundaryWorkId", "boundaryUnitNumber");
          }}
          workErrorMessage={fieldErrors.boundaryWorkId}
          unitErrorMessage={fieldErrors.boundaryUnitNumber}
          workSelectRef={workSelectRef}
          unitInputRef={unitInputRef}
        />

        {failureNoticeCode === null ? null : (
          <p
            ref={failureNoticeRef}
            role="alert"
            tabIndex={-1}
            data-message-code={failureNoticeCode}
            className="text-ink text-sm outline-offset-2"
          >
            {FAILURE_NOTICE_TEXT_BY_CODE[failureNoticeCode]}
            {failureNoticeCode === CREATION_NOTICE_CODES.signInAgain ? (
              <>
                {" "}
                <a href={signInAddress} className="underline">
                  {en.relationshipCreation.notices.signInLink}
                </a>
              </>
            ) : null}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isCreationBlocked}>
            {en.relationshipCreation.create}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {en.relationshipCreation.cancel}
          </Button>
        </div>
      </form>
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  errorMessage: string | undefined;
  selectRef: Ref<HTMLSelectElement>;
  children: ReactNode;
};

/** A native choice with its visible label and its error linked to it. */
function SelectField({ label, value, onChange, errorMessage, selectRef, children }: SelectFieldProps) {
  const selectId = useId();
  const errorId = `${selectId}-error`;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={selectId}
        ref={selectRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={errorMessage !== undefined}
        aria-describedby={errorMessage === undefined ? undefined : errorId}
        className={SELECT_CLASS_NAME}
      >
        {children}
      </select>
      <FieldError id={errorId} message={errorMessage} />
    </div>
  );
}

type EntityChoiceProps = Omit<SelectFieldProps, "children"> & { entities: readonly EntitySummaryDto[] };

/** The choice of one entity of the universe, by name and type, in creation order. */
function EntityChoice({ entities, ...selectFieldProps }: EntityChoiceProps) {
  return (
    <SelectField {...selectFieldProps}>
      {entities.map((entity) => (
        <option key={entity.id} value={entity.id}>
          {en.relationshipCreation.entityOption(entity.name, ENTITY_TYPE_LABELS[entity.type] ?? entity.type)}
        </option>
      ))}
    </SelectField>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }): ReactNode {
  if (message === undefined) return null;
  return (
    <p id={id} className="text-danger text-sm">
      {message}
    </p>
  );
}
