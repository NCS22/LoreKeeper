"use client";

import { Button } from "@/components/ui/button";
import { en } from "@/messages/en";

/**
 * Asks the server again for the address the person requested. The proxy rewrites that address to
 * this page without changing it in the browser, so a reload repeats the session check there.
 */
export function TryAgainButton() {
  return (
    <Button type="button" onClick={() => window.location.reload()}>
      {en.sessionCheckFailed.tryAgain}
    </Button>
  );
}
