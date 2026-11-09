import { Suspense } from "react";
import { UserRound } from "lucide-react";
import { UserMenuLoader } from "@/components/topbar/user-menu-loader";
import { Button } from "@/components/ui/button";

/**
 * The place of the user menu in a top bar: the menu of the account in use once it is read, and a
 * placeholder while it is being read. Shared by the workspace top bar and the reduced one.
 */
export function UserMenuSlot() {
  return (
    <Suspense fallback={<UserMenuPlaceholder />}>
      <UserMenuLoader />
    </Suspense>
  );
}

// Holds the place of the user menu while the account is read, so the top bar does not jump. It is
// hidden from assistive technologies and cannot be activated.
function UserMenuPlaceholder() {
  return (
    <Button variant="ghost" size="sm" disabled aria-hidden tabIndex={-1}>
      <UserRound aria-hidden />
    </Button>
  );
}
