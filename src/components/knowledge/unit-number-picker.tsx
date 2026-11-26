"use client";

import { type Ref } from "react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveTypedUnitNumber } from "@/components/knowledge/resolve-typed-unit-number";
import type { UnitWording } from "@/modules/knowledge";

type UnitNumberPickerProps = {
  inputId: string;
  inputRef?: Ref<HTMLInputElement>;
  unitWording: UnitWording;
  unitCount: number;
  workTitle: string;
  /** The number as the person typed it; the form sends it as it is (plan section 4). */
  typedUnitNumber: string;
  onTypedUnitNumberChange: (typedUnitNumber: string) => void;
  /** A message of the server for this field; shown in place of the picker's own while present. */
  serverErrorMessage?: string;
};

// The choice of a unit of a work (spec 006, FR-4, NFR-3): a typed number with First and Last, never a
// list of the units, so a work of 5000 units is chosen by keyboard at 320 px (D7). The point it picks
// is shown below the field; a number that matches no unit picks nothing and shows an error linked to it.
export function UnitNumberPicker({
  inputId,
  inputRef,
  unitWording,
  unitCount,
  workTitle,
  typedUnitNumber,
  onTypedUnitNumberChange,
  serverErrorMessage,
}: UnitNumberPickerProps) {
  const wordingLabel = en.unitPicker.wordingLabels[unitWording];
  const wordingText = en.knowledge.unitWordings[unitWording].singular;
  const resolution = resolveTypedUnitNumber(typedUnitNumber, unitCount);
  const errorMessage =
    serverErrorMessage ?? (resolution.status === "no-unit" ? en.unitPicker.noUnit(wordingText, unitCount) : undefined);
  const hintId = `${inputId}-hint`;
  const resolvedPointId = `${inputId}-resolved`;
  const errorId = `${inputId}-error`;
  const describedByIds = [
    hintId,
    resolution.status === "resolved" ? resolvedPointId : null,
    errorMessage === undefined ? null : errorId,
  ].filter((describedById) => describedById !== null);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {wordingLabel}
      </label>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          id={inputId}
          ref={inputRef}
          inputMode="numeric"
          autoComplete="off"
          value={typedUnitNumber}
          onChange={(event) => onTypedUnitNumberChange(event.target.value)}
          aria-invalid={errorMessage !== undefined}
          aria-describedby={describedByIds.join(" ")}
          className="aria-invalid:border-danger w-28 min-w-0"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={en.unitPicker.firstLabel(wordingText)}
          onClick={() => onTypedUnitNumberChange("1")}
        >
          {en.unitPicker.first}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={en.unitPicker.lastLabel(wordingText)}
          onClick={() => onTypedUnitNumberChange(String(unitCount))}
        >
          {en.unitPicker.last}
        </Button>
      </div>
      <p id={hintId} className="text-ink-muted text-xs">
        {en.unitPicker.range(unitCount)}
      </p>
      {resolution.status === "resolved" ? (
        <p id={resolvedPointId} className="text-ink min-w-0 text-sm [overflow-wrap:anywhere]">
          {en.unitPicker.resolvedPoint(wordingLabel, resolution.unitNumber, workTitle)}
        </p>
      ) : null}
      {errorMessage === undefined ? null : (
        <p id={errorId} className="text-danger text-sm">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
