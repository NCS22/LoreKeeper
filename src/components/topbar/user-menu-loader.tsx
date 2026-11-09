import { buildAccountFormVocabulary } from "@/components/accounts/build-account-form-vocabulary";
import { UserMenu } from "@/components/topbar/user-menu";
import { buildSignInAddress } from "@/modules/accounts";
import { AuthenticationError } from "@/shared/domain/error-kinds";
import type { ActingUser } from "@/shared/domain/acting-user";
import { getActingUser } from "@/shared/presentation/get-acting-user";

/**
 * Reads the account in use on the server and hands its name and email to the client menu as plain
 * props (plan D13: the client never imports the accounts module). No session renders nothing: the
 * session ended while the page was being rendered, for example by the sign-out that re-renders the
 * page, and the guard sends the person to sign in on their next request. A session that cannot be
 * checked is not hidden: it is rethrown to the error boundary, because the person is not signed out.
 */
export async function UserMenuLoader() {
  const actingUser = await findActingUserOrNull();
  if (actingUser === null) return null;

  return (
    <UserMenu
      displayName={actingUser.displayName}
      email={actingUser.email}
      signInAddress={buildSignInAddress(null)}
      vocabulary={buildAccountFormVocabulary()}
    />
  );
}

async function findActingUserOrNull(): Promise<ActingUser | null> {
  try {
    return await getActingUser();
  } catch (error) {
    if (error instanceof AuthenticationError) return null;
    throw error;
  }
}
