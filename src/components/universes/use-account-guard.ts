"use client";

import { useCallback, useEffect } from "react";
import { confirmAccountAction } from "@/app/universes/actions";
import { leaveAccountPage } from "@/components/accounts/leave-account-page";
import { runWithTimeLimit } from "@/components/accounts/run-with-time-limit";
import {
  ACCOUNT_PROBE_TIME_LIMIT_MILLISECONDS,
  decideAfterAccountProbe,
  type AccountGuardDecision,
} from "@/components/universes/account-guard-decision";

const ACCOUNT_CHANNEL_NAME = "lorekeeper-account";
const WORKSPACE_ROOT_ADDRESS = "/";

/**
 * Keeps a tab from acting under another account (FR-18). The workspace carries the key of the
 * account it was rendered for:
 * - when it loads it announces that key to the other tabs of the browser, and a tab that hears a
 *   different key starts again from the workspace root, so nothing of the earlier account stays in it;
 * - before every creation and every remembered universe the tab asks the server which account is
 *   acting and sends nothing if it is not the one it shows.
 * The key is never sent back to the server as an identity: the server takes the account from the
 * session only (FR-2), so this check cannot be used to act for another account (plan D4).
 */
export function useAccountGuard(accountKey: string): {
  /** Resolves with what the caller does next; on `replace-document` the page is already leaving. */
  readonly confirmAccountBeforeSending: () => Promise<AccountGuardDecision>;
} {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const accountChannel = new BroadcastChannel(ACCOUNT_CHANNEL_NAME);
    accountChannel.onmessage = (message: MessageEvent<unknown>) => {
      if (typeof message.data === "string" && message.data !== accountKey) {
        leaveAccountPage(WORKSPACE_ROOT_ADDRESS);
      }
    };
    accountChannel.postMessage(accountKey);

    return () => accountChannel.close();
  }, [accountKey]);

  const confirmAccountBeforeSending = useCallback(async (): Promise<AccountGuardDecision> => {
    const probeOutcome = await runWithTimeLimit(
      () => confirmAccountAction(),
      ACCOUNT_PROBE_TIME_LIMIT_MILLISECONDS,
    );
    const decision = decideAfterAccountProbe(accountKey, probeOutcome);
    if (decision === "replace-document") leaveAccountPage(WORKSPACE_ROOT_ADDRESS);
    return decision;
  }, [accountKey]);

  return { confirmAccountBeforeSending };
}
