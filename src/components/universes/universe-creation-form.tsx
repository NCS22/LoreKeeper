"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getUniverseIssueMessage } from "@/components/universes/universe-issue-messages";
import { useUniverses } from "@/components/universes/universes-provider";
import {
  DEFAULT_UNIVERSE_MODE,
  UNIVERSE_DESCRIPTION_FIELD,
  UNIVERSE_MODE_FIELD,
  UNIVERSE_MODES,
  UNIVERSE_NAME_FIELD,
  type UniverseDto,
} from "@/modules/universes";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";

type FieldErrors = {
  name?: string;
  description?: string;
  mode?: string;
};

function findFieldErrorMessage(issues: readonly ValidationIssue[], field: string): string | undefined {
  const issueOfField = issues.find((issue) => issue.field === field);
  return issueOfField === undefined ? undefined : getUniverseIssueMessage(issueOfField);
}

function buildFieldErrors(issues: readonly ValidationIssue[]): FieldErrors {
  return {
    name: findFieldErrorMessage(issues, UNIVERSE_NAME_FIELD),
    description: findFieldErrorMessage(issues, UNIVERSE_DESCRIPTION_FIELD),
    mode: findFieldErrorMessage(issues, UNIVERSE_MODE_FIELD),
  };
}

type UniverseCreationFormProps = {
  onCreated: (createdUniverse: UniverseDto) => void;
  onCancel: () => void;
};

// Mounted fresh every time it opens, so the fields start empty and READER is selected (FR-2).
export function UniverseCreationForm({ onCreated, onCancel }: UniverseCreationFormProps) {
  const { createUniverse, isUniverseNameInUse } = useUniverses();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<string>(DEFAULT_UNIVERSE_MODE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isNameInUse, setIsNameInUse] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Synchronous guard: state updates are asynchronous, so two quick submits could both pass a state check (FR-19).
  const isSubmitInFlightRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const modeFieldsetRef = useRef<HTMLFieldSetElement>(null);
  const fieldIdPrefix = useId();
  const nameInputId = `${fieldIdPrefix}-name`;
  const nameWarningId = `${fieldIdPrefix}-name-warning`;
  const nameErrorId = `${fieldIdPrefix}-name-error`;
  const descriptionInputId = `${fieldIdPrefix}-description`;
  const descriptionErrorId = `${fieldIdPrefix}-description-error`;
  const modeErrorId = `${fieldIdPrefix}-mode-error`;

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Live duplicate-name warning (FR-11, FR-13). An answer that arrives after the name changed again is ignored.
  useEffect(() => {
    let isAnswerStale = false;
    void isUniverseNameInUse(name).then((isInUse) => {
      if (!isAnswerStale) setIsNameInUse(isInUse);
    });
    return () => {
      isAnswerStale = true;
    };
  }, [name, isUniverseNameInUse]);

  function focusFirstInvalidField(errors: FieldErrors) {
    if (errors.name !== undefined) nameInputRef.current?.focus();
    else if (errors.description !== undefined) descriptionInputRef.current?.focus();
    else if (errors.mode !== undefined) modeFieldsetRef.current?.querySelector<HTMLElement>("[role=radio]")?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitInFlightRef.current) return;
    isSubmitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      // The duplicate warning is never repeated here: a duplicate name does not block creation (FR-12).
      const createdUniverse = await createUniverse({ name, description, mode });
      // The form unmounts on success, so the guard stays set until then.
      onCreated(createdUniverse);
    } catch (error) {
      isSubmitInFlightRef.current = false;
      setIsSubmitting(false);
      if (!(error instanceof ValidationError)) throw error;
      const errors = buildFieldErrors(error.issues);
      setFieldErrors(errors);
      focusFirstInvalidField(errors);
    }
  }

  function changeName(newName: string) {
    setName(newName);
    setFieldErrors((current) => ({ ...current, name: undefined }));
  }

  function changeDescription(newDescription: string) {
    setDescription(newDescription);
    setFieldErrors((current) => ({ ...current, description: undefined }));
  }

  function changeMode(newMode: string) {
    setMode(newMode);
    setFieldErrors((current) => ({ ...current, mode: undefined }));
  }

  return (
    <div className="h-full overflow-y-auto">
      <form
        noValidate
        onSubmit={handleSubmit}
        className="animate-in fade-in-0 slide-in-from-bottom-1 mx-auto flex max-w-xl flex-col gap-5 p-6 duration-(--motion-base)"
      >
        <h2 className="font-serif text-xl">{en.universeCreation.title}</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameInputId} className="text-sm font-medium">
            {en.universeCreation.nameLabel}
          </label>
          <Input
            id={nameInputId}
            ref={nameInputRef}
            name="name"
            autoComplete="off"
            placeholder={en.universeCreation.namePlaceholder}
            value={name}
            onChange={(event) => changeName(event.target.value)}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={[nameWarningId, fieldErrors.name === undefined ? null : nameErrorId]
              .filter((describedById) => describedById !== null)
              .join(" ")}
            className="aria-invalid:border-danger"
          />
          {/* Always in the accessibility tree so its appearance is announced; when empty it is visually collapsed
              (sr-only takes it out of the layout) but never display:none. The warning never blocks submitting. */}
          <p id={nameWarningId} role="status" aria-live="polite" className="text-ink flex items-start gap-1.5 text-sm empty:sr-only">
            {isNameInUse ? (
              <>
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{en.universeCreation.duplicateNameWarning}</span>
              </>
            ) : null}
          </p>
          <FieldError id={nameErrorId} message={fieldErrors.name} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={descriptionInputId} className="text-sm font-medium">
            {en.universeCreation.descriptionLabel}{" "}
            <span className="text-ink-muted font-normal">({en.universeCreation.descriptionOptionalHint})</span>
          </label>
          <Textarea
            id={descriptionInputId}
            ref={descriptionInputRef}
            name="description"
            placeholder={en.universeCreation.descriptionPlaceholder}
            value={description}
            onChange={(event) => changeDescription(event.target.value)}
            aria-invalid={fieldErrors.description !== undefined}
            aria-describedby={fieldErrors.description === undefined ? undefined : descriptionErrorId}
            className="aria-invalid:border-danger"
          />
          <FieldError id={descriptionErrorId} message={fieldErrors.description} />
        </div>

        <fieldset
          ref={modeFieldsetRef}
          className="flex flex-col gap-2"
          aria-describedby={fieldErrors.mode === undefined ? undefined : modeErrorId}
        >
          <legend className="text-sm font-medium">{en.universeCreation.modeLegend}</legend>
          <RadioGroup name="mode" value={mode} onValueChange={changeMode} className="gap-1">
            {UNIVERSE_MODES.map((universeMode) => (
              <label
                key={universeMode}
                className="group rounded-control hover:bg-hover has-[[data-state=checked]]:bg-selection flex cursor-pointer items-start gap-3 px-2 py-1.5"
              >
                <RadioGroupItem
                  value={universeMode}
                  className="border-line-control data-[state=checked]:border-accent data-[state=checked]:bg-accent rounded-pill mt-0.5 size-4 shrink-0 border"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{en.universeCreation.modes[universeMode].label}</span>
                  {/* On the selection background ink-muted falls below 4.5:1 in some presets, so it switches to ink. */}
                  <span className="text-ink-muted group-has-[[data-state=checked]]:text-ink text-sm">
                    {en.universeCreation.modes[universeMode].explanation}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
          <FieldError id={modeErrorId} message={fieldErrors.mode} />
          <p className="text-ink-muted text-xs">{en.universeCreation.modeImmutableNote}</p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {en.universeCreation.create}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {en.universeCreation.cancel}
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
