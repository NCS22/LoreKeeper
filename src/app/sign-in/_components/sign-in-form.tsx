"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { confirmSessionStartedAction } from "@/app/confirm-session-started/actions";
import { AccountFormField } from "@/components/accounts/account-form-field";
import { AccountFormMessage, updateThenFocus } from "@/components/accounts/account-form-message";
import type {
  AccountFieldMessages,
  AccountFormVocabulary,
} from "@/components/accounts/account-issue-messages";
import { interpretAccountActionResult } from "@/components/accounts/interpret-account-action-result";
import { interpretSessionConfirmation } from "@/components/accounts/interpret-session-confirmation";
import { leaveAccountPage } from "@/components/accounts/leave-account-page";
import { runWithTimeLimit } from "@/components/accounts/run-with-time-limit";
import { useAccountSubmission } from "@/components/accounts/use-account-submission";
import { Button } from "@/components/ui/button";
import { en } from "@/messages/en";
import { signInAction } from "../actions";

type SignInFormProps = {
  /** Field names and issue codes of the account rules, read on the server (plan D13). */
  vocabulary: AccountFormVocabulary;
  /** Where to go after signing in: the return destination already checked on the server, or the workspace root. */
  destinationAddress: string;
  /** The sign-up page address, already carrying the return destination when there is one (FR-19). */
  signUpAddress: string;
};

const FIELDS_IN_FOCUS_ORDER = ["email", "password"] as const;

/**
 * The sign-in form (FR-2, FR-6 to FR-14). It sends exactly what was typed and lets the account
 * rules answer: there is no browser validation and no length limit (FR-3). The interface decisions
 * about each answer live in `interpretAccountActionResult`; this component only shows them.
 */
export function SignInForm({ vocabulary, destinationAddress, signUpAddress }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldMessages, setFieldMessages] = useState<AccountFieldMessages>({});
  const [generalMessage, setGeneralMessage] = useState<string | null>(null);
  const { isSubmitting, runSubmission, releaseSubmission } = useAccountSubmission();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const generalMessageRef = useRef<HTMLDivElement>(null);

  function showFailure(newFieldMessages: AccountFieldMessages, newGeneralMessage: string | null): void {
    const firstFieldWithError = FIELDS_IN_FOCUS_ORDER.find(
      (fieldName) => (newFieldMessages[fieldName]?.length ?? 0) > 0,
    );
    const inputByField = { email: emailInputRef, password: passwordInputRef };

    updateThenFocus(
      () => {
        // The typed email stays and the password never does (FR-8, FR-9, FR-10).
        setPassword("");
        setFieldMessages(newFieldMessages);
        setGeneralMessage(newGeneralMessage);
        releaseSubmission();
      },
      () =>
        firstFieldWithError === undefined
          ? generalMessageRef.current
          : inputByField[firstFieldWithError].current,
    );
  }

  async function confirmThenLeave(): Promise<void> {
    const confirmationOutcome = await runWithTimeLimit(() => confirmSessionStartedAction());
    if (interpretSessionConfirmation(confirmationOutcome) === "session-not-kept") {
      showFailure({}, en.accountForms.signIn.storageBlocked);
      return;
    }
    // The submission stays in progress: the page is being left (FR-30, plan D6).
    leaveAccountPage(destinationAddress);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    // Old messages go first, so a repeated message is announced again when it comes back (NFR-2).
    setFieldMessages({});
    setGeneralMessage(null);

    const submissionOutcome = await runSubmission(() => signInAction({ email, password }));
    // `null`: another submission of this form is already waiting (FR-12).
    if (submissionOutcome === null) return;

    const outcome = interpretAccountActionResult("sign-in", submissionOutcome, vocabulary);
    switch (outcome.status) {
      case "succeeded":
        await confirmThenLeave();
        return;
      case "already-signed-in":
        leaveAccountPage(destinationAddress);
        return;
      case "field-errors":
        showFailure(outcome.messagesByField, null);
        return;
      case "message":
        showFailure({}, outcome.message);
        return;
    }
  }

  return (
    <form noValidate method="post" aria-busy={isSubmitting} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <AccountFormMessage message={generalMessage} messageRef={generalMessageRef} />
      <AccountFormField
        inputId="sign-in-email"
        inputRef={emailInputRef}
        name="email"
        type="text"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        label={en.accountForms.signIn.emailLabel}
        value={email}
        onValueChange={setEmail}
        messages={fieldMessages.email ?? []}
      />
      <AccountFormField
        inputId="sign-in-password"
        inputRef={passwordInputRef}
        name="password"
        type="password"
        autoComplete="current-password"
        label={en.accountForms.signIn.passwordLabel}
        value={password}
        onValueChange={setPassword}
        messages={fieldMessages.password ?? []}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? en.accountForms.signIn.submitting : en.accountForms.signIn.submit}
      </Button>
      <p className="text-ink-muted text-sm">
        {en.accountForms.signIn.switchPrompt}{" "}
        <Link href={signUpAddress} prefetch={false} className="text-accent underline-offset-4 hover:underline">
          {en.accountForms.signIn.switchLink}
        </Link>
      </p>
    </form>
  );
}
