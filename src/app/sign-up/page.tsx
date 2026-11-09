import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageShell } from "@/components/accounts/account-page-shell";
import { buildAccountFormVocabulary } from "@/components/accounts/build-account-form-vocabulary";
import { en } from "@/messages/en";
import {
  RETURN_DESTINATION_PARAMETER,
  buildSignInAddress,
  resolveReturnDestination,
} from "@/modules/accounts";
import { SignUpForm } from "./_components/sign-up-form";

const WORKSPACE_ROOT_ADDRESS = "/";

export const metadata: Metadata = {
  title: `${en.accountForms.signUp.title} - ${en.app.name}`,
};

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <AccountPageShell title={en.accountForms.signUp.title}>
      <Suspense fallback={<SignUpFormFallback />}>
        <SignUpFormWithReturnDestination searchParams={searchParams} />
      </Suspense>
    </AccountPageShell>
  );
}

type SignUpFormWithReturnDestinationProps = {
  searchParams: PageProps<"/sign-up">["searchParams"];
};

/**
 * Reads the query of the request, which is why it streams in behind the `Suspense` boundary. The
 * return destination is checked here, with the one rule of the accounts module, and the form only
 * receives the result as plain props (plan D4, D13).
 */
async function SignUpFormWithReturnDestination({
  searchParams,
}: SignUpFormWithReturnDestinationProps) {
  const requestedParameters = await searchParams;
  const requestedDestination = requestedParameters[RETURN_DESTINATION_PARAMETER];
  // A repeated parameter arrives as a list: there is no single destination to trust.
  const returnDestination = resolveReturnDestination(
    typeof requestedDestination === "string" ? requestedDestination : null,
  );

  return (
    <SignUpForm
      vocabulary={buildAccountFormVocabulary()}
      destinationAddress={returnDestination ?? WORKSPACE_ROOT_ADDRESS}
      signInAddress={buildSignInAddress(returnDestination)}
    />
  );
}

function SignUpFormFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="bg-hover rounded-control h-14 animate-pulse" />
      <div className="bg-hover rounded-control h-14 animate-pulse" />
      <div className="bg-hover rounded-control h-14 animate-pulse" />
      <div className="bg-hover rounded-control h-14 animate-pulse" />
      <div className="bg-hover rounded-control h-8 animate-pulse" />
    </div>
  );
}
