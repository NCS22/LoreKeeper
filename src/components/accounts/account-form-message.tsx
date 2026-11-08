import type { Ref } from "react";
import { flushSync } from "react-dom";

type AccountFormMessageProps = {
  /** The general message, or `null` when there is none (the element is then visually collapsed but stays in the accessibility tree). */
  message: string | null;
  messageRef?: Ref<HTMLDivElement>;
};

/**
 * The general message of a form or of the user menu (FR-7, FR-9, FR-10, FR-14, FR-28). It is an
 * alert, so assistive technologies announce it, and it can receive the focus by script when there
 * is no field to send the focus to (NFR-2). It is always in the page so a later message is announced.
 */
export function AccountFormMessage({ message, messageRef }: AccountFormMessageProps) {
  return (
    <div
      ref={messageRef}
      role="alert"
      tabIndex={-1}
      className="text-danger text-sm [overflow-wrap:anywhere] empty:sr-only"
    >
      {message}
    </div>
  );
}

/**
 * Applies a state update, waits until the page shows it, and only then moves the focus. The
 * messages and the `aria-describedby` links must already be in the page when the focus lands, or a
 * screen reader would not read them.
 */
export function updateThenFocus(
  applyStateUpdate: () => void,
  findElementToFocus: () => HTMLElement | null | undefined,
): void {
  flushSync(applyStateUpdate);
  findElementToFocus()?.focus();
}
