"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUniverses } from "@/components/universes/universes-provider";
import type { UniverseFieldMessages } from "@/components/universes/interpret-universe-action-result";
import { CREATION_NOTICE_CODES, type CreationNoticeCode } from "@/components/universes/universe-creation-state";
import type { UniverseDto } from "@/modules/universes";

type FieldErrors = UniverseFieldMessages;

// The texts of each mode, looked up by the mode names the page hands down in the vocabulary.
const MODE_TEXTS: Readonly<Record<string, { label: string; explanation: string }>> = en.universeCreation.modes;

const NOTICE_TEXT_BY_CODE: Readonly<Record<CreationNoticeCode, string>> = {
  [CREATION_NOTICE_CODES.failed]: en.universeCreation.notices.failed,
  [CREATION_NOTICE_CODES.resultUnknown]: en.universeCreation.notices.resultUnknown,
  [CREATION_NOTICE_CODES.confirmedAfterDelay]: en.universeCreation.notices.confirmedAfterDelay,
  [CREATION_NOTICE_CODES.signInAgain]: en.universeCreation.notices.signInAgain,
};

type UniverseCreationFormProps = {
  onCreated: (createdUniverse: UniverseDto) => void;
  onCancel: () => void;
};

// Mounted fresh every time it opens, so the fields start empty and READER is selected (FR-2).
export function UniverseCreationForm({ onCreated, onCancel }: UniverseCreationFormProps) {
  const {
    createUniverse,
    isUniverseNameInUse,
    vocabulary,
    isCreationBlocked,
    creationNoticeCode,
    signInAddress,
    dismissCreationNotice,
  } = useUniverses();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<string>(vocabulary.defaultMode);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isNameInUse, setIsNameInUse] = useState(false);
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

  // A message left by an earlier form does not belong to this one.
  useEffect(() => {
    dismissCreationNotice();
  }, [dismissCreationNotice]);

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
    // The duplicate warning is never repeated here: a duplicate name does not block creation (FR-12).
    // The provider ignores a second submission while one is waiting; the other ends are shown as a notice.
    const outcome = await createUniverse({ name, description, mode });
    if (outcome?.status === "created") {
      onCreated(outcome.universe);
    } else if (outcome?.status === "field-errors") {
      setFieldErrors(outcome.messagesByField);
      focusFirstInvalidField(outcome.messagesByField);
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
        aria-busy={isCreationBlocked}
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
            {vocabulary.modes.map((universeMode) => (
              <label
                key={universeMode}
                className="group rounded-control hover:bg-hover has-[[data-state=checked]]:bg-selection flex cursor-pointer items-start gap-3 px-2 py-1.5"
              >
                <RadioGroupItem
                  value={universeMode}
                  className="border-line-control data-[state=checked]:border-accent data-[state=checked]:bg-accent rounded-pill mt-0.5 size-4 shrink-0 border"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{MODE_TEXTS[universeMode]?.label ?? universeMode}</span>
                  {/* On the selection background ink-muted falls below 4.5:1 in some presets, so it switches to ink. */}
                  <span className="text-ink-muted group-has-[[data-state=checked]]:text-ink text-sm">
                    {MODE_TEXTS[universeMode]?.explanation}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
          <FieldError id={modeErrorId} message={fieldErrors.mode} />
          <p className="text-ink-muted text-xs">{en.universeCreation.modeImmutableNote}</p>
        </fieldset>

        {creationNoticeCode === null ? null : (
          <p
            role={creationNoticeCode === CREATION_NOTICE_CODES.confirmedAfterDelay ? "status" : "alert"}
            data-message-code={creationNoticeCode}
            className="text-ink text-sm"
          >
            {NOTICE_TEXT_BY_CODE[creationNoticeCode]}
            {creationNoticeCode === CREATION_NOTICE_CODES.signInAgain ? (
              <>
                {" "}
                <a href={signInAddress} className="underline">
                  {en.universeCreation.notices.signInLink}
                </a>
              </>
            ) : null}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isCreationBlocked}>
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
