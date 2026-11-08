import type { ComponentProps, Ref } from "react";
import { Input } from "@/components/ui/input";

type AccountFormFieldProps = Pick<
  ComponentProps<"input">,
  "name" | "type" | "autoComplete" | "inputMode" | "autoCapitalize" | "spellCheck"
> & {
  /** Used for the input; the error block gets `${inputId}-error`. */
  inputId: string;
  label: string;
  value: string;
  onValueChange: (newValue: string) => void;
  /** All the messages of this field; empty when the field has no error. */
  messages: readonly string[];
  inputRef?: Ref<HTMLInputElement>;
};

/**
 * A labelled text input of the account forms. The label is always visible and tied to the input;
 * the error block is linked with `aria-describedby` and the input says `aria-invalid` (NFR-2).
 * It adds no browser validation: no `required`, `pattern` or `maxLength` (FR-3).
 */
export function AccountFormField({
  inputId,
  label,
  value,
  onValueChange,
  messages,
  inputRef,
  ...inputAttributes
}: AccountFormFieldProps) {
  const errorId = `${inputId}-error`;
  const hasErrors = messages.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={inputId}
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={hasErrors}
        aria-describedby={hasErrors ? errorId : undefined}
        className="aria-invalid:border-danger"
        {...inputAttributes}
      />
      {hasErrors ? (
        <div id={errorId} className="flex flex-col gap-1">
          {messages.map((message) => (
            <p key={message} className="text-danger text-sm [overflow-wrap:anywhere]">
              {message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
