"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/input";
import type { WorkFieldMessages } from "@/components/knowledge/interpret-knowledge-action-result";
import { useKnowledge } from "@/components/knowledge/knowledge-provider";
import { CREATION_NOTICE_CODES, type CreationNoticeCode } from "@/components/universes/universe-creation-state";
import { useUniverses } from "@/components/universes/universes-provider";
import type { WorkDto } from "@/modules/knowledge";

const MEDIUM_LABELS: Readonly<Record<string, string>> = en.knowledge.mediums;

// The messages of a creation that did not succeed; the confirmation of a late success is shown by the
// workspace, because the success closes this form.
const FAILURE_NOTICE_TEXT_BY_CODE: Readonly<
  Record<Exclude<CreationNoticeCode, typeof CREATION_NOTICE_CODES.confirmedAfterDelay>, string>
> = {
  [CREATION_NOTICE_CODES.failed]: en.workCreation.notices.failed,
  [CREATION_NOTICE_CODES.resultUnknown]: en.workCreation.notices.resultUnknown,
  [CREATION_NOTICE_CODES.signInAgain]: en.workCreation.notices.signInAgain,
};

const SELECT_CLASS_NAME = cn(
  "border-line-control bg-surface rounded-control h-8 w-full min-w-0 border px-2 text-sm",
  "transition-colors duration-(--motion-fast) ease-standard aria-invalid:border-danger",
);

type WorkCreationFormProps = {
  onCreated: (createdWork: WorkDto) => void;
  onCancel: () => void;
};

// The work form (spec 006, FR-1). Mounted fresh every time it opens, so the fields start empty with the
// first medium selected; it is unmounted, with its typed values, when the selected universe changes (FR-12).
export function WorkCreationForm({ onCreated, onCancel }: WorkCreationFormProps) {
  const { vocabulary, createWork, isCreationBlocked, creationNoticeCode, dismissCreationNotice } = useKnowledge();
  const { signInAddress } = useUniverses();
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState<string>(vocabulary.work.mediums[0] ?? "");
  const [unitCount, setUnitCount] = useState("");
  const [fieldErrors, setFieldErrors] = useState<WorkFieldMessages>({});
  const failureNoticeCode = creationNoticeCode === CREATION_NOTICE_CODES.confirmedAfterDelay ? null : creationNoticeCode;
  const failureNoticeRef = useRef<HTMLParagraphElement>(null);
  const lastSeenNoticeCodeRef = useRef(failureNoticeCode);
  const isMountedRef = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const mediumSelectRef = useRef<HTMLSelectElement>(null);
  const unitCountInputRef = useRef<HTMLInputElement>(null);
  const fieldIdPrefix = useId();
  const titleInputId = `${fieldIdPrefix}-title`;
  const titleErrorId = `${fieldIdPrefix}-title-error`;
  const mediumSelectId = `${fieldIdPrefix}-medium`;
  const mediumErrorId = `${fieldIdPrefix}-medium-error`;
  const unitCountInputId = `${fieldIdPrefix}-unit-count`;
  const unitCountHintId = `${fieldIdPrefix}-unit-count-hint`;
  const unitCountErrorId = `${fieldIdPrefix}-unit-count-error`;

  useEffect(() => {
    isMountedRef.current = true;
    titleInputRef.current?.focus();
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

  function focusFirstInvalidField(errors: WorkFieldMessages) {
    if (errors.title !== undefined) titleInputRef.current?.focus();
    else if (errors.medium !== undefined) mediumSelectRef.current?.focus();
    else if (errors.unitCount !== undefined) unitCountInputRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The provider ignores a second submission while one is waiting; the other ends are shown as a notice.
    setFieldErrors({});
    const outcome = await createWork({ title, medium, unitCount });
    // A late answer may arrive after the form was closed: then it has nothing to do here.
    if (!isMountedRef.current) return;
    if (outcome?.status === "created") {
      onCreated(outcome.work);
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
        <h2 className="font-serif text-xl">{en.workCreation.title}</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={titleInputId} className="text-sm font-medium">
            {en.workCreation.titleLabel}
          </label>
          <Input
            id={titleInputId}
            ref={titleInputRef}
            name="title"
            autoComplete="off"
            placeholder={en.workCreation.titlePlaceholder}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setFieldErrors((current) => ({ ...current, title: undefined }));
            }}
            aria-invalid={fieldErrors.title !== undefined}
            aria-describedby={fieldErrors.title === undefined ? undefined : titleErrorId}
            className="aria-invalid:border-danger"
          />
          <FieldError id={titleErrorId} message={fieldErrors.title} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={mediumSelectId} className="text-sm font-medium">
            {en.workCreation.mediumLabel}
          </label>
          <select
            id={mediumSelectId}
            ref={mediumSelectRef}
            name="medium"
            value={medium}
            onChange={(event) => {
              setMedium(event.target.value);
              setFieldErrors((current) => ({ ...current, medium: undefined }));
            }}
            aria-invalid={fieldErrors.medium !== undefined}
            aria-describedby={fieldErrors.medium === undefined ? undefined : mediumErrorId}
            className={SELECT_CLASS_NAME}
          >
            {vocabulary.work.mediums.map((workMedium) => (
              <option key={workMedium} value={workMedium}>
                {MEDIUM_LABELS[workMedium] ?? workMedium}
              </option>
            ))}
          </select>
          <FieldError id={mediumErrorId} message={fieldErrors.medium} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={unitCountInputId} className="text-sm font-medium">
            {en.workCreation.unitCountLabel}
          </label>
          <Input
            id={unitCountInputId}
            ref={unitCountInputRef}
            name="unitCount"
            inputMode="numeric"
            autoComplete="off"
            value={unitCount}
            onChange={(event) => {
              setUnitCount(event.target.value);
              setFieldErrors((current) => ({ ...current, unitCount: undefined }));
            }}
            aria-invalid={fieldErrors.unitCount !== undefined}
            aria-describedby={[unitCountHintId, fieldErrors.unitCount === undefined ? null : unitCountErrorId]
              .filter((describedById) => describedById !== null)
              .join(" ")}
            className="aria-invalid:border-danger max-w-40"
          />
          <p id={unitCountHintId} className="text-ink-muted text-xs">
            {en.workCreation.unitCountHint(vocabulary.work.maximumUnitCount)}
          </p>
          <FieldError id={unitCountErrorId} message={fieldErrors.unitCount} />
        </div>

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
                  {en.workCreation.notices.signInLink}
                </a>
              </>
            ) : null}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isCreationBlocked}>
            {en.workCreation.create}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {en.workCreation.cancel}
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
