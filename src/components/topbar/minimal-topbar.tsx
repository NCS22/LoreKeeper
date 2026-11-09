import { en } from "@/messages/en";
import { PreferencesSync } from "@/components/accessibility/preferences-sync";
import { AccessibilityControl } from "@/components/topbar/accessibility-control";
import { UserMenuSlot } from "@/components/topbar/user-menu-slot";

/**
 * The reduced top bar of pages that do not carry the workspace chrome (the not-found page, FR-23):
 * the brand, the accessibility control and the user menu. It needs no workspace layout context, which
 * the full `Topbar` does. It mounts `PreferencesSync`, so a change made in the control applies at once
 * (FR-33); the stored preferences are applied on load by the script of the root layout.
 */
export function MinimalTopbar() {
  return (
    <header className="border-line bg-surface flex h-(--topbar-height) shrink-0 items-center justify-between border-b px-2">
      <PreferencesSync />
      <span className="truncate pl-1 font-serif text-lg font-semibold">{en.app.name}</span>
      <div className="flex items-center gap-1">
        <AccessibilityControl />
        <UserMenuSlot />
      </div>
    </header>
  );
}
