"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input, Textarea } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { EntityFieldMessages } from "@/components/knowledge/interpret-knowledge-action-result";
import { useKnowledge, type EntityFormValues } from "@/components/knowledge/knowledge-provider";
import { PointField, proposePointForWork, type PointValue } from "@/components/knowledge/point-field";
import { CREATION_NOTICE_CODES, type CreationNoticeCode } from "@/components/universes/universe-creation-state";
import { useUniverses } from "@/components/universes/universes-provider";
import type { EntitySummaryDto, KnowledgeStatus, WorkDto } from "@/modules/knowledge";
import type { UniverseMode } from "@/modules/universes";

const ENTITY_TYPE_LABELS: Readonly<Record<string, string>> = en.knowledge.entityTypes;
const STATUS_TEXTS: Readonly<Record<string, { label: string; explanation: string }>> = en.entityCreation.statuses;

/** The status the form proposes for a first fragment (FR-5). */
const PROPOSED_FRAGMENT_STATUS: KnowledgeStatus = "USER_NOTE";

const NO_WORKS: readonly WorkDto[] = [];

// The messages of a creation that did not succeed; the confirmation of a late success is shown by the
// workspace, because the success closes this form.
const FAILURE_NOTICE_TEXT_BY_CODE: Readonly<
  Record<Exclude<CreationNoticeCode, typeof CREATION_NOTICE_CODES.confirmedAfterDelay>, string>
> = {
  [CREATION_NOTICE_CODES.failed]: en.entityCreation.notices.failed,
  [CREATION_NOTICE_CODES.resultUnknown]: en.entityCreation.notices.resultUnknown,
  [CREATION_NOTICE_CODES.signInAgain]: en.entityCreation.notices.signInAgain,
};

const SELECT_CLASS_NAME = cn(
  "border-line-control bg-surface rounded-control h-8 w-full min-w-0 border px-2 text-sm",
  "transition-colors duration-(--motion-fast) ease-standard aria-invalid:border-danger",
);

type EntityCreationFormProps = {
  universeMode: UniverseMode;
  onCreated: (createdEntity: EntitySummaryDto) => void;
  onCancel: () => void;
};

// The entity form (spec 006, FR-4, FR-5): name, type, the point where the entity is introduced and an
// optional first fragment with its status and point. While "Same point as the entity" is checked the
// fragment sends no point of its own, so it takes the point of the entity at the moment of submission;
// unchecked, its own point starts as the entity point and then stays as the person leaves it. Mounted
// fresh every time it opens; unmounted, with its typed values, when the selected universe changes (FR-12).
export function EntityCreationForm({ universeMode, onCreated, onCancel }: EntityCreationFormProps) {
  const { vocabulary, knowledgeLoad, createEntity, isCreationBlocked, creationNoticeCode, dismissCreationNotice } =
    useKnowledge();
  const { signInAddress } = useUniverses();
  const works = knowledgeLoad?.phase === "loaded" ? knowledgeLoad.knowledge.works : NO_WORKS;
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<string>(vocabulary.entityTypes[0] ?? "");
  const [entityPoint, setEntityPoint] = useState<PointValue>(() => proposePointForWork(works[0], universeMode));
  const [fragmentContent, setFragmentContent] = useState("");
  const [fragmentStatus, setFragmentStatus] = useState<string>(PROPOSED_FRAGMENT_STATUS);
  const [fragmentFollowsEntityPoint, setFragmentFollowsEntityPoint] = useState(true);
  const [fragmentPoint, setFragmentPoint] = useState<PointValue>(entityPoint);
  const [fieldErrors, setFieldErrors] = useState<EntityFieldMessages>({});
  const failureNoticeCode = creationNoticeCode === CREATION_NOTICE_CODES.confirmedAfterDelay ? null : creationNoticeCode;
  const failureNoticeRef = useRef<HTMLParagraphElement>(null);
  const lastSeenNoticeCodeRef = useRef(failureNoticeCode);
  const isMountedRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const entityWorkSelectRef = useRef<HTMLSelectElement>(null);
  const entityUnitInputRef = useRef<HTMLInputElement>(null);
  const fragmentContentRef = useRef<HTMLTextAreaElement>(null);
  const statusFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const fragmentWorkSelectRef = useRef<HTMLSelectElement>(null);
  const fragmentUnitInputRef = useRef<HTMLInputElement>(null);
  const fieldIdPrefix = useId();
  const nameInputId = `${fieldIdPrefix}-name`;
  const nameErrorId = `${fieldIdPrefix}-name-error`;
  const typeSelectId = `${fieldIdPrefix}-type`;
  const typeErrorId = `${fieldIdPrefix}-type-error`;
  const contentInputId = `${fieldIdPrefix}-fragment-content`;
  const contentHintId = `${fieldIdPrefix}-fragment-content-hint`;
  const contentErrorId = `${fieldIdPrefix}-fragment-content-error`;
  const statusErrorId = `${fieldIdPrefix}-fragment-status-error`;
  const samePointCheckboxId = `${fieldIdPrefix}-same-point`;

  useEffect(() => {
    isMountedRef.current = true;
    nameInputRef.current?.focus();
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

  function clearFieldErrors(...fields: (keyof EntityFieldMessages)[]) {
    setFieldErrors((current) => {
      const remaining = { ...current };
      for (const field of fields) delete remaining[field];
      return remaining;
    });
  }

  function focusFirstInvalidField(errors: EntityFieldMessages) {
    const fieldsInOrder: [keyof EntityFieldMessages, () => HTMLElement | null | undefined][] = [
      ["name", () => nameInputRef.current],
      ["type", () => typeSelectRef.current],
      ["boundaryWorkId", () => entityWorkSelectRef.current],
      ["boundaryUnitNumber", () => entityUnitInputRef.current],
      ["fragmentContent", () => fragmentContentRef.current],
      ["fragmentStatus", () => statusFieldsetRef.current?.querySelector<HTMLElement>("[role=radio]")],
      ["fragmentBoundaryWorkId", () => fragmentWorkSelectRef.current],
      ["fragmentBoundaryUnitNumber", () => fragmentUnitInputRef.current],
    ];
    const firstInvalidField = fieldsInOrder.find(([field]) => errors[field] !== undefined);
    firstInvalidField?.[1]()?.focus();
  }

  function changeEntityPoint(point: PointValue) {
    setEntityPoint(point);
    clearFieldErrors("boundaryWorkId", "boundaryUnitNumber");
  }

  function changeFragmentPoint(point: PointValue) {
    setFragmentPoint(point);
    clearFieldErrors("fragmentBoundaryWorkId", "fragmentBoundaryUnitNumber");
  }

  function changeFragmentFollowsEntityPoint(follows: boolean) {
    setFragmentFollowsEntityPoint(follows);
    // Its own point starts where the entity is; from then on it stays as the person leaves it (FR-5).
    if (!follows) setFragmentPoint(entityPoint);
    clearFieldErrors("fragmentBoundaryWorkId", "fragmentBoundaryUnitNumber");
  }

  function readFormValues(): EntityFormValues {
    return {
      name,
      type: entityType,
      boundary: { workId: entityPoint.workId, unitNumber: entityPoint.typedUnitNumber },
      fragment: {
        content: fragmentContent,
        status: fragmentStatus,
        boundary: fragmentFollowsEntityPoint
          ? null
          : { workId: fragmentPoint.workId, unitNumber: fragmentPoint.typedUnitNumber },
      },
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The provider ignores a second submission while one is waiting; the other ends are shown as a notice.
    setFieldErrors({});
    const outcome = await createEntity(readFormValues());
    // A late answer may arrive after the form was closed: then it has nothing to do here.
    if (!isMountedRef.current) return;
    if (outcome?.status === "created") {
      onCreated(outcome.entity);
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
        <h2 className="font-serif text-xl">{en.entityCreation.title}</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameInputId} className="text-sm font-medium">
            {en.entityCreation.nameLabel}
          </label>
          <Input
            id={nameInputId}
            ref={nameInputRef}
            name="name"
            autoComplete="off"
            placeholder={en.entityCreation.namePlaceholder}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldErrors("name");
            }}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={fieldErrors.name === undefined ? undefined : nameErrorId}
            className="aria-invalid:border-danger"
          />
          <FieldError id={nameErrorId} message={fieldErrors.name} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={typeSelectId} className="text-sm font-medium">
            {en.entityCreation.typeLabel}
          </label>
          <select
            id={typeSelectId}
            ref={typeSelectRef}
            name="type"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              clearFieldErrors("type");
            }}
            aria-invalid={fieldErrors.type !== undefined}
            aria-describedby={fieldErrors.type === undefined ? undefined : typeErrorId}
            className={SELECT_CLASS_NAME}
          >
            {vocabulary.entityTypes.map((type) => (
              <option key={type} value={type}>
                {ENTITY_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
          <FieldError id={typeErrorId} message={fieldErrors.type} />
        </div>

        <PointField
          legend={en.entityCreation.pointLegend}
          works={works}
          universeMode={universeMode}
          value={entityPoint}
          onChange={changeEntityPoint}
          workErrorMessage={fieldErrors.boundaryWorkId}
          unitErrorMessage={fieldErrors.boundaryUnitNumber}
          workSelectRef={entityWorkSelectRef}
          unitInputRef={entityUnitInputRef}
        />

        <fieldset className="border-line rounded-control flex min-w-0 flex-col gap-4 border p-4">
          <legend className="px-1 text-sm font-medium">
            {en.entityCreation.fragmentLegend}{" "}
            <span className="text-ink-muted font-normal">({en.entityCreation.fragmentOptionalHint})</span>
          </legend>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={contentInputId} className="text-sm font-medium">
              {en.entityCreation.fragmentContentLabel}
            </label>
            <Textarea
              id={contentInputId}
              ref={fragmentContentRef}
              name="fragmentContent"
              value={fragmentContent}
              onChange={(event) => {
                setFragmentContent(event.target.value);
                clearFieldErrors("fragmentContent");
              }}
              aria-invalid={fieldErrors.fragmentContent !== undefined}
              aria-describedby={[contentHintId, fieldErrors.fragmentContent === undefined ? null : contentErrorId]
                .filter((describedById) => describedById !== null)
                .join(" ")}
              className="aria-invalid:border-danger"
            />
            <p id={contentHintId} className="text-ink-muted text-xs">
              {en.entityCreation.fragmentContentHint}
            </p>
            <FieldError id={contentErrorId} message={fieldErrors.fragmentContent} />
          </div>

          <fieldset
            ref={statusFieldsetRef}
            className="flex min-w-0 flex-col gap-2"
            aria-describedby={fieldErrors.fragmentStatus === undefined ? undefined : statusErrorId}
          >
            <legend className="text-sm font-medium">{en.entityCreation.statusLegend}</legend>
            <RadioGroup
              name="fragmentStatus"
              value={fragmentStatus}
              onValueChange={(status) => {
                setFragmentStatus(status);
                clearFieldErrors("fragmentStatus");
              }}
              className="gap-1"
            >
              {vocabulary.entity.statuses.map((status) => (
                <label
                  key={status}
                  className="group rounded-control hover:bg-hover has-[[data-state=checked]]:bg-selection flex cursor-pointer items-start gap-3 px-2 py-1.5"
                >
                  <RadioGroupItem
                    value={status}
                    className="border-line-control data-[state=checked]:border-accent data-[state=checked]:bg-accent rounded-pill mt-0.5 size-4 shrink-0 border"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{STATUS_TEXTS[status]?.label ?? status}</span>
                    {/* On the selection background ink-muted falls below 4.5:1 in some presets, so it switches to ink. */}
                    <span className="text-ink-muted group-has-[[data-state=checked]]:text-ink text-sm">
                      {STATUS_TEXTS[status]?.explanation}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <FieldError id={statusErrorId} message={fieldErrors.fragmentStatus} />
          </fieldset>

          <div className="flex items-center gap-2">
            <input
              id={samePointCheckboxId}
              type="checkbox"
              checked={fragmentFollowsEntityPoint}
              onChange={(event) => changeFragmentFollowsEntityPoint(event.target.checked)}
              className="accent-accent size-4 shrink-0"
            />
            <label htmlFor={samePointCheckboxId} className="text-sm">
              {en.entityCreation.samePointLabel}
            </label>
          </div>

          {fragmentFollowsEntityPoint ? null : (
            <PointField
              legend={en.entityCreation.fragmentPointLegend}
              works={works}
              universeMode={universeMode}
              value={fragmentPoint}
              onChange={changeFragmentPoint}
              workErrorMessage={fieldErrors.fragmentBoundaryWorkId}
              unitErrorMessage={fieldErrors.fragmentBoundaryUnitNumber}
              workSelectRef={fragmentWorkSelectRef}
              unitInputRef={fragmentUnitInputRef}
            />
          )}
        </fieldset>

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
                  {en.entityCreation.notices.signInLink}
                </a>
              </>
            ) : null}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isCreationBlocked}>
            {en.entityCreation.create}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {en.entityCreation.cancel}
          </Button>
        </div>
      </form>
    </div>
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
