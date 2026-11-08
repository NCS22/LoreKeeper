import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageShell } from "@/components/accounts/account-page-shell";
import { buildAccountFormVocabulary } from "@/components/accounts/build-account-form-vocabulary";
import { en } from "@/messages/en";
import {
  RETURN_DESTINATION_PARAMETER,
  buildSignUpAddress,
  resolveReturnDestination,
} from "@/modules/accounts";
import { SignInForm } from "./_components/sign-in-form";

const WORKSPACE_ROOT_ADDRESS = "/";

export const metadata: Metadata = {
  title: `${en.accountForms.signIn.title} - ${en.app.name}`,
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AccountPageShell title={en.accountForms.signIn.title}>
      <Suspense fallback={<SignInFormFallback />}>
        <SignInFormWithReturnDestination searchParams={searchParams} />
      </Suspense>
    </AccountPageShell>
  );
}

type SignInFormWithReturnDestinationProps = {
  searchParams: PageProps<"/sign-in">["searchParams"];
};

/**
 * Reads the query of the request, which is why it streams in behind the `Suspense` boundary. The
 * return destination is checked here, with the one rule of the accounts module, and the form only
 * receives the result as plain props (plan D4, D13).
 */
async function SignInFormWithReturnDestination({
  searchParams,
}: SignInFormWithReturnDestinationProps) {
  const requestedParameters = await searchParams;
  const requestedDestination = requestedParameters[RETURN_DESTINATION_PARAMETER];
  // A repeated parameter arrives as a list: there is no single destination to trust.
  const returnDestination = resolveReturnDestination(
    typeof requestedDestination === "string" ? requestedDestination : null,
  );

  return (
    <SignInForm
      vocabulary={buildAccountFormVocabulary()}
      destinationAddress={returnDestination ?? WORKSPACE_ROOT_ADDRESS}
      signUpAddress={buildSignUpAddress(returnDestination)}
    />
  );
}

function SignInFormFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="bg-hover rounded-control h-14 animate-pulse" />
      <div className="bg-hover rounded-control h-14 animate-pulse" />
      <div className="bg-hover rounded-control h-8 animate-pulse" />
    </div>
  );
}
